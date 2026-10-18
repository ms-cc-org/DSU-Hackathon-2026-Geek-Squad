# 🌾 State Drought Assistance & Priority Targeting System | update readme as we go 
## Team Notes & Project Briefing Sheet (`readmeforGroup.md`)
**DSU Hackathon 2026 | Team Geek Squad**  
*Last Updated: Saturday, October 17, 2026. All numbers below were regenerated from the current `src/priority_model.py` (Iowa corn, $25M fund, 15% quota unless stated).*

---

## Table of Contents
1. [Executive Summary (The 60-Second Elevator Pitch)](#1-executive-summary)
2. [The 4 Mandatory Pitch Questions](#2-the-4-mandatory-pitch-questions)
3. [Agronomic Logic: Why Rainfall Maps Fail (The 3 Clues)](#3-agronomic-logic-why-rainfall-maps-fail)
4. [The Financial & Economic Model ($)](#4-the-financial--economic-model)
5. [Out-of-Sample Validation: The 10-Year "Time Machine" Proof](#5-out-of-sample-validation-the-10-year-time-machine-proof)
6. [Codebase Architecture & File Guide](#6-codebase-architecture--file-guide)
7. [How to Run the App (React Frontend + Streamlit)](#7-how-to-run-the-app-react-frontend--streamlit)
8. [Team Work-Split & Phased Deliverables (6:00 PM Checkpoint & Sunday)](#8-team-work-split--phased-deliverables)
9. [Judge Q&A Cheat Sheet (Bulletproof Answers)](#9-judge-qa-cheat-sheet)
10. [Data Sources & Official Federal Citations](#10-data-sources--official-federal-citations)

---

## 1. Executive Summary

* **The Problem**: When extreme summer droughts strike agricultural states (Iowa, Nebraska), farmers face catastrophic financial ruin. Federal USDA disaster relief checks (ERP/WHIP+) take **12 to 18 months** to process and arrive. State Departments of Agriculture have emergency funds (**$25M–$50M**) to issue immediate bridge relief, but relief decisions are bottlenecked by delayed post-harvest surveys and subjective political lobbying.
* **The Decision**: Which counties receive emergency state funding first, and what transparent, data-driven threshold triggers that assistance in August before harvest surveys are completed?
* **Our Solution**: An interactive **React dashboard** (backed by a Python API; a Streamlit version is kept as a backup) powered by a **Drought Urgency Index (1 to 10)** that integrates atmospheric heat, drought persistence, and the underground "soil sponge." It automatically sorts counties into Action Tiers (` Tier 1 Immediate Relief`, `️ Tier 2 Monitoring`, ` Tier 3 Resilient`) and rations the emergency fund proportionally to the hardest-hit farming communities.
* **The Empirical Proof**: Trained strictly on **2000–2015** data and tested blind on **10 unseen modern seasons (2016–2025)**. It caught severe yield crashes with **20.7% precision**, outperforming the drought monitor alone (18.0%), pure rainfall deficit (15.3%) and random allocation (8.8%). That is a **1.35× lift over rainfall** in Iowa corn (Nebraska corn: **23.6% vs 17.0%, 1.39×**).

---

## 2. The 4 Mandatory Pitch Questions

Every judge and mentor will evaluate our project against these four exact questions:

| # | Question | Our Answer |
|---|---|---|
| **Q1** | **Who is your user?** | A **State Drought Program Administrator** (e.g., Iowa Department of Agriculture & Land Stewardship or Nebraska Department of Natural Resources). |
| **Q2** | **What do they decide?** | **Which counties receive emergency drought relief checks first**, and how much aid to disburse from a **$25M state relief fund** before post-harvest survey numbers are published. |
| **Q3** | **What evidence did you use?** | A multi-layered synthesis of **26 years of USDA NASS yields, NOAA ACIS daily temperatures, USDM weekly drought indices, and NRCS SSURGO soil hydrology**. We prove that rainfall alone is misleading (+0.13 correlation with yield anomaly) and replace it with **Extreme Heat Days (≥35°C, −0.52 corr)**, **Drought Duration (weeks in D2+, −0.37 corr)**, and the **Soil Sponge (Available Water Storage `aws_100cm_mm`)**. |
| **Q4** | **How do you know it works?** | We ran an **out-of-sample 10-year blind test**. We calibrated our model on **2000–2015**, locked the rules, and tested it on unseen years **2016–2025**. Across the test years our model scored **23 hits vs 17 for rainfall** (20.7% vs 15.3% precision). In the high-stress seasons (2020, 2022, 2023) it caught **20 disasters vs 15 for rainfall maps**. |

---

## 3. Agronomic Logic: Why Rainfall Maps Fail

### The "Rain Fallacy"
Most people assume: *Less Rain = Dead Crops*. 
In our dataset for Iowa Corn (Pearson r with `yield_anomaly_pct`, all 2,470 reported county-years 2000–2025; shown live in section 3 "Why these counties"):
* **Precipitation anomaly (`precip_anomaly_pct`): ONLY +0.13** (very weak).
* **Extreme Heat Days (`extreme_heat_days` ≥35°C / 95°F): −0.52** (about 4x stronger!).
* **Weeks in Severe Drought (`weeks_in_d2_plus`): −0.37**.
* **Drought severity (`mean_dsci`): −0.36**.
* **Soil sponge (`aws_100cm_mm`) on its own: ≈ 0.00**. It is a *modifier*, not a driver, which is why the model only uses it to discount hazard (by up to 25%).

### Why Rainfall Alone is Misleading:
1. **Timing (Pollination Shock)**: 4 inches of rain in May doesn't save a crop if July pollination experiences 95°F+ heatwaves with zero rain. High heat sterilizes corn pollen, causing kernel abort regardless of early spring moisture.
2. **The "Soil Sponge" Buffer (`aws_100cm_mm`)**: Plant-Available Water Storage in the top 100 cm of soil. 
   * **Deep Sponge (>180 mm)**: Rich soils hold weeks of moisture underground, allowing crops to survive a 3-week dry spell without yield loss.
   * **Shallow Sponge (<120 mm)**: Sandy/shallow soils dry out in 4 days, turning moderate drought into total harvest collapse.

### The Drought Urgency Score Formula (Scale: 1.0 to 10.0)
Located in [`src/priority_model.py`](file:///Users/jayflm/IdeaProjects/DSU-Hackathon-2026-Geek-Squad/src/priority_model.py):
$$\text{Hazard} = 0.30 \cdot \text{Heat}_{\text{norm}} + 0.30 \cdot D2\text{Weeks}_{\text{norm}} + 0.25 \cdot \text{DSCI}_{\text{norm}} + 0.15 \cdot \text{RainDeficit}_{\text{norm}}$$
$$\text{Net Urgency} = \text{Hazard} \times \left(1.0 - 0.25 \cdot \text{SoilBuffer}_{\text{norm}}\right)$$
$$\text{Urgency Score} = 1.0 + \left(\text{Net Urgency} \times 9.0\right) \quad \text{[Range: 1.0 to 10.0]}$$

---

## 4. The Financial & Economic Model ($)

The raw dataset provides physical units (harvested acres, bushels per acre). We bridge these physical numbers into real dollars using official **USDA Economic Research Service** benchmark prices:

### Commodity Market Prices
* **Corn**: **$4.75** / bushel (USDA 10-year Marketing Year Average baseline)
* **Soybeans**: **$12.20** / bushel
* **Wheat**: **$6.50** / bushel
* **Sorghum**: **$4.50** / bushel

### The 3-Step Dollar Loss Formula
1. **Reconstruct Trend Normal Yield**:
   $$\text{Trend Yield} = \frac{\text{yield\_per\_acre}}{1 + \left(\frac{\text{yield\_anomaly\_pct}}{100}\right)}$$
2. **Calculate Lost Bushels in County**:
   $$\text{Bushels Lost} = \left(\text{Trend Yield} - \text{Actual Yield}\right) \times \text{acres\_harvested}$$
3. **Calculate Total County Economic Damage ($)**:
   $$\text{Estimated Dollar Loss (\$)} = \text{Bushels Lost} \times \text{Price per Bushel}$$

> **Real Example (Iowa 2020 Drought)**:
> * Statewide Corn Loss: **12,322,800 harvested acres** suffered **$1,104,401,933** (Over **$1.10 Billion**) in lost corn revenue.
> * **Carroll County, IA**: 178,800 acres, yield −24.8% vs trend = **$42.2 Million** lost. Urgency rank #3 → relief check **$3,253,007** (the largest).
> * **Guthrie County, IA**: 104,300 acres, yield −19.7% = **$18.4 Million** lost. Urgency rank #1 (score 4.8) → relief check **$1,420,327**.
> * **Tama County, IA**: 148,200 acres, yield −32.4% = **$44.7 Million** lost, but urgency score only 1.5 (rank #58), so **no drought relief**. Its loss was not drought-driven: Tama was in the path of the August 2020 derecho windstorm. See the Q&A below.

### How Relief Money is Allocated
* **Budget Size**: State Emergency Agricultural Relief Fund default is **$25,000,000** (adjustable via the Emergency relief fund slider from $5M to $100M).
* **The Policy Rule**: Funds are **never diluted evenly** across all 99 counties (which gives an ineffective ~$250k check). Funds are **100% targeted to Tier 1 Priority Counties** (top 15% most urgent).
* **Payout Calculation**:
  $$\text{County Relief Check (\$)} = \$25,000,000 \times \left(\frac{\text{County Dollar Loss}}{\sum_{\text{Tier 1}} \text{Total Tier 1 Loss}}\right)$$
  * Result (2020): 15 Tier 1 counties lost **$324.4M** combined. The $25M fund covers **7.7%** of that, with checks from **$249,534 (Adair) to $3,253,007 (Carroll)**, averaging **$1,666,667**.
  * Widening the quota spreads the money thinner: at 30%, 29 counties average $862K. Drag the "Counties funded" slider in the app header to see this live.

---

## 5. Out-of-Sample Validation: The 10-Year "Time Machine" Proof

To satisfy **Rubric C3 (Data & Evidence)** and **C5 (Innovation)**, we evaluated our model on modern seasons it had never seen before:

* **Training Window (2000–2015)**: 16 historical seasons used to calibrate urgency weights and soil buffering relationships.
* **Holdout Test Window (2016–2025)**: 10 modern seasons evaluated completely blind.

### The Scoreboard on Unseen Modern Disasters (2016–2025):
Tested on Iowa Corn with Tier 1 = top 15% of counties ($K = \lceil 0.15 \times \text{counties} \rceil$, 11–15 per year). A *hit* = a picked county whose yield came in ≥10% below trend:

```
 year  counties  tier1_quota_k  actual_severe_counties  rain_deficit_hits  pure_dsci_hits  model_urgency_hits
 2016        99             15                       0                  0               0                   0
 2017        95             15                       2                  2               2                   2
 2018        93             14                       6                  0               0                   0
 2019        88             14                       1                  0               1                   1
 2020        95             15                      33                  9              11                  11
 2021        84             13                       1                  0               0                   0
 2022        97             15                       8                  3               2                   4
 2023        87             14                       8                  3               4                   5
 2024        73             11                       3                  0               0                   0
 2025        79             12                       0                  0               0                   0
```

### Benchmark Summary Across All Test Years:
Precision = hits ÷ relief slots, counted over years with at least one disaster (**111 slots, 62 disaster counties**):
* **Random County Guessing**: **8.8% Precision** (9.7 expected hits). Wasteful: misses 9 out of 10 disasters.
* **Naive Rainfall Deficit Alone**: **15.3% Precision** (17 hits). Tricked by deep soil sponges and misses heatwaves.
* **Pure Drought Monitor Category (DSCI)**: **18.0% Precision** (20 hits).
* **Our Urgency Model (Heat + Drought + Soil)**: **20.7% Precision** (**23 hits, top performer, 1.35x lift over rain**).
  * 2022 drought: our model hit **4 of 8** severe counties, double the drought monitor's 2. 2023: **5 of 8**, vs 4 for the drought monitor and 3 for rainfall.
  * Nebraska corn, same test: **23.6%** (model) vs 17.9% (DSCI) vs 17.0% (rain) vs 14.1% (random), a 1.39x lift.
* ⚠️ These numbers move if anyone changes weights in `priority_model.py` or the quota slider. Section 4 "Does it work?" always shows the live values, so read numbers off the app before presenting.

---

## 6. Codebase Architecture & File Guide

```
DSU-Hackathon-2026-Geek-Squad/
├── api_server.py                # JSON API for the React app (stdlib only); also serves frontend/dist
├── frontend/                    # React + Vite + Tailwind dashboard (the demo UI)
│   └── src/
│       ├── App.jsx              # Shared controls: state, crop, year, budget, quota, sort, selected county
│       ├── lib/api.js           # fetch helper; every number comes from /api/*
│       └── components/          # Ranking & map, Relief Allocation, Model Validation, County Report Card
├── app.py                       # Streamlit version: one page in pitch order (who/decision banner → answer → why → proof → report card → limits)
├── requirements.txt             # Dependencies (streamlit, plotly, pandas, scikit-learn)
├── readmeforGroup.md            # THIS FILE: Master briefing & cheat sheet
├── src/
│   ├── data_loader.py           # Loads parquet files and counties.geojson
│   ├── priority_model.py        # Urgency scoring, economic losses, relief allocation, validation
│   ├── insights.py              # Shared evidence helpers: data-quality counts, driver correlations, test design constants
│   └── report_card.py           # Generates 26-year single-county agronomic report cards
└── data/
    ├── master_dataset.parquet   # 21-column master dataset (2000-2025)
    ├── counties.geojson         # Geographic polygon boundaries for choropleth maps
    └── processed/
        └── county_priority_rankings_2020.csv  # Checkpoint 2 exported ranking ledger
```

---

## 7. How to Run the App (React Frontend + Streamlit)

### 1. Activate Environment & Run the Model Standalone:
```bash
# Activate your venv
source .venv/bin/activate

# Run the priority model test & generate the 2020 CSV
python src/priority_model.py

# Test the county report card generator
python src/report_card.py
```

### 2. Launch the Streamlit App:
```bash
streamlit run app.py
```
* Open your browser to: `http://localhost:8501`

### 3. Launch the React Frontend (demo UI):
The React app in `frontend/` gets every number from `api_server.py`, which calls the same
`priority_model.py` / `report_card.py` functions as Streamlit. Nothing is hard-coded in the UI.
```bash
# One-time: build the UI
cd frontend && npm install && npm run build && cd ..

# Serve API + built UI together
python api_server.py
```
* Open your browser to: `http://localhost:8000`
* Editing the UI? Keep `python api_server.py` running and run `npm run dev` in `frontend/` (http://localhost:5173, `/api` is proxied).

---

## 8. Team Work-Split & Phased Deliverables

### Checkpoint 2 (Saturday 6:00 PM) Requirements:
* [x] Core data pipeline loaded without errors.
* [x] First version runs and displays real results on screen.
* [x] Ranked CSV generated using the model: `data/processed/county_priority_rankings_2020.csv`.

### Work-Split by Team Member:

#### 👤 Person 1: Financial & Priority Model Lead
* **Primary Files**: `src/priority_model.py`
* **Tasks**:
  * Ensure the Drought Urgency Index weights reflect physical agronomic correlations.
  * Verify the dollar loss equation: $\text{Acres} \times \text{Deficit} \times \text{Price}$.
  * Confirm CSV exports cleanly for any selected year and state.

#### 👤 Person 2: Streamlit Dashboard & UI Lead
* **Primary Files**: `frontend/src/` (React UI), `api_server.py`; `app.py` (Streamlit backup)
* **Tasks**:
  * Test the controls (State, Crop, Year, Budget slider, Tier 1 quota, Rank by).
  * The app is one page that follows the pitch: 1 Decision → 2 Who gets relief → 3 Why → 4 Does it work? → 5 County report card → 6 Limits & data.
  * Verify the map toggle ("Our August pick" vs "What the harvest showed"), clicking a county → report card, the "Show the math" popup, and the CSV download.
  * Spot-check a thin state (Delaware): the page should say there's too little data rather than claim a win.
  * After any UI change, run `npm run build` in `frontend/` so `python api_server.py` serves the latest version.

#### 👤 Person 3: Validation & Visual Proof Specialist
* **Primary Files**: `src/priority_model.py` (Validation functions) & section 4 "Does it work?"
* **Tasks**:
  * Be ready to walk judges through the out-of-sample scoreboard table (2016–2025).
  * Memorize the benchmark metrics: **20.7% precision vs 15.3% for rainfall (1.35x), 23 vs 17 hits**.
  * Highlight the 2020, 2022, and 2023 case study years during the demo.

#### 👤 Person 4: Pitch Deck, Demo & Narrative Lead
* **Primary Files**: Slide Deck & Pitch Script
* **Tasks**:
  * Build the 6 pitch slides answering the 4 mandatory evaluation questions.
  * Rehearse the live 5-minute presentation and 2-minute live demo (React app at `http://localhost:8000`; Streamlit as backup).
  * Lead team responses during the 3-minute judge Q&A session.

---

## 9. Judge Q&A Cheat Sheet (Bulletproof Answers)

### Q: "Why didn't you just predict exact bushels with a complex neural network or XGBoost?"
> **Answer**: *"A state official is distributing public taxpayer money and must defend every dollar to state auditors and farmers. A black-box neural net cannot be easily audited. Our Drought Urgency Index is transparent, physically interpretable, and directly links relief to measured agronomic facts—heat days, drought duration, and soil water storage."*

### Q: "Why did you prioritize Iowa and Nebraska over California?"
> **Answer**: *"Iowa and Nebraska represent contiguous rainfed agricultural heartlands with complete, unbroken 26-year records across 190+ counties. California agriculture is almost 100% irrigated, meaning artificial water access masks natural climate shocks and distorts soil buffer measurements."*

### Q: "How is this helpful if the data is historical?"
> **Answer**: *"All inputs in our model—weekly USDM drought classifications, NOAA daily heat spikes, and SSURGO soil storage—are available in real time during the growing season. By validating that this formula works across 10 unseen modern years, state officials can run this dashboard on August 15 and issue relief declarations months before harvest surveys are published."*

### Q: "Tama County lost $44.7M in 2020. Why doesn't it get any relief?"
> **Answer**: *"Because this fund is for drought, and Tama's loss wasn't drought-driven. Its urgency score is only 1.5: few heat days and little time in severe drought. The August 2020 derecho windstorm flattened crops across that part of Iowa. A drought fund that paid out on any loss would mostly be paying for wind damage, which crop insurance and federal disaster programs cover. Our score separates the two."*

### Q: "Can I check any number on the screen?"
> **Answer**: *"Yes. Click any county, then 'Show the math behind this score & check'. It shows every input, weight and step for the score, the dollar loss and the relief check. The same values are in the exported CSV."*

### Q: "Where did the dollar loss figures come from?"
> **Answer**: *"The raw dataset gives physical units: harvested acres and bushels per acre. We converted those physical losses into real dollars by calculating each county's bushel deficit against its 26-year trend line and multiplying by the official USDA Marketing Year Average price ($4.75/bu for corn)."*

---

## 10. Data Sources & Official Federal Citations

### Federal Commodity Prices & Farm Revenue:
* **[USDA NASS Agricultural Prices Reports](https://www.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Prices/)**: Marketing Year Average prices received by farmers.
* **[USDA Quick Stats Database](https://quickstats.nass.usda.gov/)**: Historical county and state acreage, yield, and production.
* **[USDA ERS Feed Grains Database](https://www.ers.usda.gov/data-products/feed-grains-database/)**: US corn and sorghum price supply and demand tables.

### Federal Disaster Relief Precedents:
* **[USDA Farm Service Agency Emergency Relief Program (ERP / WHIP+)](https://www.fsa.usda.gov/programs-and-services/disaster-assistance-program/emergency-relief-program/index)**: Authorized under Public Law 117-43 ($10B appropriation for crop loss).
* **[USDA Livestock Forage Disaster Program (LFP)](https://www.fsa.usda.gov/programs-and-services/disaster-assistance-program/livestock-forage/index)**: Federal relief triggered by USDM D2 (8 consecutive weeks) or D3/D4.

### Primary Master Dataset Federal Portals:
* **USDA NASS Quick Stats API**: [`https://quickstats.nass.usda.gov/api`](https://quickstats.nass.usda.gov/api)
* **NOAA ACIS (Applied Climate Information System)**: [`https://www.rcc-acis.org/docs_webservices.html`](https://www.rcc-acis.org/docs_webservices.html)
* **U.S. Drought Monitor (National Drought Mitigation Center)**: [`https://droughtmonitor.unl.edu/`](https://droughtmonitor.unl.edu/)
* **USDA NRCS SSURGO (Soil Data Access API)**: [`https://sdmdataaccess.nrcs.usda.gov/`](https://sdmdataaccess.nrcs.usda.gov/)
