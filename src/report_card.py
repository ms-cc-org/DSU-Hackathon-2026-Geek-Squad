"""
County Agricultural Report Card Generator

Computes a comprehensive profile for any selected county:
1. Soil Water Storage & Resilience (aws_100cm_mm, droughty_pct, nccpi_crop).
2. Historical Drought Frequency (number of D2+ seasons since 2000).
3. Drought Vulnerability Gap (yield anomaly in drought seasons vs. normal seasons).
4. 26-year historical time series of climate stress and yield responses.
"""

from pathlib import Path
import sys
import numpy as np
import pandas as pd

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def get_county_report_card(df: pd.DataFrame, fips: str, crop: str = "CORN") -> dict:
    """
    Builds a structured report card dictionary for a single county and crop.
    """
    county_df = df[
        (df["fips"] == fips) &
        (df["crop"] == crop)
    ].sort_values("year").copy()

    if county_df.empty:
        return {}

    latest_row = county_df.iloc[-1]
    county_name = latest_row["county_name"]
    state_alpha = latest_row["state_alpha"]

    # 1. Soil Properties
    aws = float(latest_row["aws_100cm_mm"]) if pd.notna(latest_row["aws_100cm_mm"]) else 150.0
    droughty = float(latest_row["droughty_pct"]) if pd.notna(latest_row["droughty_pct"]) else 0.0
    nccpi = float(latest_row["nccpi_crop"]) if pd.notna(latest_row["nccpi_crop"]) else 0.50

    # Soil Sponge rating
    if aws >= 180:
        sponge_grade = "Deep Sponge (High Buffer)"
    elif aws >= 140:
        sponge_grade = "Moderate Sponge (Average Buffer)"
    else:
        sponge_grade = "Shallow / Drought-Prone (Low Buffer)"

    # 2. Historical Drought Exposure (2000-2025)
    reported = county_df[county_df["yield_status"] == "reported"].copy()
    total_years_recorded = len(reported)

    d2_years = int((county_df["weeks_in_d2_plus"] > 0).sum())
    d2_frequency_pct = round((d2_years / len(county_df)) * 100, 1) if len(county_df) > 0 else 0.0
    peak_dsci = float(county_df["mean_dsci"].max()) if pd.notna(county_df["mean_dsci"].max()) else 0.0
    worst_drought_year = int(county_df.loc[county_df["mean_dsci"].idxmax(), "year"]) if peak_dsci > 0 else None

    # 3. Drought Vulnerability Gap (Drought vs. Normal seasons)
    # Drought season defined as mean_dsci >= 100 or weeks_in_d2_plus >= 2
    drought_mask = (reported["mean_dsci"] >= 100) | (reported["weeks_in_d2_plus"] >= 2)
    drought_yields = reported.loc[drought_mask, "yield_anomaly_pct"]
    normal_yields = reported.loc[~drought_mask, "yield_anomaly_pct"]

    avg_drought_anomaly = float(drought_yields.mean()) if len(drought_yields) > 0 else 0.0
    avg_normal_anomaly = float(normal_yields.mean()) if len(normal_yields) > 0 else 0.0
    drought_impact_gap = round(avg_normal_anomaly - avg_drought_anomaly, 1)

    # 4. Summary metrics
    avg_yield = float(reported["yield_per_acre"].mean()) if len(reported) > 0 else 0.0
    min_yield = float(reported["yield_per_acre"].min()) if len(reported) > 0 else 0.0
    max_yield = float(reported["yield_per_acre"].max()) if len(reported) > 0 else 0.0

    return {
        "fips": fips,
        "county_name": county_name,
        "state_alpha": state_alpha,
        "crop": crop,
        "years_recorded": total_years_recorded,
        # Soil
        "aws_100cm_mm": round(aws, 1),
        "droughty_pct": round(droughty, 1),
        "nccpi_crop": round(nccpi, 3),
        "sponge_grade": sponge_grade,
        # Drought History
        "d2_plus_years": d2_years,
        "d2_frequency_pct": d2_frequency_pct,
        "peak_dsci": round(peak_dsci, 1),
        "worst_drought_year": worst_drought_year,
        # Loss Profile
        "avg_yield_bu_acre": round(avg_yield, 1),
        "min_yield_bu_acre": round(min_yield, 1),
        "max_yield_bu_acre": round(max_yield, 1),
        "avg_drought_anomaly_pct": round(avg_drought_anomaly, 1),
        "avg_normal_anomaly_pct": round(avg_normal_anomaly, 1),
        "drought_impact_gap_pct": drought_impact_gap,
        # Historical Data Table
        "history_df": county_df[[
            "year", "yield_per_acre", "yield_anomaly_pct", "mean_dsci",
            "weeks_in_d2_plus", "extreme_heat_days", "precip_anomaly_pct"
        ]].copy()
    }


if __name__ == "__main__":
    from src.data_loader import load_master
    df_all = load_master()
    card = get_county_report_card(df_all, fips="19149", crop="CORN")  # Plymouth County, IA
    print(f"Report card for {card['county_name']} ({card['fips']}):")
    print(f"  Soil Sponge: {card['aws_100cm_mm']} mm -> {card['sponge_grade']}")
    print(f"  Drought Frequency: {card['d2_plus_years']} seasons ({card['d2_frequency_pct']}%)")
    print(f"  Avg Drought Loss Gap: -{card['drought_impact_gap_pct']}% below normal")
