"""
JSON API for the React frontend (frontend/).

Every number the frontend shows comes from the same functions app.py (Streamlit)
uses: allocate_relief_budget, evaluate_out_of_sample_validation and
get_county_report_card. Nothing is recomputed in JavaScript.

Standard library only, no extra dependencies:
    python api_server.py            # http://localhost:8000

If frontend/dist exists (npm run build), it is served at / as well, so one
command runs the whole dashboard. During frontend development run
`npm run dev` in frontend/; Vite proxies /api to this server.
"""

from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import json
import math
import os
import sys

import numpy as np
import pandas as pd

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.data_loader import load_master, load_counties
from src.priority_model import (
    allocate_relief_budget,
    evaluate_out_of_sample_validation,
    urgency_components,
    COMMODITY_PRICES,
)
from src.report_card import get_county_report_card

DIST_DIR = _ROOT / "frontend" / "dist"

# Same choices as the Streamlit sidebar
STATES = {"IA": "Iowa", "NE": "Nebraska", "CA": "California", "DE": "Delaware"}
SORT_MODES = {"urgency", "dollar_loss", "yield_loss"}
TRAIN_YEARS = (2000, 2015)
TEST_YEARS = (2016, 2025)
SEVERE_THRESHOLD_PCT = -10.0

print("Loading master dataset...")
DF = load_master()
GEOJSON = load_counties()
print(f"  {len(DF):,} rows loaded")


# ── Helpers ──────────────────────────────────────────────────────────────────
def _clean(value):
    """Make numpy / pandas values JSON-safe (NaN -> None)."""
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(value, np.bool_):
        return bool(value)
    if value is pd.NA or value is pd.NaT:
        return None
    return value


def _records(df: pd.DataFrame) -> list[dict]:
    return [_clean(r) for r in df.to_dict(orient="records")]


def _tier_number(label: str) -> int:
    return 1 if "Tier 1" in label else 2 if "Tier 2" in label else 3


def _pct(text: str) -> float:
    return float(str(text).replace("%", ""))


class ApiError(Exception):
    pass


def _param(q, name, default=None, cast=str):
    raw = q.get(name, [None])[0]
    if raw is None or raw == "":
        if default is None:
            raise ApiError(f"missing parameter: {name}")
        return default
    try:
        return cast(raw)
    except ValueError:
        raise ApiError(f"bad value for {name}: {raw}")


def _state_crop(q):
    state = _param(q, "state", "IA").upper()
    if state not in STATES:
        raise ApiError(f"unknown state: {state}")
    crop = _param(q, "crop", "CORN").upper()
    return state, crop


# ── Endpoint logic ───────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def options():
    states = []
    for code, label in STATES.items():
        crops = sorted(DF[DF["state_alpha"] == code]["crop"].unique())
        states.append({"code": code, "label": label, "crops": crops})
    years = sorted(int(y) for y in DF["year"].unique())
    return {
        "states": states,
        "years": years,
        "default_year": 2020 if 2020 in years else years[-1],
        "train_years": TRAIN_YEARS,
        "test_years": TEST_YEARS,
        "prices": COMMODITY_PRICES,
        "budget_m": {"min": 5, "max": 100, "step": 5, "default": 25},
        "quota_pct": {"min": 5, "max": 30, "step": 5, "default": 15},
        "dataset": {
            "rows": len(DF),
            "counties": int(DF["fips"].nunique()),
            "year_min": years[0],
            "year_max": years[-1],
        },
    }


