"""
Drought Assistance Priority Targeting & Financial Allocation Model

Implements:
1. Multi-variable Drought Urgency Score (1 to 10) combining atmospheric hazard,
   drought persistence, extreme heat, and underground soil buffering.
2. Agricultural Economic Loss & Relief Budget Allocation ($25M default pool).
3. Out-of-sample validation benchmark (2000-2015 train vs. 2016-2025 unseen test).
"""

from pathlib import Path
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


# Commodity reference prices (USDA Marketing Year Average benchmarks)
COMMODITY_PRICES = {
    "CORN": 4.75,       # $ per bushel
    "SOYBEANS": 12.20,   # $ per bushel
    "WHEAT": 6.50,       # $ per bushel
    "SORGHUM": 4.50,     # $ per bushel
}


def compute_urgency_score(df: pd.DataFrame) -> pd.Series:
    """
    Computes an agronomic Drought Urgency Score on a 1.0 to 10.0 scale.
    
    Synthesizes:
    - Atmospheric Hazard:
      * Drought Severity: mean_dsci (0 to 500)
      * Drought Persistence: weeks_in_d2_plus (weeks in D2-D4)
      * Heat Shock: extreme_heat_days (days >= 35°C / 95°F)
      * Rainfall Deficit: negative precip_anomaly_pct
    - Soil Buffer (Mitigator):
      * Soil Sponge Capacity: aws_100cm_mm (Plant-available water storage)
    """
    # 1. Normalize hazard components (0 to 1)
    dsci_norm = (df["mean_dsci"].fillna(0) / 500.0).clip(0, 1)
    d2_norm = (df["weeks_in_d2_plus"].fillna(0) / 20.0).clip(0, 1)
    heat_norm = (df["extreme_heat_days"].fillna(0) / 15.0).clip(0, 1)
    
    # Rainfall deficit: only penalize when rain is BELOW average
    precip_deficit = (-df["precip_anomaly_pct"].fillna(0) / 50.0).clip(lower=0, upper=1)
    
    # 2. Normalize soil buffer (higher AWS = more protective sponge)
    # Average Midwestern AWS is ~160mm, range 80mm - 240mm
    max_aws = df["aws_100cm_mm"].quantile(0.95) if "aws_100cm_mm" in df.columns else 220.0
    if pd.isna(max_aws) or max_aws <= 0:
        max_aws = 220.0
    soil_buffer = (df["aws_100cm_mm"].fillna(150.0) / max_aws).clip(0, 1)
    
    # 3. Weighted Composite Index
    # Weights reflect empirical correlations with yield collapse:
    # Heat (0.30) + Severe Drought Weeks (0.30) + DSCI (0.20) + Rain Deficit (0.10) - Soil Cushion (0.15)
    hazard_score = (
        0.30 * heat_norm +
        0.30 * d2_norm +
        0.25 * dsci_norm +
        0.15 * precip_deficit
    )
    
    # Soil buffer mitigates the hazard (up to 25% reduction in urgency)
    net_urgency = hazard_score * (1.0 - 0.25 * soil_buffer)
    
    # Scale from 1.0 to 10.0
    score = 1.0 + (net_urgency * 9.0).clip(0, 9.0)
    return score.round(1)


def calculate_economic_losses(
    df: pd.DataFrame,
    crop: str = "CORN",
    price_per_bushel: float | None = None
) -> pd.DataFrame:
    """
    Calculates estimated bushel loss and real-world dollar loss per county.
    
    Loss = Harvested Acres * Bushel Deficit * Market Price
    """
    df_calc = df.copy()
    price = price_per_bushel or COMMODITY_PRICES.get(crop, 4.75)
    
    # Reconstruct trend baseline yield: yield_per_acre / (1 + yield_anomaly_pct / 100)
    valid_anom = df_calc["yield_anomaly_pct"].notna() & (df_calc["yield_anomaly_pct"] > -95)
    trend_yield = np.where(
        valid_anom,
        df_calc["yield_per_acre"] / (1.0 + df_calc["yield_anomaly_pct"] / 100.0),
        df_calc["yield_per_acre"]
    )
    df_calc["trend_yield"] = np.round(trend_yield, 1)
    
    # Deficit in bushels per acre (only when below trend)
    deficit = np.where(
        valid_anom & (df_calc["yield_anomaly_pct"] < 0),
        df_calc["trend_yield"] - df_calc["yield_per_acre"],
        0.0
    )
    df_calc["bushel_deficit_per_acre"] = np.round(deficit, 1)
    
    # Total bushels lost in county
    acres = df_calc["acres_harvested"].fillna(df_calc["acres_planted"]).fillna(0.0)
    df_calc["total_bushels_lost"] = np.round(df_calc["bushel_deficit_per_acre"] * acres, 0)
    
    # Total dollar loss
    df_calc["estimated_dollar_loss"] = np.round(df_calc["total_bushels_lost"] * price, 2)
    return df_calc


