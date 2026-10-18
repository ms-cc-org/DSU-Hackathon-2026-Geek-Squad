"""
"Ask the data": a Claude-powered assistant that answers questions about the drought relief model.

Claude never sees the raw dataset. It answers by calling read-only tools that run the same
functions the dashboards use (allocate_relief_budget, evaluate_out_of_sample_validation,
get_county_report_card, src/insights.py), so every number it quotes comes from our model.
When a question can't be answered from this data, it is told to say so.

Needs an Anthropic credential: ANTHROPIC_API_KEY in the repo's .env file (never committed),
or an `ant auth login` profile.
"""

import json

import anthropic
import numpy as np
import pandas as pd
from anthropic import beta_tool

from src.insights import SEVERE_THRESHOLD_PCT, TEST_YEARS, TRAIN_YEARS, data_quality, driver_correlations
from src.priority_model import allocate_relief_budget, evaluate_out_of_sample_validation
from src.report_card import get_county_report_card

MODEL = "claude-opus-5-5"
STATES = {"IA": "Iowa", "NE": "Nebraska", "CA": "California", "DE": "Delaware"}

SYSTEM_PROMPT = f"""You are the "Ask the data" assistant inside a drought relief targeting dashboard built for a \
state drought program administrator. The administrator decides, in mid-August, which counties get emergency \
drought relief first and the urgency score that triggers it, months before harvest surveys are published.

How the model works (so you can explain it):
- Urgency score (1-10) = 1 + 9 x hazard x (1 - 0.25 x soil buffer).
  Hazard = 0.30 heat days>=35C (/15) + 0.30 weeks in D2+ drought (/20) + 0.25 mean DSCI (/500) + 0.15 rainfall deficit (/50%).
  Soil buffer = the county's 100 cm available water storage relative to the season's 95th percentile.
- Counties are ranked by score. The top quota (default 15%) is Tier 1 and gets relief; the fund is split in
  proportion to each Tier 1 county's estimated dollar loss (bushels below trend x harvested acres x USDA price).
- Validation: rules fixed on {TRAIN_YEARS[0]}-{TRAIN_YEARS[1]}, scored blind on {TEST_YEARS[0]}-{TEST_YEARS[1]}. A "hit" is a
  funded county whose yield came in at least {abs(SEVERE_THRESHOLD_PCT):.0f}% below trend. Baselines: rainfall deficit alone,
  Drought Monitor (DSCI) alone, random picks.

Data: one row per county x crop x season, {", ".join(f"{k} ({v})" for k, v in STATES.items())}, seasons 2000-2025.
Only rows with a reported yield are ranked. Iowa and Nebraska corn and soybeans are well covered; California,
Delaware and sorghum are thin.

Rules:
1. Get every number from a tool call. Never estimate, recall or invent figures. If a tool returns an error or empty
   result, say what is missing.
2. If the question can't be answered from this data, start with "The data can't answer that" and say why.
   It cannot answer: field- or farm-level questions (county averages only), anything after 2025, states other than
   IA/NE/CA/DE, irrigation effects (not modeled), prices other than the fixed USDA averages, or forecasts.
3. When the sample is small (fewer than 10 counties, or fewer than 30 test picks), say the result is not reliable.
4. If the user doesn't name a state, crop, season, fund or quota, use the dashboard settings given with their message.
5. Answer in plain text for a busy official: lead with the direct answer in one or two sentences, then at most
   five short "- " bullets with the supporting numbers. No markdown headings, tables or bold."""


