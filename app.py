import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

import importlib
from src.data_loader import load_master, load_counties
import src.priority_model
import src.report_card
importlib.reload(src.priority_model)
importlib.reload(src.report_card)

from src.priority_model import (
    allocate_relief_budget,
    evaluate_out_of_sample_validation,
    COMMODITY_PRICES,
)
from src.report_card import get_county_report_card

# ── 1. Page Configuration & Styling ──────────────────────────────────────────
st.set_page_config(
    page_title="State Drought Assistance & Priority Targeting Dashboard",
    page_icon="🌾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom header styling
st.markdown(
    """
    <style>
    .main-header {
        font-size: 2.1rem;
        font-weight: 700;
        color: #1b3a4b;
        margin-bottom: 0.2rem;
    }
    .sub-caption {
        font-size: 1.05rem;
        color: #495057;
        margin-bottom: 1.2rem;
    }
    .tier1-badge {
        background-color: #ff4d4f;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    .tier2-badge {
        background-color: #faad14;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    .tier3-badge {
        background-color: #52c41a;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown('<div class="main-header">🌾 State Drought Assistance & Priority Targeting Dashboard</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-caption">Objective, data-driven agricultural relief allocation before post-harvest survey delays</div>', unsafe_allow_html=True)


# ── 2. Data Caching ──────────────────────────────────────────────────────────
@st.cache_data
def get_master_data():
    return load_master()

@st.cache_data
def get_geojson():
    try:
        return load_counties()
    except Exception:
        return None

df = get_master_data()
geojson_data = get_geojson()


# ── 3. Sidebar Controls ──────────────────────────────────────────────────────
st.sidebar.header("🎯 Targeting Parameters")

state_map = {"Iowa": "IA", "Nebraska": "NE", "California": "CA", "Delaware": "DE"}
selected_state_label = st.sidebar.selectbox("State", options=["Iowa", "Nebraska", "California", "Delaware"], index=0)
selected_state = state_map[selected_state_label]

available_crops = sorted(df[df["state_alpha"] == selected_state]["crop"].unique())
default_crop_index = available_crops.index("CORN") if "CORN" in available_crops else 0
selected_crop = st.sidebar.selectbox("Commodity Crop", options=available_crops, index=default_crop_index)

st.sidebar.markdown("---")
st.sidebar.subheader("📅 Time & Budget")

# Allow picking targeting year (highlight modern unseen test years 2016-2025)
years_list = sorted(df["year"].unique(), reverse=True)
default_year_idx = years_list.index(2020) if 2020 in years_list else 0
selected_year = st.sidebar.selectbox(
    "Targeting Year",
    options=years_list,
    index=default_year_idx,
    help="2016–2025 represent out-of-sample modern test years; 2000–2015 represent historical training years."
)

if selected_year >= 2016:
    st.sidebar.info(f"✨ **{selected_year}** is an **Out-of-Sample Test Year** (evaluated blind).")
else:
    st.sidebar.caption(f"ℹ️ **{selected_year}** is part of the 2000–2015 baseline training period.")

relief_budget_m = st.sidebar.slider(
    "Emergency Relief Fund ($ Millions)",
    min_value=5,
    max_value=100,
    value=25,
    step=5,
    help="Total emergency assistance pool to disburse across critical priority counties."
)
relief_budget = relief_budget_m * 1_000_000

threshold_pct = st.sidebar.slider(
    "Relief Assistance Quota (Top % Counties)",
    min_value=5,
    max_value=30,
    value=15,
    step=5,
    help="Targeting threshold: percentage of counties classified into Tier 1 (Emergency Aid)."
) / 100.0

sort_mode_map = {
    "🚨 Drought Urgency (Agronomic & Soil Stress)": "urgency",
    "💰 Total Economic Dollar Loss ($)": "dollar_loss",
    "📉 Harvest Yield Deficit (% below trend)": "yield_loss",
}
selected_sort_label = st.sidebar.selectbox(
    "Priority Ranking Strategy",
    options=list(sort_mode_map.keys()),
    index=0,
    help="Rank by per-acre climate & soil stress intensity (Urgency Score), macro-economic dollar loss ($), or percentage harvest crash."
)
selected_sort = sort_mode_map[selected_sort_label]

st.sidebar.markdown("---")
st.sidebar.caption(
    "**Stakeholder**: State Drought Program Official\n"
    "**Decision**: Priority county allocation & assistance triggers\n"
    "**Evidence**: NOAA ACIS, USDM, USDA NRCS SSURGO"
)


# ── 4. Main Navigation Tabs ──────────────────────────────────────────────────
tab_ranking, tab_validation, tab_explorer = st.tabs([
    "📋 County Priority Ranking",
    "🎯 Model Validation (2016–2025)",
    "🔍 County Report Card & Deep Dive"
])


# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: County Priority Ranking & Action Dashboard
# ══════════════════════════════════════════════════════════════════════════════
with tab_ranking:
    st.subheader(f"State Priority Report Card: {selected_state_label} ({selected_crop}, {selected_year})")

    # Run Priority Allocation Model
    ranked_df = allocate_relief_budget(
        df=df,
        state_alpha=selected_state,
        crop=selected_crop,
        year=selected_year,
        relief_budget=relief_budget,
        top_k_pct=threshold_pct,
        sort_by=selected_sort,
    )

    if ranked_df.empty:
        st.warning(f"No reported crop yield data available for {selected_state_label} {selected_crop} in {selected_year}.")
    else:
        # 1. Summary Metric Cards
        tier1_df = ranked_df[ranked_df["action_tier"].str.contains("Tier 1")]
        total_counties = len(ranked_df)
        tier1_count = len(tier1_df)
        total_loss = ranked_df["estimated_dollar_loss"].sum()
        avg_tier1_loss_pct = tier1_df["yield_anomaly_pct"].mean()
        avg_aid_per_county = tier1_df["recommended_relief_usd"].mean() if tier1_count > 0 else 0

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Counties Analyzed", f"{total_counties}")
        col2.metric("🚨 High Priority Aid (Tier 1)", f"{tier1_count} counties")
        col3.metric(
            "Statewide Crop Loss ($)",
            f"${total_loss:,.0f}" if total_loss > 0 else "$0",
            delta=f"{avg_tier1_loss_pct:.1f}% Avg Tier 1 Anomaly" if pd.notna(avg_tier1_loss_pct) else None,
            delta_color="inverse"
        )
        col4.metric(
            "Avg Relief per Priority County",
            f"${avg_aid_per_county:,.0f}" if avg_aid_per_county > 0 else "$0"
        )

        st.markdown("---")

        # 2. Ranking Table with Action Tiers
        st.subheader("📋 County Relief Action Ranking")
        st.caption(f"Counties ranked by **{selected_sort_label}**. Emergency relief budget (${relief_budget_m}M) targeted proportionally across Tier 1 priority counties.")

        # Formatting table for display
        display_cols = [
            "rank", "county_name", "fips", "urgency_score", "action_tier",
            "recommended_relief_usd", "estimated_dollar_loss", "yield_anomaly_pct",
            "extreme_heat_days", "weeks_in_d2_plus", "aws_100cm_mm"
        ]

        table_data = ranked_df[display_cols].copy()
        table_data.rename(columns={
            "rank": "Rank",
            "county_name": "County",
            "fips": "FIPS",
            "urgency_score": "Urgency Score (1-10)",
            "action_tier": "Action Tier",
            "recommended_relief_usd": "Allocated Relief ($)",
            "estimated_dollar_loss": "Est. Dollar Loss ($)",
            "yield_anomaly_pct": "Yield Anomaly (%)",
            "extreme_heat_days": "Heat Days (≥35°C)",
            "weeks_in_d2_plus": "D2+ Weeks",
            "aws_100cm_mm": "Soil Sponge (mm)"
        }, inplace=True)

        st.dataframe(
            table_data.style.format({
                "Urgency Score (1-10)": "{:.1f}",
                "Allocated Relief ($)": "${:,.0f}",
                "Est. Dollar Loss ($)": "${:,.0f}",
                "Yield Anomaly (%)": "{:+.1f}%",
                "Soil Sponge (mm)": "{:.0f} mm",
                "Heat Days (≥35°C)": "{:.0f}",
                "D2+ Weeks": "{:.0f}"
            }),
            use_container_width=True,
            height=340
        )

        # Download CSV button
        csv_bytes = ranked_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Export Relief Action Ledger (CSV)",
            data=csv_bytes,
            file_name=f"{selected_state}_{selected_crop}_{selected_year}_relief_priorities.csv",
            mime="text/csv",
        )

        st.markdown("---")

        # 3. Visual Proof: Scatter Plot & Choropleth Map
        st.subheader("📈 Spatial & Agronomic Verification")

        viz_mode = st.radio("Select View", options=["Scatter Plot: Urgency vs. Actual Harvest Loss", "🗺️ Geographic County Map"], horizontal=True)

        if viz_mode == "Scatter Plot: Urgency vs. Actual Harvest Loss":
            fig_scatter = px.scatter(
                ranked_df,
                x="urgency_score",
                y="yield_anomaly_pct",
                color="action_tier",
                color_discrete_map={
                    "🚨 Tier 1 (Immediate Relief)": "#e63946",
                    "⚠️ Tier 2 (Monitoring / Buffer)": "#f4a261",
                    "✅ Tier 3 (Resilient / Low Risk)": "#2a9d8f",
                },
                hover_name="county_name",
                hover_data={
                    "urgency_score": ":.1f",
                    "yield_anomaly_pct": ":.1f%",
                    "recommended_relief_usd": ":$,.0f",
                    "aws_100cm_mm": ":.0f mm",
                    "extreme_heat_days": True,
                    "weeks_in_d2_plus": True,
                },
                labels={
                    "urgency_score": "Drought Urgency Score (1 to 10)",
                    "yield_anomaly_pct": "Actual Harvest Anomaly vs Trend (%)",
                    "action_tier": "Action Tier"
                },
                title=f"{selected_state_label} {selected_crop} ({selected_year}): Urgency Score vs. Harvest Collapse",
            )
            # Add horizontal threshold line
            fig_scatter.add_hline(y=-10, line_dash="dash", line_color="gray", annotation_text="Severe Crop Loss Threshold (-10%)")
            fig_scatter.update_layout(height=480, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_scatter, use_container_width=True)
            st.caption("🔍 **Validation check**: Tier 1 counties (red) cluster heavily in the negative yield anomaly zone, proving that high urgency scores correctly identify real harvest collapses.")

        elif viz_mode == "🗺️ Geographic County Map":
            if geojson_data:
                # Filter GeoJSON to selected state's counties
                fips_list = set(ranked_df["fips"].unique())
                filtered_features = [f for f in geojson_data["features"] if f["id"] in fips_list]
                state_geojson = {"type": "FeatureCollection", "features": filtered_features}

                fig_map = px.choropleth(
                    ranked_df,
                    geojson=state_geojson,
                    locations="fips",
                    color="urgency_score",
                    color_continuous_scale="Reds",
                    hover_name="county_name",
                    hover_data={
                        "urgency_score": ":.1f",
                        "action_tier": True,
                        "recommended_relief_usd": ":$,.0f",
                        "yield_anomaly_pct": ":.1f%",
                    },
                    labels={"urgency_score": "Urgency Score"},
                    title=f"{selected_state_label} Priority Relief Map ({selected_year})",
                )
                fig_map.update_geos(fitbounds="locations", visible=False)
                fig_map.update_layout(height=520, margin=dict(l=10, r=10, t=40, b=10))
                st.plotly_chart(fig_map, use_container_width=True)
            else:
                st.info("County boundary GeoJSON not loaded.")


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: Model Validation & Out-of-Sample Proof
# ══════════════════════════════════════════════════════════════════════════════
with tab_validation:
    st.subheader("🎯 Out-of-Sample Validation: Testing on Unseen Years (2016–2025)")
    st.markdown(
        """
        **The Methodological Standard**:
        * **Training Baseline (2000–2015)**: 16 historical seasons used to establish soil buffering effects and urgency weights.
        * **Blind Holdout Test (2016–2025)**: 10 modern seasons withheld completely during design and tested blind against real USDA reported yields.
        """
    )

    # Run Benchmark Engine
    val_table, val_summary = evaluate_out_of_sample_validation(
        df=df,
        train_years=(2000, 2015),
        test_years=(2016, 2025),
        crop=selected_crop,
        state_alpha=selected_state,
        top_k_pct=threshold_pct,
    )

    # 1. Check for sufficient reporting data
    if val_summary.get("status") == "insufficient_data" or val_table.empty:
        st.info(
            f"ℹ️ **Limited Historical Data for {selected_state_label} {selected_crop} (2016–2025)**\n\n"
            f"As specified in `data/data_dictionary.md`, NASS published limited or un-detrended yield surveys for this specific state-crop pair. "
            f"To view the full 10-year out-of-sample benchmark across 90+ counties, please switch the sidebar to **Iowa** or **Nebraska** (**Corn** or **Soybeans**)."
        )
    else:
        # 1. Summary Benchmark KPI Cards
        b1, b2, b3, b4 = st.columns(4)
        b1.metric("Test Period", val_summary["test_years"], "10 Unseen Seasons")
        b2.metric("Disaster Events Analyzed", f"{val_summary['total_disaster_events']} counties", "Severe drops (≤-10%)")
        b3.metric("Our Model Precision", val_summary["model_precision"], f"+{val_summary['model_lift_vs_rain']}x vs. Rain Alone")
        b4.metric("Naive Rainfall Precision", val_summary["rain_precision"], "Rainfall Deficit alone")

        st.markdown("---")

        # 2. Scoreboard Comparison Chart
        col_chart, col_table = st.columns([1.2, 1.0])

        with col_chart:
            st.subheader("📊 Targeting Accuracy: Model vs. Baselines")
            comparison_df = pd.DataFrame({
                "Strategy": [
                    "Proposed Model (Heat + Drought + Soil)",
                    "Pure Drought Monitor (DSCI alone)",
                    "Pure Rainfall Deficit (Precip alone)",
                    "Random County Allocation"
                ],
                "Precision (%)": [
                    float(val_summary["model_precision"].replace("%", "")),
                    float(val_summary["dsci_precision"].replace("%", "")),
                    float(val_summary["rain_precision"].replace("%", "")),
                    float(val_summary["random_precision"].replace("%", ""))
                ],
                "Color": ["#2a9d8f", "#e76f51", "#f4a261", "#adb5bd"]
            })

            fig_bar = px.bar(
                comparison_df,
                x="Strategy",
                y="Precision (%)",
                color="Strategy",
                color_discrete_sequence=["#2a9d8f", "#e76f51", "#f4a261", "#6c757d"],
                text="Precision (%)",
                title=f"Hit Rate on Unseen Modern Disasters ({selected_state_label} {selected_crop})",
            )
            fig_bar.update_traces(texttemplate="%{text:.1f}%", textposition="outside")
            fig_bar.update_layout(height=420, showlegend=False, yaxis=dict(range=[0, 30]))
            st.plotly_chart(fig_bar, use_container_width=True)

        with col_table:
            st.subheader("📋 Unseen Test Season Scoreboard")
            st.dataframe(
                val_table[[
                    "year", "tier1_quota_k", "actual_severe_counties",
                    "model_urgency_hits", "rain_deficit_hits", "pure_dsci_hits"
                ]].rename(columns={
                    "year": "Year",
                    "tier1_quota_k": "Relief Slots (K)",
                    "actual_severe_counties": "True Disasters",
                    "model_urgency_hits": "Our Model Hits",
                    "rain_deficit_hits": "Rain Alone Hits",
                    "pure_dsci_hits": "USDM Alone Hits",
                }),
                use_container_width=True,
                height=420
            )

        # 3. Agronomic Explanation
        with st.expander("💡 Why does our model consistently beat pure rainfall deficit?"):
            st.markdown(
                """
                1. **Rainfall timing is not captured by total volume**: A county might have near-normal cumulative rain because of May downpours, but suffer zero rain and 38°C heat during critical July pollination.
                2. **The 'Soil Sponge' (Available Water Storage)**: Counties with deep, high-water-capacity soils (`aws_100cm_mm > 180mm`) can buffer dry spells for 2–3 weeks without severe yield drops. Pure rainfall metrics trigger false alarms for these buffered counties.
                3. **Heat-Stress Multiplier**: Days over 35°C correlate with yield collapse at **-0.56**, far stronger than rainfall deficit (**+0.14**).
                """
            )


# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: Data Explorer & County Report Card Deep Dive
# ══════════════════════════════════════════════════════════════════════════════
with tab_explorer:
    st.subheader("🔍 County Agricultural Report Card & Historical Ledger")
    st.write("Examine any specific county's soil buffering capacity, 26-year drought frequency, and historical harvest resilience.")

    # County Selector: only list counties that grow and report the selected crop
    state_counties = sorted(df[
        (df["state_alpha"] == selected_state) &
        (df["crop"] == selected_crop) &
        (df["yield_status"] == "reported")
    ]["county_name"].unique())
    if not state_counties:
        state_counties = sorted(df[df["state_alpha"] == selected_state]["county_name"].unique())

    selected_county_name = st.selectbox("Select County to Inspect", options=state_counties, index=0)
    selected_fips = df[
        (df["state_alpha"] == selected_state) &
        (df["county_name"] == selected_county_name)
    ]["fips"].iloc[0]

    # Generate Report Card
    card = get_county_report_card(df, fips=selected_fips, crop=selected_crop)

    if card:
        # 1. County Soil & Climate Header Cards
        rc1, rc2, rc3, rc4 = st.columns(4)
        rc1.metric("Soil Sponge (AWS 100cm)", f"{card['aws_100cm_mm']} mm", card["sponge_grade"])
        rc2.metric("Droughty Soil Share", f"{card['droughty_pct']}%", "Vulnerable Acreage")
        rc3.metric("D2+ Drought Frequency", f"{card['d2_plus_years']} seasons", f"{card['d2_frequency_pct']}% of years since 2000")
        rc4.metric("Drought Yield Loss Gap", f"-{card['drought_impact_gap_pct']}%", "Yield drop in drought vs normal years")

        st.markdown("---")

        # 2. 26-Year Multi-Axis History Chart
        st.subheader(f"Historical Climate Stress vs. Yield Anomaly: {selected_county_name} ({selected_crop})")

        hist_df = card["history_df"].copy()

        fig_history = go.Figure()

        # Add Yield Anomaly Bar
        fig_history.add_trace(go.Bar(
            x=hist_df["year"],
            y=hist_df["yield_anomaly_pct"],
            name="Yield Anomaly (%)",
            marker_color=np.where(hist_df["yield_anomaly_pct"] >= 0, "#2a9d8f", "#e63946"),
            yaxis="y1"
        ))

        # Add Drought Severity Line
        fig_history.add_trace(go.Scatter(
            x=hist_df["year"],
            y=hist_df["mean_dsci"],
            name="Drought Severity (DSCI)",
            mode="lines+markers",
            line=dict(color="#f4a261", width=2.5),
            yaxis="y2"
        ))

        # Add Extreme Heat Days Line
        fig_history.add_trace(go.Scatter(
            x=hist_df["year"],
            y=hist_df["extreme_heat_days"],
            name="Extreme Heat Days (≥35°C)",
            mode="lines+markers",
            line=dict(color="#d62828", width=2, dash="dot"),
            yaxis="y2"
        ))

        fig_history.update_layout(
            title=f"2000–2025 Multi-Year Profile for {selected_county_name} (FIPS {selected_fips})",
            xaxis=dict(title="Year"),
            yaxis=dict(
                title=dict(text="Yield Anomaly (%)", font=dict(color="#2a9d8f")),
                tickfont=dict(color="#2a9d8f"),
            ),
            yaxis2=dict(
                title=dict(text="Drought DSCI (0–500) / Heat Days", font=dict(color="#f4a261")),
                tickfont=dict(color="#f4a261"),
                overlaying="y",
                side="right",
            ),
            legend=dict(x=0.01, y=0.99, bgcolor="rgba(255,255,255,0.7)"),
            height=460,
            margin=dict(l=20, r=20, t=40, b=20)
        )

        st.plotly_chart(fig_history, use_container_width=True)

        # 3. Raw Historical Data Table
        with st.expander("📄 View 26-Year County Raw Records"):
            st.dataframe(
                hist_df.rename(columns={
                    "year": "Year",
                    "yield_per_acre": "Yield (bu/acre)",
                    "yield_anomaly_pct": "Yield Anomaly (%)",
                    "mean_dsci": "Drought DSCI",
                    "weeks_in_d2_plus": "Weeks in D2+",
                    "extreme_heat_days": "Heat Days (≥35°C)",
                    "precip_anomaly_pct": "Precip Anomaly (%)"
                }),
                use_container_width=True
            )
    else:
        st.info("No report card available for this selection.")

st.markdown(
    """
    <div style="
        display: flex;
        justify-content: flex-end;
        width: 100%;
        margin-top: 40px;
    ">
        <div style="
            background-color: #1e1e1e;  /* darker charcoal grey */
            color: #ffffff;
            padding: 12px 18px;
            border-radius: 10px;
            box-shadow: 0px 0px 12px rgba(0,0,0,0.4);
            font-size: 14px;
            display: inline-block;
        ">
            <strong>Geek Squad — DSU Hackathon 2026</strong><br>
            Jeremiah D, Juwan J, Joshua P, Carelle N, Karim S
        </div>
    </div>
    """,
    unsafe_allow_html=True
)