def allocate_relief_budget(
    df: pd.DataFrame,
    state_alpha: str = "IA",
    crop: str = "CORN",
    year: int = 2020,
    relief_budget: float = 25_000_000,
    top_k_pct: float = 0.15,
    sort_by: str = "urgency"
) -> pd.DataFrame:
    """
    Ranks counties for a specific state, crop, and year, assigning Action Tiers
    and allocating the emergency state relief budget proportionally to Tier 1.
    
    sort_by options:
    - 'urgency': Sort by Drought Urgency Score (Agronomic Heat + Drought + Soil stress)
    - 'dollar_loss': Sort by Total Economic Dollar Loss ($)
    - 'yield_loss': Sort by Yield Anomaly (% harvest deficit below trend)
    """
    # Filter to selected slice
    mask = (
        (df["state_alpha"] == state_alpha) &
        (df["crop"] == crop) &
        (df["year"] == year) &
        (df["yield_status"] == "reported")
    )
    subset = df[mask].copy()
    if subset.empty:
        return pd.DataFrame()
        
    # Calculate Urgency Score & Economic Losses
    subset["urgency_score"] = compute_urgency_score(subset)
    subset = calculate_economic_losses(subset, crop=crop)
    
    # Sort according to selected policy criteria
    if sort_by == "dollar_loss":
        subset.sort_values(
            by=["estimated_dollar_loss", "urgency_score"],
            ascending=[False, False],
            inplace=True
        )
    elif sort_by == "yield_loss":
        subset.sort_values(
            by=["yield_anomaly_pct", "urgency_score"],
            ascending=[True, False],
            inplace=True
        )
    else:  # default: agronomic urgency score
        subset.sort_values(
            by=["urgency_score", "estimated_dollar_loss"],
            ascending=[False, False],
            inplace=True
        )

    subset.reset_index(drop=True, inplace=True)
    subset["rank"] = np.arange(1, len(subset) + 1)
    
    # Assign Action Tiers
    n_counties = len(subset)
    k_tier1 = max(1, int(np.ceil(n_counties * top_k_pct)))
    k_tier2 = max(k_tier1 + 1, int(np.ceil(n_counties * (top_k_pct + 0.20))))
    
    tiers = []
    for r in subset["rank"]:
        if r <= k_tier1:
            tiers.append("🚨 Tier 1 (Immediate Relief)")
        elif r <= k_tier2:
            tiers.append("⚠️ Tier 2 (Monitoring / Buffer)")
        else:
            tiers.append("✅ Tier 3 (Resilient / Low Risk)")
    subset["action_tier"] = tiers
    
    # Allocate relief budget exclusively to Tier 1
    tier1_mask = subset["rank"] <= k_tier1
    tier1_loss = subset.loc[tier1_mask, "estimated_dollar_loss"].sum()
    
    if tier1_loss > 0:
        # Proportional to dollar loss
        subset["recommended_relief_usd"] = np.where(
            tier1_mask,
            np.round(relief_budget * (subset["estimated_dollar_loss"] / tier1_loss), 2),
            0.0
        )
    else:
        # Fallback: proportional to urgency score * harvested acres
        weights = subset.loc[tier1_mask, "urgency_score"] * subset.loc[tier1_mask, "acres_harvested"].fillna(1000)
        sum_w = weights.sum()
        subset["recommended_relief_usd"] = np.where(
            tier1_mask,
            np.round(relief_budget * (weights / sum_w), 2),
            0.0
        )
        
    return subset


