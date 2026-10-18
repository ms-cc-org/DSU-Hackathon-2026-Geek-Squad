"""
State Drought Relief Targeting: Streamlit app.

User:      a state drought program administrator (e.g. Iowa Dept. of Agriculture).
Decision:  which counties get emergency drought relief first, and the score that triggers it.
When:      mid-August, months before post-harvest yield surveys are published.

The page reads top to bottom in the same order as our pitch:
  1. Who gets relief    the ranked answer for the chosen season
  2. Why                which inputs predict crop loss (and which don't)
  3. Does it work?      rules fixed on 2000-2015, scored blind on 2016-2025
  4. County report card one county's 26-year drought and yield history
  5. Limits & data      what the tool can't do and how data gaps were handled

All numbers come from src/priority_model.py, src/report_card.py and src/insights.py,
the same code behind the React frontend (api_server.py).
"""

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.data_loader import load_counties, load_master
from src.insights import (
    MIN_TEST_PICKS,
    SEVERE_THRESHOLD_PCT,
    TEST_YEARS,
    TRAIN_YEARS,
    data_quality,
    driver_correlations,
)
from src.priority_model import (
    COMMODITY_PRICES,
    allocate_relief_budget,
    evaluate_out_of_sample_validation,
    urgency_components,
)
from src.report_card import get_county_report_card

st.set_page_config(
    page_title="State Drought Relief Targeting",
    page_icon="🌽",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Constants ────────────────────────────────────────────────────────────────
STATES = {"IA": "Iowa", "NE": "Nebraska", "CA": "California", "DE": "Delaware"}
TIER_NAMES = {1: "Gets relief", 2: "Watch list", 3: "Lower risk"}
TIER_COLORS = {"Gets relief": "#e63946", "Watch list": "#f4a261", "Lower risk": "#2a9d8f", "No reported yield": "#d9d9d9"}
MODEL_COLOR, BASELINE_COLOR = "#2a9d8f", "#adb5bd"


# ── Formatting helpers ───────────────────────────────────────────────────────
def usd(v) -> str:
    return "—" if pd.isna(v) else f"${v:,.0f}"


def usd_short(v) -> str:
    if v is None or pd.isna(v):
        return "—"
    for div, unit in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(v) >= div:
            return f"${v / div:.1f}{unit}"
    return f"${v:,.0f}"


def md(text: str) -> str:
    """Escape $ for Streamlit markdown, which otherwise renders text between two $ signs as LaTeX math."""
    return text.replace("$", r"\$")


def signed_pct(v) -> str:
    return "—" if pd.isna(v) else f"{v:+.1f}%"


def r_str(r: float) -> str:
    return f"{r:+.2f}"


def plural(n: int, word: str) -> str:
    if n == 1:
        return f"{n} {word}"
    return f"{n} {word[:-1]}ies" if word.endswith("y") else f"{n} {word}s"


def join_and(items) -> str:
    items = [str(i) for i in items]
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}"


# ── Cached data access ───────────────────────────────────────────────────────
# Every model call is cached on its parameters, so moving a slider back is instant.
@st.cache_data
def get_master() -> pd.DataFrame:
    # Parquet keeps FIPS codes as text ("06001"), so joins never silently drop rows.
    return load_master()


@st.cache_data
def get_geojson():
    try:
        return load_counties()
    except Exception:
        return None


@st.cache_data
def get_ranking(state: str, crop: str, year: int, budget: float, quota: float) -> pd.DataFrame:
    """Ranked counties for one season, plus the score's intermediate terms and a tier number."""
    ranked = allocate_relief_budget(
        df=get_master(), state_alpha=state, crop=crop, year=year,
        relief_budget=budget, top_k_pct=quota, sort_by="urgency",
    )
    if ranked.empty:
        return ranked
    ranked = pd.concat([ranked, urgency_components(ranked)], axis=1)
    ranked["tier"] = np.select(
        [ranked["action_tier"].str.contains("Tier 1"), ranked["action_tier"].str.contains("Tier 2")], [1, 2], 3
    )
    ranked["decision"] = ranked["tier"].map(TIER_NAMES)
    return ranked


@st.cache_data
def get_validation(state: str, crop: str, quota: float):
    return evaluate_out_of_sample_validation(
        df=get_master(), train_years=TRAIN_YEARS, test_years=TEST_YEARS, crop=crop,
        state_alpha=state, top_k_pct=quota, severe_threshold_pct=SEVERE_THRESHOLD_PCT,
    )


@st.cache_data
def get_report_card(fips: str, crop: str) -> dict:
    return get_county_report_card(get_master(), fips=fips, crop=crop)