def _clean(obj):
    """JSON-safe conversion of numpy / pandas values (NaN -> None)."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        return None if pd.isna(obj) else round(float(obj), 4)
    return obj


def _dump(obj) -> str:
    return json.dumps(_clean(obj), default=str)


def _check(state: str, crop: str, df: pd.DataFrame):
    state, crop = state.upper(), crop.upper()
    if state not in STATES:
        return None, None, f"Unknown state {state}. The dataset covers only {', '.join(STATES)}."
    crops = sorted(df[df["state_alpha"] == state]["crop"].unique())
    if crop not in crops:
        return None, None, f"{crop} is not in the {STATES[state]} data. Available crops: {', '.join(crops)}."
    return state, crop, None


def make_tools(df: pd.DataFrame) -> list:
    """Read-only tools over the master dataset. Each returns a JSON string."""

    @beta_tool
    def rank_counties(state: str, crop: str, year: int, budget_millions: float = 25, quota_pct: float = 15, top_n: int = 15) -> str:
        """Rank one season's counties by drought urgency and show who gets relief and how much.

        Args:
            state: Two-letter state code: IA, NE, CA or DE.
            crop: CORN, SOYBEANS, WHEAT or SORGHUM.
            year: Season, 2000-2025.
            budget_millions: Relief fund in millions of dollars (dashboard default 25).
            quota_pct: Percent of counties funded as Tier 1 (dashboard default 15).
            top_n: How many top-ranked counties to list (the summary always covers all counties).
        """
        state, crop, err = _check(state, crop, df)
        if err:
            return _dump({"error": err})
        ranked = allocate_relief_budget(df, state, crop, int(year), budget_millions * 1e6, quota_pct / 100, "urgency")
        if ranked.empty:
            return _dump({"error": f"NASS published no reported {crop} yields for {STATES[state]} in {year}."})
        tier1 = ranked[ranked["action_tier"].str.contains("Tier 1")]
        cols = ["rank", "county_name", "fips", "urgency_score", "action_tier", "recommended_relief_usd",
                "estimated_dollar_loss", "yield_anomaly_pct", "extreme_heat_days", "weeks_in_d2_plus",
                "mean_dsci", "precip_anomaly_pct", "aws_100cm_mm"]
        return _dump({
            "state": state, "crop": crop, "year": year, "fund_usd": budget_millions * 1e6, "quota_pct": quota_pct,
            "counties_ranked": len(ranked),
            "tier1_count": len(tier1),
            "relief_trigger_score": tier1["urgency_score"].min(),
            "tier1_total_loss_usd": tier1["estimated_dollar_loss"].sum(),
            "statewide_loss_usd": ranked["estimated_dollar_loss"].sum(),
            "severe_loss_counties_statewide": int((ranked["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT).sum()),
            "tier1_with_severe_loss": int((tier1["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT).sum()),
            "data_quality": data_quality(df, state, crop, int(year)),
            "top_counties": ranked[cols].head(top_n).to_dict(orient="records"),
        })

    @beta_tool
    def county_details(state: str, crop: str, county: str, year: int = 2020, budget_millions: float = 25, quota_pct: float = 15) -> str:
        """One county's 26-season report card plus its score, rank and relief check for one season.

        Args:
            state: Two-letter state code: IA, NE, CA or DE.
            crop: CORN, SOYBEANS, WHEAT or SORGHUM.
            county: County name (e.g. "Guthrie" or "Guthrie County") or 5-digit FIPS code.
            year: Season for the score and relief check, 2000-2025.
            budget_millions: Relief fund in millions of dollars.
            quota_pct: Percent of counties funded as Tier 1.
        """
        state, crop, err = _check(state, crop, df)
        if err:
            return _dump({"error": err})
        rows = df[(df["state_alpha"] == state)]
        q = county.strip().lower().removesuffix(" county")
        match = rows[(rows["fips"] == county.strip()) | (rows["county_name"].str.lower().str.removesuffix(" county") == q)]
        if match.empty:
            return _dump({"error": f"No county named '{county}' in {STATES[state]}."})
        fips = match["fips"].iloc[0]
        card = get_county_report_card(df, fips=fips, crop=crop)
        if not card:
            return _dump({"error": f"No {crop} records for {county}."})
        history = card.pop("history_df")
        ranked = allocate_relief_budget(df, state, crop, int(year), budget_millions * 1e6, quota_pct / 100, "urgency")
        season = ranked[ranked["fips"] == fips]
        return _dump({
            "report_card": card,
            "season": year,
            "season_result": season.drop(columns=["state_alpha"], errors="ignore").to_dict(orient="records")[0] if not season.empty
            else f"No reported {crop} yield for this county in {year}, so it was not ranked.",
            "counties_ranked_that_season": len(ranked),
            "history": history.to_dict(orient="records"),
        })

    @beta_tool
    def validation_results(state: str, crop: str, quota_pct: float = 15) -> str:
        """Blind-test results: how often each method's picks were real disasters in the test seasons.

        Args:
            state: Two-letter state code: IA, NE, CA or DE.
            crop: CORN, SOYBEANS, WHEAT or SORGHUM.
            quota_pct: Percent of counties each method funds per season.
        """
        state, crop, err = _check(state, crop, df)
        if err:
            return _dump({"error": err})
        table, summary = evaluate_out_of_sample_validation(
            df, TRAIN_YEARS, TEST_YEARS, crop=crop, state_alpha=state, top_k_pct=quota_pct / 100,
            severe_threshold_pct=SEVERE_THRESHOLD_PCT,
        )
        return _dump({
            "train_years": TRAIN_YEARS, "test_years": TEST_YEARS, "summary": summary,
            "reliable": summary.get("total_aid_allocations", 0) >= 30,
            "by_season": table.to_dict(orient="records"),
        })

    @beta_tool
    def what_drives_losses(state: str, crop: str) -> str:
        """Pearson correlation of each model input with yield vs trend, over all reported county-seasons.

        Args:
            state: Two-letter state code: IA, NE, CA or DE.
            crop: CORN, SOYBEANS, WHEAT or SORGHUM.
        """
        state, crop, err = _check(state, crop, df)
        if err:
            return _dump({"error": err})
        return _dump(driver_correlations(df, state, crop))

    @beta_tool
    def data_coverage() -> str:
        """How many reported county-seasons exist per state and crop (check before comparing states or crops)."""
        rep = df[df["yield_status"] == "reported"]
        table = rep.groupby(["state_alpha", "crop"]).agg(
            reported_county_seasons=("fips", "count"), counties=("fips", "nunique"),
            first_year=("year", "min"), last_year=("year", "max"),
        ).reset_index()
        return _dump({"coverage": table.to_dict(orient="records"),
                      "status_counts": df["yield_status"].value_counts().to_dict()})

    return [rank_counties, county_details, validation_results, what_drives_losses, data_coverage]


class AdvisorUnavailable(Exception):
    """No Anthropic credential is configured, or the API rejected it."""


class Advisor:
    def __init__(self, df: pd.DataFrame):
        self.tools = make_tools(df)
        self._client = None

    def _get_client(self) -> anthropic.Anthropic:
        if self._client is None:
            try:
                self._client = anthropic.Anthropic()
            except anthropic.AnthropicError as e:   # raised when no credential can be resolved
                raise AdvisorUnavailable(str(e)) from e
        return self._client

    def ask(self, history: list[dict], question: str, context: dict) -> dict:
        """Answer one question. `history` is prior {role, content} text turns; `context` the dashboard settings."""
        settings = (
            f"[Dashboard settings: state={context.get('state', 'IA')}, crop={context.get('crop', 'CORN')}, "
            f"season={context.get('year', 2020)}, fund=${context.get('budget_m', 25)}M, quota={context.get('quota_pct', 15)}%]"
        )
        messages = [{"role": m["role"], "content": m["content"]} for m in history if m.get("content")]
        messages.append({"role": "user", "content": f"{settings}\n\n{question}"})

        runner = self._get_client().beta.messages.tool_runner(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            tools=self.tools,
            messages=messages,
            output_config={"effort": "low"},          # short chat answers; thinking stays adaptive
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",                       # re-run on a fallback model if a safety classifier declines
        )
        calls, final = [], None
        try:
            for message in runner:
                final = message
                calls += [{"tool": b.name, "input": b.input} for b in message.content if b.type == "tool_use"]
        except anthropic.AuthenticationError as e:
            raise AdvisorUnavailable("The Anthropic API key was rejected.") from e
        except TypeError as e:   # the SDK raises TypeError when no credential is configured at all
            if "authentication" not in str(e).lower():
                raise
            raise AdvisorUnavailable("No Anthropic API key is configured.") from e

        if final is None:
            return {"answer": "No response came back. Please try again.", "tools_used": calls}
        if final.stop_reason == "refusal":
            return {"answer": "The assistant declined to answer that question.", "tools_used": calls}
        text = "\n".join(b.text for b in final.content if b.type == "text").strip()
        return {"answer": text or "No answer was produced. Please rephrase the question.", "tools_used": calls}