@lru_cache(maxsize=512)
def ranking(state, crop, year, budget, quota_pct, sort_by):
    ranked = allocate_relief_budget(
        df=DF,
        state_alpha=state,
        crop=crop,
        year=year,
        relief_budget=budget,
        top_k_pct=quota_pct / 100.0,
        sort_by=sort_by,
    )
    base = {
        "state": state, "crop": crop, "year": year, "budget": budget,
        "quota_pct": quota_pct, "sort_by": sort_by,
        "price_per_bushel": COMMODITY_PRICES.get(crop, 4.75),
        "is_test_year": TEST_YEARS[0] <= year <= TEST_YEARS[1],
    }
    if ranked.empty:
        return {**base, "empty": True, "rows": [], "summary": None}

    # Score breakdown for the rationale view (same slice, so same 95th-pct soil cap)
    comps = urgency_components(ranked)
    ranked = pd.concat([ranked, comps], axis=1)
    ranked["tier"] = ranked["action_tier"].map(_tier_number)

    # Summary metrics: identical to the four st.metric cards in app.py
    tier1 = ranked[ranked["action_tier"].str.contains("Tier 1")]
    tier1_count = len(tier1)
    tier1_loss = float(tier1["estimated_dollar_loss"].sum())
    summary = {
        "total_counties": len(ranked),
        "tier1_count": tier1_count,
        "tier2_count": int((ranked["tier"] == 2).sum()),
        "tier3_count": int((ranked["tier"] == 3).sum()),
        "total_loss": float(ranked["estimated_dollar_loss"].sum()),
        "avg_tier1_loss_pct": tier1["yield_anomaly_pct"].mean(),
        "avg_aid_per_county": float(tier1["recommended_relief_usd"].mean()) if tier1_count > 0 else 0.0,
        "tier1_total_loss": tier1_loss,
        "tier1_acres": float(tier1["acres_harvested"].fillna(0).sum()),
        "allocated_total": float(ranked["recommended_relief_usd"].sum()),
        # Share of Tier 1 losses the fund covers; > 1 means the fund exceeds losses
        "tier1_coverage": budget / tier1_loss if tier1_loss > 0 else None,
        "allocation_basis": "dollar_loss" if tier1_loss > 0 else "urgency_x_acres",
        "severe_counties": int((ranked["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT).sum()),
        "severe_threshold_pct": SEVERE_THRESHOLD_PCT,
    }

    cols = [
        "rank", "fips", "county_name", "urgency_score", "action_tier", "tier",
        "recommended_relief_usd", "estimated_dollar_loss", "yield_anomaly_pct",
        "yield_per_acre", "trend_yield", "bushel_deficit_per_acre", "total_bushels_lost",
        "acres_harvested", "acres_planted",
        "extreme_heat_days", "weeks_in_d2_plus", "mean_dsci", "max_drought_severity",
        "precip_mm", "precip_anomaly_pct", "tavg_c", "aws_100cm_mm", "droughty_pct",
        *comps.columns,
    ]
    return {**base, "empty": False, "summary": _clean(summary), "rows": _records(ranked[cols])}


def ranking_csv(state, crop, year, budget, quota_pct, sort_by):
    # Same columns as the Streamlit "Export Relief Action Ledger (CSV)" button
    ranked = allocate_relief_budget(
        df=DF, state_alpha=state, crop=crop, year=year, relief_budget=budget,
        top_k_pct=quota_pct / 100.0, sort_by=sort_by,
    )
    return ranked.to_csv(index=False)


@lru_cache(maxsize=128)
def quota_sweep(state, crop, year, budget, sort_by):
    """Tier 1 size and payouts for every quota on the slider (5%-30%)."""
    out = []
    o = options()["quota_pct"]
    for pct in range(o["min"], o["max"] + 1, o["step"]):
        r = ranking(state, crop, year, budget, pct, sort_by)
        if r["empty"]:
            continue
        s = r["summary"]
        t1 = [row for row in r["rows"] if row["tier"] == 1]
        out.append({
            "quota_pct": pct,
            "tier1_count": s["tier1_count"],
            "tier1_total_loss": s["tier1_total_loss"],
            "avg_aid_per_county": s["avg_aid_per_county"],
            "min_check": min(row["recommended_relief_usd"] for row in t1),
            "max_check": max(row["recommended_relief_usd"] for row in t1),
            "tier1_coverage": s["tier1_coverage"],
            "tier1_severe_hits": sum(
                1 for row in t1
                if row["yield_anomaly_pct"] is not None and row["yield_anomaly_pct"] <= SEVERE_THRESHOLD_PCT
            ),
        })
    return {"state": state, "crop": crop, "year": year, "budget": budget, "sort_by": sort_by, "sweep": out}


@lru_cache(maxsize=128)
def validation(state, crop, quota_pct):
    table, summary = evaluate_out_of_sample_validation(
        df=DF,
        train_years=TRAIN_YEARS,
        test_years=TEST_YEARS,
        crop=crop,
        state_alpha=state,
        top_k_pct=quota_pct / 100.0,
        severe_threshold_pct=SEVERE_THRESHOLD_PCT,
    )
    ok = summary.get("status") != "insufficient_data" and not table.empty
    strategies = None
    if ok:
        # Parsed exactly as app.py does for its bar chart
        strategies = [
            {"id": "model", "label": "Proposed Model (Heat + Drought + Soil)", "precision_pct": _pct(summary["model_precision"])},
            {"id": "dsci", "label": "Pure Drought Monitor (DSCI alone)", "precision_pct": _pct(summary["dsci_precision"])},
            {"id": "rain", "label": "Pure Rainfall Deficit (Precip alone)", "precision_pct": _pct(summary["rain_precision"])},
            {"id": "random", "label": "Random County Allocation", "precision_pct": _pct(summary["random_precision"])},
        ]
        active = table[table["actual_severe_counties"] > 0]
        summary = {
            **summary,
            "model_hits": int(active["model_urgency_hits"].sum()),
            "rain_hits": int(active["rain_deficit_hits"].sum()),
            "dsci_hits": int(active["pure_dsci_hits"].sum()),
            "random_hits": float(active["random_expected_hits"].sum()),
        }
    return {
        "state": state, "crop": crop, "quota_pct": quota_pct,
        "train_years": TRAIN_YEARS, "test_years": TEST_YEARS,
        "severe_threshold_pct": SEVERE_THRESHOLD_PCT,
        "ok": ok, "summary": _clean(summary), "strategies": strategies,
        "table": _records(table),
        "correlations": driver_correlations(state, crop),
    }


DRIVERS = [
    ("extreme_heat_days", "Extreme heat days (≥35°C)"),
    ("weeks_in_d2_plus", "Weeks in severe drought (D2+)"),
    ("mean_dsci", "Drought severity index (DSCI)"),
    ("precip_anomaly_pct", "Precipitation anomaly (%)"),
    ("aws_100cm_mm", "Soil water storage (AWS, mm)"),
]


@lru_cache(maxsize=32)
def driver_correlations(state, crop):
    """Pearson r between each model input and yield anomaly, all reported county-years."""
    sub = DF[
        (DF["state_alpha"] == state) & (DF["crop"] == crop)
        & (DF["yield_status"] == "reported") & DF["yield_anomaly_pct"].notna()
    ]
    if len(sub) < 10:
        return {"n": len(sub), "drivers": []}
    drivers = [
        {"id": col, "label": label, "r": sub["yield_anomaly_pct"].corr(sub[col])}
        for col, label in DRIVERS
    ]
    years = sub["year"]
    return _clean({"n": len(sub), "year_min": years.min(), "year_max": years.max(), "drivers": drivers})


@lru_cache(maxsize=16)
def counties(state, crop):
    # Same list as the Tab 3 county selector in app.py
    sub = DF[(DF["state_alpha"] == state) & (DF["crop"] == crop) & (DF["yield_status"] == "reported")]
    if sub.empty:
        sub = DF[DF["state_alpha"] == state]
    rows = sub[["fips", "county_name"]].drop_duplicates("fips").sort_values("county_name")
    return {"state": state, "crop": crop, "counties": _records(rows)}


@lru_cache(maxsize=512)
def report_card(fips, crop):
    card = get_county_report_card(DF, fips=fips, crop=crop)
    if not card:
        return {"fips": fips, "crop": crop, "empty": True}
    history = card.pop("history_df")
    return {**_clean(card), "empty": False, "history": _records(history)}


@lru_cache(maxsize=8)
def geojson(state):
    feats = [f for f in GEOJSON["features"] if f["properties"].get("state_alpha") == state]
    return {"type": "FeatureCollection", "features": feats}


# ── HTTP plumbing ────────────────────────────────────────────────────────────
def route(path, q):
    if path == "/api/options":
        return options()
    if path == "/api/geojson":
        state, _ = _state_crop(q)
        return geojson(state)
    if path == "/api/counties":
        return counties(*_state_crop(q))
    if path == "/api/report-card":
        _, crop = _state_crop(q)
        return report_card(_param(q, "fips"), crop)
    if path == "/api/validation":
        state, crop = _state_crop(q)
        return validation(state, crop, _param(q, "quota", 15, int))
    if path in ("/api/ranking", "/api/ranking.csv", "/api/quota-sweep"):
        state, crop = _state_crop(q)
        year = _param(q, "year", 2020, int)
        budget = _param(q, "budget", 25_000_000, float)
        sort_by = _param(q, "sort", "urgency")
        if sort_by not in SORT_MODES:
            raise ApiError(f"unknown sort: {sort_by}")
        if path == "/api/quota-sweep":
            return quota_sweep(state, crop, year, budget, sort_by)
        quota = _param(q, "quota", 15, int)
        if path == "/api/ranking.csv":
            return ranking_csv(state, crop, year, budget, quota, sort_by)
        return ranking(state, crop, year, budget, quota, sort_by)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            # Static frontend build (single-page app: unknown paths -> index.html)
            if not DIST_DIR.exists():
                return self._send(404, "text/plain", b"frontend/dist not built - run `npm run build` in frontend/")
            if not (DIST_DIR / url.path.lstrip("/")).is_file():
                self.path = "/index.html"
            return super().do_GET()
        q = parse_qs(url.query)
        try:
            result = route(url.path, q)
        except ApiError as e:
            return self._send(400, "application/json", json.dumps({"error": str(e)}).encode())
        except Exception as e:  # surface model errors to the UI instead of a dropped connection
            self.log_error("error on %s: %r", self.path, e)
            return self._send(500, "application/json", json.dumps({"error": f"{type(e).__name__}: {e}"}).encode())
        if result is None:
            return self._send(404, "application/json", b'{"error": "not found"}')
        if isinstance(result, str):
            state, crop = _state_crop(q)
            name = f"{state}_{crop}_{_param(q, 'year', 2020, int)}_relief_priorities.csv"
            return self._send(200, "text/csv", result.encode("utf-8"), {"Content-Disposition": f'attachment; filename="{name}"'})
        self._send(200, "application/json", json.dumps(result, allow_nan=False).encode())

    def _send(self, code, ctype, body, headers=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Drought relief API on http://localhost:{port}  (frontend: {'served' if DIST_DIR.exists() else 'not built'})")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
