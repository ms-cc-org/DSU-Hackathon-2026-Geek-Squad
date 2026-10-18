"""
Shared evidence helpers used by both front ends (app.py and api_server.py).

- Project-wide constants for the validation design (train / test split, "severe loss").
- data_quality(): what a state-crop-year slice leaves out, and why.
- driver_correlations(): how strongly each model input tracks yield loss.
"""

import pandas as pd

# Validation design: rules are fixed on the training years, then scored blind on the test years.
TRAIN_YEARS = (2000, 2015)
TEST_YEARS = (2016, 2025)
SEVERE_THRESHOLD_PCT = -10.0   # a "real disaster" = yield at least 10% below the county trend
MIN_TEST_PICKS = 30            # fewer relief slots than this across the test years = too noisy to claim a win

# Model inputs, in the order the UI shows them
DRIVERS = [
    ("extreme_heat_days", "Extreme heat days (≥35°C)"),
    ("weeks_in_d2_plus", "Weeks in severe drought (D2+)"),
    ("mean_dsci", "Drought severity index (DSCI)"),
    ("precip_anomaly_pct", "Precipitation anomaly (%)"),
    ("aws_100cm_mm", "Soil water storage (AWS, mm)"),
]


def data_quality(df: pd.DataFrame, state: str, crop: str, year: int) -> dict:
    """Counts of what one state-crop-year slice includes and excludes (see data/data_dictionary.md)."""
    sl = df[(df["state_alpha"] == state) & (df["crop"] == crop) & (df["year"] == year)]
    status = sl["yield_status"].value_counts()
    reported = sl[sl["yield_status"] == "reported"]
    return {
        "county_rows": len(sl),
        "reported": int(status.get("reported", 0)),
        "not_reported": int(status.get("not_reported", 0)),   # NASS published nothing
        "suppressed": int(status.get("suppressed", 0)),       # planted, but no grain harvested
        # Reported yield but no trend anomaly -> the model counts no loss rather than guessing
        "no_trend_anomaly": int(reported["yield_anomaly_pct"].isna().sum()),
        "missing_heat": int(reported["extreme_heat_days"].isna().sum()),   # treated as 0 heat days
        "missing_soil": int(reported["aws_100cm_mm"].isna().sum()),       # filled with a typical 150 mm
    }


def driver_correlations(df: pd.DataFrame, state: str, crop: str) -> dict:
    """Pearson r between each model input and yield anomaly, over all reported county-years."""
    sub = df[
        (df["state_alpha"] == state) & (df["crop"] == crop)
        & (df["yield_status"] == "reported") & df["yield_anomaly_pct"].notna()
    ]
    if len(sub) < 10:
        return {"n": len(sub), "drivers": []}
    return {
        "n": len(sub),
        "year_min": int(sub["year"].min()),
        "year_max": int(sub["year"].max()),
        "drivers": [
            {"id": col, "label": label, "r": float(sub["yield_anomaly_pct"].corr(sub[col]))}
            for col, label in DRIVERS
        ],
    }