@st.cache_data
def get_correlations(state: str, crop: str) -> dict:
    return driver_correlations(get_master(), state, crop)


@st.cache_data
def get_data_quality(state: str, crop: str, year: int) -> dict:
    return data_quality(get_master(), state, crop, year)


@st.cache_data
def get_coverage() -> pd.DataFrame:
    """Reported county-years per state and crop: the 'count rows before you compare' check."""
    df = get_master()
    rep = df[df["yield_status"] == "reported"]
    return rep.pivot_table(index="state_alpha", columns="crop", values="fips", aggfunc="count", fill_value=0)


# ── Sidebar: who, what, when + controls ──────────────────────────────────────
def render_sidebar() -> dict:
    df = get_master()
    sb = st.sidebar

    with sb.container(border=True):
        st.markdown(
            "**👤 User**  \nState drought program administrator\n\n"
            "**🎯 Decision**  \nWhich counties get emergency drought relief first, and the score that triggers it\n\n"
            "**⏰ When**  \nMid-August, months before harvest yield surveys are published"
        )

    sb.subheader("Targeting settings")
    state = sb.selectbox("State", list(STATES), format_func=lambda c: STATES[c])
    crops = sorted(df[df["state_alpha"] == state]["crop"].unique())
    crop = sb.selectbox("Crop", crops, index=crops.index("CORN") if "CORN" in crops else 0)

    years = sorted(df["year"].unique(), reverse=True)
    year = sb.selectbox(
        "Season",
        years,
        index=years.index(2020),
        format_func=lambda y: f"{y} · blind test year" if y >= TEST_YEARS[0] else str(y),
        help=f"{TRAIN_YEARS[0]}–{TRAIN_YEARS[1]} seasons were used to design the score; "
        f"{TEST_YEARS[0]}–{TEST_YEARS[1]} were held out and scored blind.",
    )
    budget_m = sb.slider("Relief fund ($ millions)", 5, 100, 25, 5, help="Total emergency money to hand out this season.")
    quota_pct = sb.slider(
        "Counties funded (top %)", 5, 30, 15, 5,
        help="The share of counties with the highest urgency scores that receive relief (Tier 1).",
    )

    with sb.expander("📖 Data notes & edge cases"):
        st.markdown(
            "- **Reported yields only.** Rows with `yield_status == \"reported\"` are ranked; "
            "`not_reported` (NASS published nothing) and `suppressed` (planted, not harvested) are left out.\n"
            "- **FIPS codes are text.** `load_master()` reads the parquet file, so `06001` keeps its leading zero. "
            "With `read_csv`, pass `dtype={\"fips\": str}`.\n"
            "- **Growing season, not calendar year.** Weather and drought cover each crop's season (corn: May–Sept).\n"
            "- **Coverage is lopsided.** Iowa and Nebraska corn and soybeans are well covered; "
            "California, Delaware and sorghum are thin. Reported county-years:"
        )
        st.dataframe(get_coverage(), width="stretch")

    return {
        "state": state, "state_label": STATES[state], "crop": crop, "year": int(year),
        "budget_m": budget_m, "budget": budget_m * 1_000_000, "quota_pct": quota_pct, "quota": quota_pct / 100,
    }