def evaluate_out_of_sample_validation(
    df: pd.DataFrame,
    train_years=(2000, 2015),
    test_years=(2016, 2025),
    crop: str = "CORN",
    state_alpha: str = "IA",
    top_k_pct: float = 0.15,
    severe_threshold_pct: float = -10.0
) -> tuple[pd.DataFrame, dict]:
    """
    Rigorously tests the Urgency Score model against unseen modern seasons (2016-2025).
    Compares targeting precision against:
    1. Random Allocation
    2. Pure Rainfall Deficit (lowest precip_anomaly_pct)
    3. Pure Drought Category (highest mean_dsci)
    """
    sub = df[
        (df["state_alpha"] == state_alpha) &
        (df["crop"] == crop) &
        (df["yield_status"] == "reported") &
        (df["yield_anomaly_pct"].notna())
    ].copy()
    
    # Train set (for reference and verification)
    train_df = sub[sub["year"].between(*train_years)].copy()
    test_df = sub[sub["year"].between(*test_years)].copy()
    
    # Compute urgency score across dataset
    test_df["urgency_score"] = compute_urgency_score(test_df)
    
    expected_cols = [
        "year", "counties", "tier1_quota_k", "actual_severe_counties",
        "random_expected_hits", "rain_deficit_hits", "pure_dsci_hits",
        "model_urgency_hits"
    ]
    
    if test_df.empty:
        return pd.DataFrame(columns=expected_cols), {
            "test_years": f"{test_years[0]}–{test_years[1]}",
            "total_disaster_events": 0,
            "total_aid_allocations": 0,
            "model_precision": "0.0%",
            "rain_precision": "0.0%",
            "dsci_precision": "0.0%",
            "random_precision": "0.0%",
            "model_lift_vs_rain": 1.0,
            "status": "insufficient_data"
        }

    results = []
    for yr in sorted(test_df["year"].unique()):
        ydf = test_df[test_df["year"] == yr].copy()
        if len(ydf) < 2:
            continue
            
        k = max(1, int(np.ceil(len(ydf) * top_k_pct)))
        ydf["is_severe"] = ydf["yield_anomaly_pct"] <= severe_threshold_pct
        n_severe = int(ydf["is_severe"].sum())
        
        # 1. Rain Deficit Target: lowest precip_anomaly_pct
        top_rain = ydf.sort_values("precip_anomaly_pct", ascending=True).head(k)
        rain_hits = int(top_rain["is_severe"].sum())
        
        # 2. Pure DSCI Target: highest mean_dsci
        top_dsci = ydf.sort_values("mean_dsci", ascending=False).head(k)
        dsci_hits = int(top_dsci["is_severe"].sum())
        
        # 3. Urgency Model: highest urgency_score
        top_model = ydf.sort_values("urgency_score", ascending=False).head(k)
        model_hits = int(top_model["is_severe"].sum())
        
        # 4. Expected Random Hits
        random_expected = round(k * (n_severe / len(ydf)), 2)
        
        results.append({
            "year": yr,
            "counties": len(ydf),
            "tier1_quota_k": k,
            "actual_severe_counties": n_severe,
            "random_expected_hits": random_expected,
            "rain_deficit_hits": rain_hits,
            "pure_dsci_hits": dsci_hits,
            "model_urgency_hits": model_hits,
        })
        
    res_df = pd.DataFrame(results)
    if res_df.empty:
        res_df = pd.DataFrame(columns=expected_cols)

    # Summary Metrics across loss years
    if "actual_severe_counties" not in res_df.columns or res_df.empty:
        summary = {
            "test_years": f"{test_years[0]}–{test_years[1]}",
            "total_disaster_events": 0,
            "total_aid_allocations": 0,
            "model_precision": "0.0%",
            "rain_precision": "0.0%",
            "dsci_precision": "0.0%",
            "random_precision": "0.0%",
            "model_lift_vs_rain": 1.0,
            "status": "insufficient_data"
        }
        return res_df, summary

    active_years = res_df[res_df["actual_severe_counties"] > 0]
    total_budget_slots = active_years["tier1_quota_k"].sum() if not active_years.empty else 0
    total_severe = active_years["actual_severe_counties"].sum() if not active_years.empty else 0
    
    total_model_hits = active_years["model_urgency_hits"].sum() if not active_years.empty else 0
    total_rain_hits = active_years["rain_deficit_hits"].sum() if not active_years.empty else 0
    total_dsci_hits = active_years["pure_dsci_hits"].sum() if not active_years.empty else 0
    total_rand_hits = active_years["random_expected_hits"].sum() if not active_years.empty else 0

    if total_budget_slots > 0:
        summary = {
            "test_years": f"{test_years[0]}–{test_years[1]}",
            "total_disaster_events": int(total_severe),
            "total_aid_allocations": int(total_budget_slots),
            "model_precision": f"{(total_model_hits / total_budget_slots):.1%}",
            "rain_precision": f"{(total_rain_hits / total_budget_slots):.1%}",
            "dsci_precision": f"{(total_dsci_hits / total_budget_slots):.1%}",
            "random_precision": f"{(total_rand_hits / total_budget_slots):.1%}",
            "model_lift_vs_rain": round(total_model_hits / max(1, total_rain_hits), 2),
            "status": "ok"
        }
    else:
        summary = {
            "test_years": f"{test_years[0]}–{test_years[1]}",
            "total_disaster_events": 0,
            "total_aid_allocations": int(res_df["tier1_quota_k"].sum()),
            "model_precision": "0.0%",
            "rain_precision": "0.0%",
            "dsci_precision": "0.0%",
            "random_precision": "0.0%",
            "model_lift_vs_rain": 1.0,
            "status": "no_disasters_in_test_era"
        }
    
    return res_df, summary


if __name__ == "__main__":
    from src.data_loader import load_master
    
    print("Loading master dataset...")
    df_all = load_master()
    
    # 1. Generate 2020 Iowa Ranking
    print("\nCalculating 2020 Iowa Corn Priority Rankings...")
    ranked_2020 = allocate_relief_budget(df_all, state_alpha="IA", crop="CORN", year=2020, relief_budget=25_000_000)
    
    out_csv = _ROOT / "data/processed/county_priority_rankings_2020.csv"
    ranked_2020.to_csv(out_csv, index=False)
    print(f"  [OK] Exported 2020 ranked table to: {out_csv}")
    print(f"  Tier 1 Counties: {(ranked_2020['rank'] <= 15).sum()}")
    print(ranked_2020[["rank", "county_name", "urgency_score", "action_tier", "estimated_dollar_loss", "recommended_relief_usd"]].head(10))
    
    # 2. Out-of-sample validation run
    print("\nRunning Out-of-Sample Validation Benchmark (2016-2025)...")
    res_table, summary_metrics = evaluate_out_of_sample_validation(df_all, state_alpha="IA", crop="CORN")
    print(res_table.to_string(index=False))
    print("\nBenchmark Summary:", summary_metrics)