# ── Page header ──────────────────────────────────────────────────────────────
def render_header(p: dict) -> None:
    st.title("🌽 State Drought Relief Targeting")
    st.markdown(
        f"**Which {p['state_label']} {p['crop'].lower()} counties should get emergency drought money first?** "
        "Relief only helps if it arrives before harvest, so we score every county in August on heat, "
        "drought length and soil water, then fund the hardest hit."
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.info("**Who:** state drought program administrator")
    c2.info(md(f"**Decides:** where the ${p['budget_m']}M fund goes, and the trigger score"))
    c3.info("**Evidence:** heat, drought weeks, rainfall, soil water (26 seasons)")
    c4.info(f"**Proof:** rules set on {TRAIN_YEARS[0]}–{TRAIN_YEARS[1]}, tested blind on {TEST_YEARS[0]}–{TEST_YEARS[1]}")


# ── 1. Who gets relief ───────────────────────────────────────────────────────
def render_answer(p: dict, ranked: pd.DataFrame) -> None:
    tier1 = ranked[ranked["tier"] == 1]
    t1_loss = tier1["estimated_dollar_loss"].sum()
    checks = tier1["recommended_relief_usd"]
    dq = get_data_quality(p["state"], p["crop"], p["year"])

    st.header(f"1 · Who gets relief in {p['year']}")
    if len(ranked) < 10:
        st.warning(f"Only {plural(len(ranked), 'county')} reported a yield. That's too few to rank with confidence, so treat this as illustration only.")
    else:
        st.markdown(md(f"#### Send the ${p['budget_m']}M to these {len(tier1)} counties. Each check is sized to the county's estimated crop loss."))

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Counties funded", f"{len(tier1)} of {len(ranked)}", help=f"Top {p['quota_pct']}% by urgency score")
    m2.metric("Relief trigger this year", f"Score ≥ {tier1['urgency_score'].min():.1f}", help="Lowest urgency score (1–10) that still gets relief")
    coverage = p["budget"] / t1_loss if t1_loss > 0 else None
    m3.metric(
        "Their estimated crop loss", md(usd_short(t1_loss)),
        help="Bushels below each county's trend × harvested acres × USDA average price",
    )
    m4.metric("Check size", md(usd_short(checks.max()) if len(checks) == 1 else f"{usd_short(checks.min())}–{usd_short(checks.max())}"))
    if coverage is not None:
        st.caption(
            f"The fund covers {coverage:.1%} of the funded counties' losses." if coverage <= 1
            else f"The fund is {coverage:.1f}× the funded counties' losses: more than needed."
        )

    # Hindsight: did the August picks match what the harvest later showed?
    known = tier1[tier1["yield_anomaly_pct"].notna()]
    if not known.empty:
        hits = int((known["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT).sum())
        severe = int((ranked["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT).sum())
        note = " This season was not used to build the model." if p["year"] >= TEST_YEARS[0] else ""
        st.success(
            f"**Hindsight check:** {hits} of these {plural(len(known), 'county')} really did lose ≥{abs(SEVERE_THRESHOLD_PCT):.0f}% "
            f"of their harvest. Statewide, {severe} of {len(ranked)} counties did.{note}"
        )

    col_map, col_list = st.columns([1.15, 1])
    with col_map:
        view = st.segmented_control("Map view", ["Our August pick", "What the harvest showed"], default="Our August pick")
        render_map(p, ranked, view or "Our August pick")
        excluded = dq["not_reported"] + dq["suppressed"]
        st.caption(
            f"{dq['reported']} of {dq['county_rows']} counties have a reported yield."
            + (f" The other {excluded} ({dq['not_reported']} not published by NASS, {dq['suppressed']} suppressed) are grey and left out." if excluded else "")
        )
    with col_list:
        st.markdown("**Relief checks** (select a row to open its report card)")
        table = pd.DataFrame({
            "#": tier1["rank"],
            "County": tier1["county_name"],
            "Score": tier1["urgency_score"],
            "Harvest vs trend": tier1["yield_anomaly_pct"].map(signed_pct),
            "Relief check": checks.map(usd),
            "Share of fund": checks / p["budget"] * 100,
        })
        event = st.dataframe(
            table, hide_index=True, width="stretch", on_select="rerun", selection_mode="single-row", key="tier1_table",
            height=min(36 * (len(table) + 1) + 3, 600),
            column_config={
                "Score": st.column_config.NumberColumn(format="%.1f", help="Drought urgency, 1–10"),
                "Share of fund": st.column_config.ProgressColumn(format="%.1f%%", min_value=0, max_value=100),
            },
        )
        # Open the selected county in the report card (only when the selection changes)
        rows = event.selection.rows
        if rows and st.session_state.get("_last_pick") != rows[0]:
            st.session_state["_last_pick"] = rows[0]
            st.session_state["county"] = tier1.iloc[rows[0]]["fips"]
        st.caption("Check = fund × (county's loss ÷ all funded counties' losses).")


def render_map(p: dict, ranked: pd.DataFrame, view: str) -> None:
    geo = get_geojson()
    if not geo:
        st.info("County boundary file not found (data/counties.geojson).")
        return
    feats = [f for f in geo["features"] if f["properties"].get("state_alpha") == p["state"]]
    names = pd.DataFrame([{"fips": f["id"], "county": f["properties"]["county_name"]} for f in feats])
    # Keep every county on the map; unreported ones are drawn grey.
    mdf = names.merge(ranked, on="fips", how="left")
    mdf["decision"] = mdf["decision"].fillna("No reported yield")
    hover = {"fips": False, "decision": True, "urgency_score": ":.1f", "yield_anomaly_pct": ":+.1f", "recommended_relief_usd": ":$,.0f"}

    common = dict(geojson={"type": "FeatureCollection", "features": feats}, locations="fips", hover_name="county", hover_data=hover,
                  labels={"urgency_score": "Urgency", "yield_anomaly_pct": "Harvest vs trend (%)", "recommended_relief_usd": "Relief", "decision": "Decision"})
    if view == "Our August pick":
        fig = px.choropleth(mdf, color="decision", color_discrete_map=TIER_COLORS,
                            category_orders={"decision": list(TIER_COLORS)}, **common)
    else:
        fig = px.choropleth(mdf, color="yield_anomaly_pct", color_continuous_scale="RdYlGn", range_color=(-40, 40),
                            color_continuous_midpoint=0, **common)
        fig.update_coloraxes(colorbar_title="Harvest<br>vs trend %")
    fig.update_geos(fitbounds="locations", visible=False)
    fig.update_layout(height=430, margin=dict(l=0, r=0, t=0, b=0), legend=dict(orientation="h", y=-0.02, title=None))
    st.plotly_chart(fig, width="stretch")


# ── 2. Why these counties ────────────────────────────────────────────────────
WHY_CARDS = [
    ("extreme_heat_days", "🌡️ Heat days ≥35°C", "30%", "Heat during pollination kills kernels even after a wet spring."),
    ("weeks_in_d2_plus", "🔥 Weeks in severe drought", "30%", "How long the drought lasted matters more than one bad week."),
    ("mean_dsci", "🏜️ Drought severity", "25%", "U.S. Drought Monitor intensity, averaged over the season."),
    ("precip_anomaly_pct", "🌧️ Rainfall", "15%", "Season totals hide timing: a wet May can mask a dry July."),
]


def render_why(p: dict) -> None:
    st.header("2 · Why these counties")
    corr = get_correlations(p["state"], p["crop"])
    if not corr["drivers"]:
        st.info(f"Too few reported {p['crop'].lower()} yields in {p['state_label']} to measure these links.")
        return
    r = {d["id"]: d["r"] for d in corr["drivers"]}
    heat, rain, d2 = r["extreme_heat_days"], r["precip_anomaly_pct"], r["weeks_in_d2_plus"]

    # The headline must match this state's numbers, not Iowa's.
    if abs(rain) <= abs(heat) / 2:
        headline = f"Heat and drought length predict crop losses. Rainfall barely does (r {r_str(heat)} vs {r_str(rain)})."
    elif abs(heat) >= abs(rain):
        headline = f"Heat (r {r_str(heat)}) and drought length (r {r_str(d2)}) track crop losses at least as well as rainfall (r {r_str(rain)})."
    else:
        headline = f"Here rainfall (r {r_str(rain)}) tracks losses more than heat (r {r_str(heat)}). The score weighs both, plus drought length."
    st.markdown(f"#### {headline}")

    for col, (key, title, weight, note) in zip(st.columns(4), WHY_CARDS):
        col.metric(title, f"r = {r_str(r[key])}", help=note)
        col.caption(f"Weight in score: **{weight}**. {note}")

    soil, formula = st.columns([1.2, 1])
    soil.info(
        f"**🧽 The soil sponge.** On its own, soil water storage barely tracks yield (r {r_str(r['aws_100cm_mm'])}). "
        "It works as a *cushion*: deep soils carry a crop through a dry spell. "
        "So the model cuts a county's drought hazard by up to 25% when its soil holds a lot of water."
    )
    formula.code(
        "Urgency = 1 + 9 × Hazard × (1 − 0.25 × Soil)\n"
        "Hazard = 0.30 Heat + 0.30 D2Weeks\n"
        "       + 0.25 Severity + 0.15 RainDeficit",
        language=None,
    )
    st.caption(
        f"r = Pearson correlation with yield vs trend across {corr['n']:,} reported {p['state_label']} {p['crop'].lower()} "
        f"county-seasons ({corr['year_min']}–{corr['year_max']}). Negative = more of it, worse harvest."
    )


# ── 3. Does it work? ─────────────────────────────────────────────────────────
STRATEGIES = [
    ("model", "model_urgency_hits", "Our urgency score"),
    ("dsci", "pure_dsci_hits", "Drought Monitor alone"),
    ("rain", "rain_deficit_hits", "Rainfall deficit alone"),
    ("random", "random_expected_hits", "Random picks"),
]


def render_proof(p: dict) -> None:
    st.header("3 · Does it work?")
    table, summary = get_validation(p["state"], p["crop"], p["quota"])
    if summary.get("status") != "ok" or table.empty:
        st.info(
            f"**Not enough reported yields to run a fair blind test for {p['state_label']} {p['crop'].lower()}.** "
            "NASS published too few county yields or trend values for this pair (see data/data_dictionary.md). "
            "Switch to Iowa or Nebraska corn or soybeans for the full test."
        )
        return

    active = table[table["actual_severe_counties"] > 0]
    slots = int(active["tier1_quota_k"].sum())
    precision = {k: active[col].sum() / slots * 100 for k, col, _ in STRATEGIES}
    hits = {k: active[col].sum() for k, col, _ in STRATEGIES}

    if slots < MIN_TEST_PICKS:
        st.warning(
            f"#### Too little data to judge: only {slots} picks across {TEST_YEARS[0]}–{TEST_YEARS[1]}. "
            "The numbers below are not proof either way."
        )
    else:
        vs_rain = (
            f" and {hits['model'] / max(1, hits['rain']):.2f}× better than rainfall" if hits["model"] > hits["rain"]
            else ", but no better than rainfall alone"
        )
        st.markdown(
            f"#### Tested blind on {TEST_YEARS[0]}–{TEST_YEARS[1]}: {precision['model']:.1f}% of our picks were real disasters. "
            f"That's {precision['model'] / precision['random']:.1f}× better than chance{vs_rain}."
        )

    col_bar, col_notes = st.columns([1, 1])
    with col_bar:
        bars = pd.DataFrame({
            "Method": [label for _, _, label in STRATEGIES],
            "Precision": [precision[k] for k, _, _ in STRATEGIES],
            "Hits": [f"{hits[k]:.1f} expected" if k == "random" else f"{int(hits[k])} hits" for k, _, _ in STRATEGIES],
        })
        fig = px.bar(bars, x="Precision", y="Method", orientation="h", text=bars["Precision"].map(lambda v: f"{v:.1f}%"),
                     hover_data={"Hits": True, "Precision": ":.1f"}, color="Method",
                     color_discrete_map={label: MODEL_COLOR if k == "model" else BASELINE_COLOR for k, _, label in STRATEGIES})
        fig.update_layout(height=230, showlegend=False, margin=dict(l=0, r=10, t=10, b=0),
                          xaxis_title="Share of picks that were real disasters (%)", yaxis_title=None)
        fig.update_traces(textposition="outside", cliponaxis=False)
        fig.update_yaxes(categoryorder="array", categoryarray=[label for _, _, label in reversed(STRATEGIES)])
        fig.update_xaxes(range=[0, bars["Precision"].max() * 1.3])
        st.plotly_chart(fig, width="stretch")
    with col_notes:
        st.markdown(
            f"**How the test works.** Rules fixed on {TRAIN_YEARS[0]}–{TRAIN_YEARS[1]}, never adjusted. Each test season every method "
            f"funds its top {p['quota_pct']}% of counties; a pick is a *hit* if that county's yield came in ≥{abs(SEVERE_THRESHOLD_PCT):.0f}% "
            f"below trend. {slots} picks across seasons with at least one disaster."
        )
        missed = active[(active["model_urgency_hits"] + active["rain_deficit_hits"] + active["pure_dsci_hits"]) == 0]["year"].tolist()
        if missed:
            st.info(
                f"**An honest miss:** in {join_and(missed)} none of the three methods caught any of the losses. "
                "The counties that lost harvest were not among the most drought-stressed that year, so the losses likely had other "
                "causes (wet fields, wind, disease). A drought signal can't see those, and a drought fund isn't meant to cover them."
            )

    st.markdown("**Season by season** (never seen while designing the score)")
    seasons = table.set_index("year")[
        ["actual_severe_counties", "model_urgency_hits", "rain_deficit_hits", "pure_dsci_hits", "tier1_quota_k"]
    ].rename(columns={
        "actual_severe_counties": "Real disasters", "model_urgency_hits": "Our score caught",
        "rain_deficit_hits": "Rainfall caught", "pure_dsci_hits": "Drought Monitor caught", "tier1_quota_k": "Counties funded",
    }).T
    seasons.columns = [str(c) for c in seasons.columns]
    st.dataframe(seasons, width="stretch")


# ── 4. County report card ────────────────────────────────────────────────────
def is_drought_season(h: pd.DataFrame) -> pd.Series:
    # Same definition as src/report_card.py
    return (h["mean_dsci"].fillna(0) >= 100) | (h["weeks_in_d2_plus"].fillna(0) >= 2)


def render_report_card(p: dict, ranked: pd.DataFrame) -> None:
    st.header("4 · County report card")
    options = ranked.sort_values("county_name")
    labels = {r.fips: f"{r.county_name} (#{r.rank})" for r in options.itertuples()}
    if st.session_state.get("county") not in labels:
        st.session_state["county"] = ranked.iloc[0]["fips"]
    fips = st.selectbox("Pick a county", list(labels), format_func=labels.get, key="county")

    row = ranked[ranked["fips"] == fips].iloc[0]
    card = get_report_card(fips, p["crop"])
    if not card:
        st.info("No report card available for this county.")
        return
    hist = card["history_df"]
    n_seasons = len(hist)
    gap = card["drought_impact_gap_pct"]
    worse = (
        f"In drought years its {p['crop'].lower()} yield ran {gap:.1f} points worse than in normal years."
        if gap > 0 else f"Its {p['crop'].lower()} yield was no worse in drought years than in normal years."
    )
    st.markdown(f"#### {card['county_name']}: severe drought hit {card['d2_plus_years']} of {n_seasons} seasons. {worse}")

    left, right = st.columns([1, 2.2])
    with left, st.container(border=True):
        st.markdown(f"**{p['year']} decision: {row['decision']}**")
        st.metric("Urgency score", f"{row['urgency_score']:.1f} / 10", help=f"Rank #{row['rank']} of {len(ranked)}")
        st.markdown(md(
            f"| | |\n|---|---:|\n"
            f"| Relief check | **{usd(row['recommended_relief_usd'])}** |\n"
            f"| Estimated crop loss | {usd(row['estimated_dollar_loss'])} |\n"
            f"| Harvest vs trend | {signed_pct(row['yield_anomaly_pct'])} |\n"
            f"| Heat days ≥35°C | {row['extreme_heat_days']:.0f} |\n"
            f"| Weeks in severe drought | {row['weeks_in_d2_plus']:.0f} |\n"
            f"| Rain vs normal | {signed_pct(row['precip_anomaly_pct'])} |\n"
            f"| Soil water storage | {row['aws_100cm_mm']:.0f} mm |"
        ))
    with right:
        s1, s2, s3, s4 = st.columns(4)
        s1.metric("Soil sponge", f"{card['aws_100cm_mm']:.0f} mm", help=card["sponge_grade"])
        s2.metric("Drought seasons", f"{card['d2_plus_years']} of {n_seasons}", help="Seasons with any week in D2+ drought")
        s3.metric("Drought-year yield", signed_pct(card["avg_drought_anomaly_pct"]), help="Average harvest vs trend in drought seasons")
        s3.caption(f"vs {signed_pct(card['avg_normal_anomaly_pct'])} in normal years")
        s4.metric("Worst drought", card["worst_drought_year"] or "—", help=f"Peak DSCI {card['peak_dsci']:.0f}")
        render_history_chart(hist)

    with st.expander("🧮 Show the math behind this score and check"):
        render_math(p, ranked, row)
    with st.expander(f"📄 All {n_seasons} seasons of raw records"):
        st.dataframe(
            hist.rename(columns={
                "year": "Year", "yield_per_acre": "Yield (bu/ac)", "yield_anomaly_pct": "Harvest vs trend (%)",
                "mean_dsci": "Drought DSCI", "weeks_in_d2_plus": "Weeks in D2+", "extreme_heat_days": "Heat days ≥35°C",
                "precip_anomaly_pct": "Rain vs normal (%)",
            }),
            hide_index=True, width="stretch",
        )


def render_history_chart(hist: pd.DataFrame) -> None:
    """Yield vs trend each year, with drought seasons marked. One y-axis only."""
    h = hist.copy()
    fig = go.Figure(go.Bar(
        x=h["year"], y=h["yield_anomaly_pct"], name="Harvest vs trend",
        marker_color=np.where(h["yield_anomaly_pct"] >= 0, "#2a9d8f", "#e63946"),
        hovertemplate="%{x}: %{y:+.1f}% vs trend<extra></extra>",
    ))
    drought = h[is_drought_season(h)]
    low = min(-10, h["yield_anomaly_pct"].min(skipna=True)) - 6
    fig.add_trace(go.Scatter(
        x=drought["year"], y=[low] * len(drought), mode="markers", name="Drought season",
        marker=dict(color="#f4a261", size=9, symbol="circle"),
        customdata=np.stack([drought["mean_dsci"], drought["weeks_in_d2_plus"]], axis=-1) if len(drought) else None,
        hovertemplate="%{x}: drought season (DSCI %{customdata[0]:.0f}, %{customdata[1]:.0f} wk in D2+)<extra></extra>",
    ))
    fig.update_layout(
        height=300, margin=dict(l=0, r=0, t=10, b=0), yaxis_title="Harvest vs trend (%)",
        legend=dict(orientation="h", y=1.08, x=0), bargap=0.25,
    )
    st.plotly_chart(fig, width="stretch")
    st.caption("A missing bar means NASS published no yield or trend that year. Drought season = DSCI ≥ 100 or ≥ 2 weeks in D2+.")


def render_math(p: dict, ranked: pd.DataFrame, row: pd.Series) -> None:
    """Step-by-step reproduction of the score, dollar loss and relief check for one county."""
    terms = pd.DataFrame([
        ("Heat days", f"{row['extreme_heat_days']:.0f} days ÷ 15", row["heat_norm"], 0.30),
        ("Weeks in D2+", f"{row['weeks_in_d2_plus']:.0f} wk ÷ 20", row["d2_norm"], 0.30),
        ("Drought severity", f"DSCI {row['mean_dsci']:.1f} ÷ 500", row["dsci_norm"], 0.25),
        ("Rain deficit", f"−({row['precip_anomaly_pct']:.1f}%) ÷ 50, floor 0", row["precip_deficit_norm"], 0.15),
    ], columns=["Input", "Raw value", "Normalized (0–1)", "Weight"])
    terms["Contribution"] = terms["Normalized (0–1)"] * terms["Weight"]
    st.markdown("**1. Drought urgency score**")
    st.dataframe(terms.style.format({"Normalized (0–1)": "{:.3f}", "Weight": "{:.2f}", "Contribution": "{:.3f}"}),
                 hide_index=True, width="stretch")
    st.markdown(
        f"- Hazard = **{row['hazard_score']:.3f}**\n"
        f"- Soil buffer = {row['aws_100cm_mm']:.1f} mm ÷ {row['soil_aws_p95_mm']:.1f} mm (95th pct this season) = **{row['soil_buffer_norm']:.3f}**\n"
        f"- Net = {row['hazard_score']:.3f} × (1 − 0.25 × {row['soil_buffer_norm']:.3f}) = **{row['net_urgency']:.3f}**\n"
        f"- Score = 1 + 9 × {row['net_urgency']:.3f} = **{row['urgency_score']:.1f}**"
    )
    price = COMMODITY_PRICES.get(p["crop"], 4.75)
    acres = row["acres_harvested"] if pd.notna(row["acres_harvested"]) else row["acres_planted"]
    st.markdown("**2. Estimated dollar loss**")
    if pd.isna(row["yield_anomaly_pct"]):
        st.markdown("No trend value was published for this county-season, so the model counts no loss.")
    else:
        st.markdown(md(
            f"- Trend yield = {row['yield_per_acre']:.1f} ÷ (1 + {row['yield_anomaly_pct']:.2f}%) = **{row['trend_yield']:.1f} bu/ac**\n"
            f"- Deficit = **{row['bushel_deficit_per_acre']:.1f} bu/ac** (0 if above trend)\n"
            f"- Bushels lost = {row['bushel_deficit_per_acre']:.1f} × {acres:,.0f} acres = **{row['total_bushels_lost']:,.0f}**\n"
            f"- Dollar loss = {row['total_bushels_lost']:,.0f} × ${price:.2f}/bu = **{usd(row['estimated_dollar_loss'])}**"
        ))
    st.markdown("**3. Relief check**")
    tier1 = ranked[ranked["tier"] == 1]
    t1_loss = tier1["estimated_dollar_loss"].sum()
    if row["tier"] != 1:
        st.markdown(md(f"Rank #{row['rank']} is outside the funded top {len(tier1)}, so the check is **$0**."))
    elif t1_loss > 0:
        st.markdown(md(f"${p['budget_m']}M × {usd(row['estimated_dollar_loss'])} ÷ {usd(t1_loss)} (all funded losses) = **{usd(row['recommended_relief_usd'])}**"))
    else:
        st.markdown(md(f"No funded county lost money, so the fund is split by urgency × acres: **{usd(row['recommended_relief_usd'])}**"))


# ── 5. Limits & data ─────────────────────────────────────────────────────────
def render_limits(p: dict, ranked: pd.DataFrame) -> None:
    st.header("5 · Limits & data")
    dq = get_data_quality(p["state"], p["crop"], p["year"])
    price = COMMODITY_PRICES.get(p["crop"], 4.75)
    unfunded = ranked[(ranked["tier"] != 1) & (ranked["estimated_dollar_loss"] > 0)].nlargest(1, "estimated_dollar_loss")

    cant, handled = st.columns(2)
    with cant, st.container(border=True):
        st.markdown("**⚠️ What it can't do**")
        lines = []
        if not unfunded.empty:
            u = unfunded.iloc[0]
            lines.append(
                f"**It only sees drought.** {u['county_name']} lost {usd_short(u['estimated_dollar_loss'])} in {p['year']} but scored "
                f"{u['urgency_score']:.1f} (rank #{u['rank']}). Its heat and drought readings were mild, so whatever cut its harvest "
                "(wind, flooding, hail) is a job for crop insurance, not this fund."
            )
        lines += [
            "**County averages only.** Nothing at field level, and nothing after 2025.",
            "**Irrigation isn't modeled.** Irrigated fields shrug off drought, so scores are less reliable where irrigation is common "
            "(much of Nebraska, nearly all of California).",
            f"**Dollar losses are estimates:** bushels below trend × harvested acres × a fixed USDA average price (${price:.2f}/bu).",
            "**Validated after the fact.** The test uses each season's final weather; a live August 15 run would see part of the season.",
        ]
        st.markdown(md("\n".join(f"- {line}" for line in lines)))
    with handled, st.container(border=True):
        st.markdown("**✅ How we handled the data**")
        trend_line = (
            f"{dq['no_trend_anomaly']} ranked counties have no trend value, so the model counts no loss for them rather than guessing."
            if dq["no_trend_anomaly"] else "Every ranked county has a trend value, so every dollar loss is measured, not guessed."
        )
        st.markdown(
            f"- Only reported yields are ranked: {dq['reported']} of {dq['county_rows']} counties this season "
            f"(excluded: {dq['not_reported']} not published, {dq['suppressed']} suppressed).\n"
            f"- {trend_line}\n"
            f"- Missing heat readings count as 0 heat days ({dq['missing_heat']} this season); missing soil data gets a typical 150 mm ({dq['missing_soil']}).\n"
            "- FIPS codes stay text, so `06001` never loses its leading zero and joins never silently fail.\n"
            "- Weather and drought cover the crop's growing season (corn: May–Sept), not the calendar year."
        )

    with st.expander(f"📋 All {len(ranked)} counties, ranked"):
        full = ranked[[
            "rank", "county_name", "fips", "urgency_score", "decision", "recommended_relief_usd", "estimated_dollar_loss",
            "yield_anomaly_pct", "extreme_heat_days", "weeks_in_d2_plus", "aws_100cm_mm",
        ]].rename(columns={
            "rank": "#", "county_name": "County", "fips": "FIPS", "urgency_score": "Score", "decision": "Decision",
            "recommended_relief_usd": "Relief ($)", "estimated_dollar_loss": "Est. loss ($)", "yield_anomaly_pct": "Harvest vs trend (%)",
            "extreme_heat_days": "Heat days", "weeks_in_d2_plus": "D2+ weeks", "aws_100cm_mm": "Soil (mm)",
        })
        st.dataframe(
            full, hide_index=True, width="stretch", height=380,
            column_config={
                "Score": st.column_config.NumberColumn(format="%.1f"),
                "Relief ($)": st.column_config.NumberColumn(format="$%d"),
                "Est. loss ($)": st.column_config.NumberColumn(format="$%d"),
                "Harvest vs trend (%)": st.column_config.NumberColumn(format="%+.1f"),
                "Soil (mm)": st.column_config.NumberColumn(format="%.0f"),
            },
        )
        st.download_button(
            "📥 Download the relief ledger (CSV)",
            data=ranked.drop(columns=["tier", "decision"]).to_csv(index=False).encode("utf-8"),
            file_name=f"{p['state']}_{p['crop']}_{p['year']}_relief_priorities.csv",
            mime="text/csv",
        )


def render_team_box() -> None:
    st.markdown(
        """
        <div style="display: flex; justify-content: flex-end; width: 100%; margin-top: 40px;">
            <div style="background-color: #1e1e1e; color: #ffffff; padding: 12px 18px; border-radius: 10px;
                        box-shadow: 0px 0px 12px rgba(0,0,0,0.4); font-size: 14px; display: inline-block;">
                <strong>Geek Squad — DSU Hackathon 2026</strong><br>
                Jeremiah D, Juwan J, Joshua P, Carelle N, Karim S
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ── Page ─────────────────────────────────────────────────────────────────────
def main() -> None:
    p = render_sidebar()
    render_header(p)

    ranked = get_ranking(p["state"], p["crop"], p["year"], p["budget"], p["quota"])
    if ranked.empty:
        st.warning(
            f"NASS published no {p['crop'].lower()} yields for {p['state_label']} in {p['year']}, so there is nothing to rank. "
            "Pick another season or crop; Iowa and Nebraska corn and soybeans have the fullest records."
        )
    else:
        st.divider()
        render_answer(p, ranked)
        st.divider()
        render_why(p)
        st.divider()
        render_proof(p)
        st.divider()
        render_report_card(p, ranked)
        st.divider()
        render_limits(p, ranked)
    render_team_box()


main()
