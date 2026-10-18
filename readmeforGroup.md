# 🌾 State Drought Assistance & Priority Targeting System  (`readmeforGroup.md`)

**DSU Hackathon 2026 | Team Geek Squad**  
*Last Updated: Sunday, October 18, 2026. All numbers below were re-checked against the live app (Iowa corn, $25M fund, 15% quota unless stated).*

> **Judges:** our project write-up is this file. The top-level `README.md` is the organizers' original challenge brief, kept unchanged.

---

## Quick Start (for judges)

**Try it live:** https://ms-cc-org.github.io/DSU-Hackathon-2026-Geek-Squad/
(The API runs on a free server that sleeps when idle; the first load can take 30–60 seconds.)

**Our task in one sentence:** A **state drought program administrator** needs to decide **which counties get emergency drought relief first, and what score triggers it**, by **mid-August, before harvest surveys exist**. Our tool shows them a ranked, mapped list of counties with a dollar amount for each, and a blind test on 2016–2025 showing the ranking picks real disasters more often than rainfall, the Drought Monitor, or random picks.

**Run it yourself** (Python 3.11+, Node 18+):
```bash
git clone https://github.com/ms-cc-org/DSU-Hackathon-2026-Geek-Squad.git
cd DSU-Hackathon-2026-Geek-Squad
python3 -m venv .venv && source .venv/bin/activate      # Windows: py -m venv .venv; .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..    # build the dashboard once
python api_server.py                                     # open http://localhost:8000
```
* **Optional AI chat ("Ask the data"):** create a file named `.env` in the repo root containing `ANTHROPIC_API_KEY=<your key>`, then restart `python api_server.py`. Every other page works without a key.
* **No Node?** `streamlit run app.py` (http://localhost:8501) runs the Streamlit version of the same dashboard, built on the same model code.
* **How to use it:** pick a state, crop, season, fund size and quota at the top, then follow the pages with the **Next** button: 1 The decision → 2 Who gets relief → 3 Why → 4 Does it work? → 5 County report card → 6 Limits & data → Ask the data.

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
11. [AI Disclosure](#11-ai-disclosure)

---

## 1. Executive Summary

* **The Problem**: When extreme summer droughts strike agricultural states (Iowa, Nebraska), farmers face catastrophic financial ruin. Federal USDA disaster relief checks (ERP/WHIP+) take **12 to 18 months** to process and arrive. State Departments of Agriculture have emergency funds (**$25M–$50M**) to issue immediate bridge relief, but relief decisions are bottlenecked by delayed post-harvest surveys and subjective political lobbying.
* **The Decision**: Which counties receive emergency state funding first, and what transparent, data-driven threshold triggers that assistance in August before harvest surveys are completed?
* **Our Solution**: An interactive **React dashboard** (backed by a Python API; a Streamlit version is kept as a backup) powered by a **Drought Urgency Index (1 to 10)** that integrates atmospheric heat, drought persistence, and the underground "soil sponge." It automatically sorts counties into Action Tiers (` Tier 1 Immediate Relief`, `️ Tier 2 Monitoring`, ` Tier 3 Resilient`) and rations the emergency fund proportionally to the hardest-hit farming communities.
* **The Empirical Proof**: The scoring rules are fixed in code and tested blind on **10 unseen modern seasons (2016–2025)**. Its picks were real severe yield crashes **20.7% of the time** (23 of 111 relief slots), ahead of the drought monitor alone (18.0%), pure rainfall deficit (15.3%) and random allocation (8.8%). That is a **1.35× lift over rainfall** in Iowa corn (Nebraska corn: **22.6% vs 17.0%, 1.33×**). The edge over the drought monitor is small (23 vs 20 hits), and we say so.

---

## 2. The 4 Mandatory Pitch Questions

Every judge and mentor will evaluate our project against these four exact questions:

| # | Question | Our Answer |
|---|---|---|
| **Q1** | **Who is your user?** | A **State Drought Program Administrator** (e.g., Iowa Department of Agriculture & Land Stewardship or Nebraska Department of Natural Resources). |
| **Q2** | **What do they decide?** | **Which counties receive emergency drought relief checks first**, and how much aid to disburse from a **$25M state relief fund** before post-harvest survey numbers are published. |
| **Q3** | **What evidence did you use?** | A multi-layered synthesis of **26 years of USDA NASS yields, NOAA ACIS daily temperatures, USDM weekly drought indices, and NRCS SSURGO soil hydrology**. We prove that rainfall alone is misleading (+0.13 correlation with yield anomaly) and replace it with **Extreme Heat Days (≥35°C, −0.52 corr)**, **Drought Duration (weeks in D2+, −0.37 corr)**, and the **Soil Sponge (Available Water Storage `aws_100cm_mm`)**. |
| **Q4** | **How do you know it works?** | We ran an **out-of-sample 10-year blind test**. The scoring rules are fixed, and we scored them on the years **2016–2025** against what the harvest actually showed. Across the test years our model scored **23 hits vs 17 for rainfall** (20.7% vs 15.3% precision; drought monitor 18.0%, random 8.8%). In the high-stress seasons (2020, 2022, 2023) it caught **20 disasters vs 15 for rainfall maps**. |

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
> * **Tama County, IA**: 148,200 acres, yield −32.4% = **$44.7 Million** lost, but urgency score only 1.5 (rank #59), so **no drought relief**. Its loss was not drought-driven: Tama was in the path of the August 2020 derecho windstorm. See the Q&A below.

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

* **Weights**: fixed constants in `src/priority_model.py` (0.30 heat, 0.30 weeks in D2+, 0.25 DSCI, 0.15 rain deficit, up to 25% soil discount). Nothing is fitted to the test years. The code labels **2000–2015** as the training window, but it doesn't fit anything on it; be accurate about this if asked (see section 9).
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
  * 2020: **11 of 15** picks were severe-loss counties (rainfall alone: 9). 2022: **4 of 8**, vs 3 for rainfall and 2 for the drought monitor. 2023: **5 of 8**, vs 4 for the drought monitor and 3 for rainfall.
  * 2018: 6 counties had severe losses and **every method caught 0**. Those losses didn't follow the drought signals, so no drought score catches them. Check the 2018 rows before naming a cause.
  * Nebraska corn, same test: **22.6%** (model, 24 hits) vs 17.9% (DSCI) vs 17.0% (rain) vs 14.1% (random), a 1.33x lift. Not every season wins: in Nebraska 2022 rainfall alone caught 9 and our model only 3.
* **Ties at the cutoff:** scores show one decimal, so several counties can share the last funded score (e.g. Story, Polk, Webster and Adair all at 3.7 in 2020). Ties are broken by the unrounded score, which uses only August data, then by FIPS code, so every computer gives the same ranking. Ties are never broken by dollar loss, which isn't known until harvest.
* ⚠️ These numbers move if anyone changes weights in `priority_model.py` or the quota slider. Section 4 "Does it work?" always shows the live values, so read numbers off the app before presenting.

---

## 6. Codebase Architecture & File Guide

```
DSU-Hackathon-2026-Geek-Squad/
├── api_server.py                # JSON API for the React app (stdlib only); also serves frontend/dist
├── frontend/                    # React + Vite + Tailwind dashboard (the demo UI)
│   └── src/
│       ├── App.jsx              # Shared controls + page switcher (one page per pitch step, "Next" buttons)
│       ├── lib/api.js           # fetch helpers (GET /api/*, POST /api/chat); every number comes from the API
│       └── components/          # Header (page tabs), Decision, Ranking & map, Why, Validation, Report Card, Limits,
│                                #   AdvisorView.jsx = the "Ask the data" chat page
├── app.py                       # Streamlit version: one page in pitch order (who/decision banner → answer → why → proof → report card → limits)
├── requirements.txt             # Dependencies (streamlit, plotly, pandas, scikit-learn, anthropic, python-dotenv)
├── .env                         # NOT committed (git-ignored). Holds ANTHROPIC_API_KEY for the AI chat
├── requirements-api.txt         # Slim deps for the hosted API (Render)
├── render.yaml                  # Render blueprint: hosts api_server.py
├── .github/workflows/pages.yml  # Builds frontend/ and publishes it to GitHub Pages
├── readmeforGroup.md            # THIS FILE: Master briefing & cheat sheet
├── src/
│   ├── data_loader.py           # Loads parquet files and counties.geojson
│   ├── priority_model.py        # Urgency scoring, economic losses, relief allocation, validation
│   ├── advisor.py               # "Ask the data" assistant: Claude + read-only tools over the model
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
* **Pages (tabs at the top):** 1 The decision → 2 Who gets relief → 3 Why → 4 Does it work? → 5 County report card → 6 Limits & data, plus **Ask the data** (AI assistant). Each page has a "Next" button, so the demo can walk straight through the pitch.
* **Ask the data (AI chatbot):** answers plain-English questions by calling our own model functions as tools (`src/advisor.py`), so its numbers match the dashboard, and it says "the data can't answer that" for field-level, irrigation, other-state or post-2025 questions. It needs an Anthropic API key:
  ```bash
  echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # repo root; .env is git-ignored, never commit it
  python api_server.py
  ```
  Without a key, every other page works, and the chat shows these setup steps.

#### ⚠️ "Ask the data" failing? Troubleshooting
**Status (Oct 18):** the chat works on the live site (key set on Render). All 5 tools it uses (`rank_counties`,
`county_details`, `validation_results`, `what_drives_losses`, `data_coverage`) were tested directly against the dataset.
Running locally, it only works once *your* `.env` has a real key; without one, the server answers with HTTP 503.

| What you see in the chat | Cause | Fix |
|---|---|---|
| Server won't start: `ModuleNotFoundError: No module named 'anthropic'` | Running conda `(base)` Python instead of the project `.venv` | `conda deactivate && source .venv/bin/activate`, then `python api_server.py` (or `pip install -r requirements.txt` in whatever env you use) |
| "No Anthropic API key is configured…" | No `.env` file / no `ANTHROPIC_API_KEY` | Create `.env` in the repo root (see above), then **restart** `python api_server.py` |
| "The Anthropic API key was rejected." | Typo, revoked key, or a key with no credits | Get a new key at console.anthropic.com, update `.env`, restart |
| "The assistant is unavailable right now (RateLimitError / APIConnectionError…)" | Rate limit, outage, or no internet (venue Wi-Fi) | Wait and retry; check the server terminal for the full error |
| "HTTP 501" or "HTTP 404" | An **old** `api_server.py` process from before the chat was added is still running | Stop it (Ctrl+C) and start it again |
| "Failed to fetch" | `api_server.py` isn't running (or `npm run dev` without the API on :8000) | Start `python api_server.py` |

* The key is read **only at startup** (`load_dotenv` in `api_server.py`), so you must restart the server after editing `.env`.
* `export ANTHROPIC_API_KEY=sk-ant-...` in the same terminal works too, instead of a `.env` file.
* Quick check without the UI:
  ```bash
  python -c "from api_server import chat; print(chat({'question': 'Which counties get relief?', 'context': {}}))"
  ```
  `(200, {...answer...})` means it works; `(503, ...)` means the key is still missing.
* **Demo backup:** if the venue Wi-Fi is down, the chat can't reach the API. Skip the AI page; all other pages run offline.
* Editing the UI? Keep `python api_server.py` running and run `npm run dev` in `frontend/` (http://localhost:5173, `/api` is proxied).

### 4. Live Website: GitHub Pages (UI) + Render (API)
GitHub Pages only hosts static files, so the Python API runs on Render and the Pages site calls it.
```
Browser → https://ms-cc-org.github.io/DSU-Hackathon-2026-Geek-Squad/   (React UI, GitHub Pages)
            └─ fetch → https://drought-relief-api.onrender.com/api/*   (api_server.py, Render)
```
**One-time setup (needs repo admin):**
1. **Render (API):** render.com → sign in with GitHub → **New → Blueprint** → pick this repo (it reads `render.yaml`).
   When asked, paste the real `ANTHROPIC_API_KEY`. Wait for the deploy, then copy the service URL
   (e.g. `https://drought-relief-api.onrender.com`) and check `<url>/api/options` returns JSON.
2. **GitHub repo variable:** Settings → Secrets and variables → Actions → **Variables** → New: `API_URL` = the Render URL (no trailing slash).
3. **GitHub Pages:** Settings → Pages → Source: **GitHub Actions**.
4. Push to `main` (or Actions → "Deploy frontend to GitHub Pages" → Run workflow). The site URL appears in the workflow run.

**Things to know:**
* **Free Render services sleep after ~15 min idle;** the first request then takes ~30–60 s. Open the site a few minutes before the demo to wake it.
* The API only answers browsers from origins listed in `CORS_ORIGINS` (`render.yaml`: `https://ms-cc-org.github.io`). If the site moves (fork, custom domain), add that origin in the Render dashboard.
* The chat endpoint is public, so anyone with the URL can spend API credits. **Set a monthly spend limit** on the key in console.anthropic.com.
* Local dev is unchanged: with no `VITE_API_BASE`, the UI calls `/api` on the same server.

---

## 8. Team Work-Split & Phased Deliverables

### Checkpoint 2 (Saturday 6:00 PM) Requirements:
* [x] Core data pipeline loaded without errors.
* [x] First version runs and displays real results on screen.
* [x] Ranked CSV generated using the model: `data/processed/county_priority_rankings_2020.csv`.

### Current Status (Sunday, Oct 18):
* [x] React dashboard split into pitch-order pages (tabs + "Next" buttons) instead of one long scroll.
* [x] Streamlit and React dashboards show the same numbers (both call `src/priority_model.py`).
* [x] "Ask the data" AI assistant built: `src/advisor.py` (Claude + 5 read-only tools), `POST /api/chat` in `api_server.py`, `AdvisorView.jsx` page.
* [x] **Live:** UI on GitHub Pages, API on Render with the key set there. Checked: site loads, API answers, chat answered a 2020 Iowa question correctly.
* [ ] Each presenter: test the chat questions, including the "can't answer" one (farm field near Ames). Running locally needs your own `.env` key.
* [ ] **Submit by 12:00 PM ET:** open the submission issue with all members and the full 40-character SHA of the final commit (`git rev-parse HEAD`).
* [ ] Fill in the "Team to confirm" items in section 11 (AI Disclosure).

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
  * The app has one page per pitch step (tabs at the top + "Next" buttons): 1 Decision → 2 Who gets relief → 3 Why → 4 Does it work? → 5 County report card → 6 Limits & data → Ask the data (AI).
  * Test the "Ask the data" page once the API key is in `.env` (answers should quote the same numbers as the dashboard).
  * Verify the map toggle ("Our August pick" vs "What the harvest showed"), clicking a county → report card, the "Show the math" popup, and the CSV download.
  * Spot-check a thin state (Delaware): the page should say there's too little data rather than claim a win.
  * After any UI change, run `npm run build` in `frontend/` so `python api_server.py` serves the latest version.

#### 👤 Person 3: Validation & Visual Proof Specialist
* **Primary Files**: `src/priority_model.py` (Validation functions) & section 4 "Does it work?"
* **Tasks**:
  * Be ready to walk judges through the out-of-sample scoreboard table (2016–2025).
  * Memorize the benchmark metrics: **20.7% precision vs 15.3% for rainfall (1.35x), 23 vs 17 hits** (drought monitor 18.0%, 20 hits; random 8.8%).
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

### Q: "How did you choose the weights? What did you do with 2000–2015?"
> **Answer**: *"We ranked the inputs by how strongly each one tracks yield loss, and gave the strongest ones the most weight. Heat days have the strongest link (r = −0.52), so heat gets 0.30. Weeks in severe drought (−0.37) also get 0.30, and drought severity (−0.36) gets 0.25. Rainfall is weakest (+0.13), so it gets only 0.15. The four add up to 1. Soil water storage has almost no link on its own (≈0), but deep soil protects crops in a drought, so it doesn't add to the score: it discounts it by up to 25%. Then we froze the weights and tested them blind on 2016–2025."*
>
> **How the code computes it (`urgency_components()` in `src/priority_model.py`)**, if a judge wants detail:
> 1. Each input is scaled to 0–1 against a fixed cap: heat days ÷ 15, weeks in D2+ ÷ 20, DSCI ÷ 500, rainfall shortfall ÷ 50%. Only *below-average* rain counts; a wet season adds nothing. Fixed caps mean a score means the same thing every year.
> 2. Hazard = 0.30 × heat + 0.30 × weeks in D2+ + 0.25 × DSCI + 0.15 × rain shortfall (0 to 1).
> 3. Soil buffer = the county's water storage ÷ the 95th percentile of the counties being scored (capped at 1). Net urgency = hazard × (1 − 0.25 × soil buffer).
> 4. Score = 1 + 9 × net urgency, rounded to one decimal (1 = no stress, 10 = maximum).
> 5. Missing values: missing heat, drought or rain counts as 0 (no stress); missing soil data is treated as 150 mm, about an average Midwest soil.
>
> **Be accurate if pressed:** the weights are set by hand, not fitted by an algorithm, and the code doesn't fit anything on 2000–2015. The correlations that guided the ordering (page 3) use all 26 years, including the test years. What the blind test proves is that these frozen weights beat rainfall alone, the drought monitor alone and random picks on 2016–2025.

### Q: "In 2018 six counties had severe losses and you caught none. Why?"
> **Answer**: *"No method did: rainfall, the drought monitor and our score all scored zero that year. Those losses didn't follow drought signals, so a drought fund shouldn't be paying for them, and we don't hide it."* (Check the 2018 rows before naming a cause.)

### Q: "Your model loses some seasons. Why trust it?"
> **Answer**: *"It's not perfect, and the page shows every season. In Nebraska 2022 rainfall alone caught 9 disasters and we caught 3. Over all ten test years it wins in both states: 23 hits vs 17 for rainfall in Iowa, 24 vs 18 in Nebraska. An administrator can see exactly where it's strong and where it isn't."*

### Q: "Did you use AI?"
> **Answer**: *"Yes, and it's disclosed in section 11 of our team README: what for, which parts, and how we checked it. The in-app assistant only quotes numbers it gets from our own model functions."*

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

---

## 11. AI Disclosure

The hackathon allows AI use and requires us to disclose it. This section lists what we know; **team members must add or correct anything under "Team to confirm" before submitting.**

### Tools used
| Tool | Used for |
|---|---|
| **Gemini** (Google) | Brainstorming: ideas and approaches for the project. |
| **Antigravity** (Google's AI coding tool) | The first part of the project: getting the Streamlit app and the initial code working, before we switched to Claude Code. |
| **Claude** (Anthropic) | Turning our raw notes into these team notes (`readmeforGroup.md`). |
| **Claude Code** (Anthropic, model Claude Opus 5.5) | Coding assistant for the later work (details below). |
| **Claude API** (model `claude-opus-5-5`) | Runs inside the app: the "Ask the data" assistant (`src/advisor.py`). |

### What Claude Code wrote or changed (Oct 17–18)
* **"Ask the data" fixes and server setup:** diagnosed the chat failures (missing API key, wrong Python environment) and added the troubleshooting table in section 7.
* **Hosting:** `render.yaml`, `requirements-api.txt`, `.github/workflows/pages.yml`, CORS and host settings in `api_server.py`, and the API address setting in `frontend/src/lib/api.js` and `frontend/vite.config.js`.
* **UI:** centered the Next button on the first page (`frontend/src/App.jsx`); clean "Server stopped." message on Ctrl+C.
* **Model fix:** ties at the funding cutoff are now broken by the unrounded score, then FIPS code (`_top_first()` in `src/priority_model.py`). Before, the blind-test result differed between computers (19.8% on the hosted server, 20.7% on a laptop) and ties on the dashboard were broken by dollar loss, which isn't known in August. The blind test also scores each season on its own, exactly like the dashboard.
* **Docs:** sections of this file (troubleshooting, deployment steps, status, Quick Start, this disclosure) and the number corrections in sections 1, 2, 5 and 8.

### How the in-app assistant works
* It never sees the raw dataset. It answers only by calling five read-only Python functions that run the same model code as the dashboard (`rank_counties`, `county_details`, `validation_results`, `what_drives_losses`, `data_coverage`), so its numbers match the screen.
* It is told to say "The data can't answer that" for field-level, irrigation, other-state or post-2025 questions, and to warn when a sample is small.
* The API key is kept in `.env` (git-ignored) locally and in Render's settings when hosted; it is never committed.

### How we verified AI-written work
* Ran each of the assistant's five functions directly against the dataset and checked their output.
* Tested the hosted API (site loads, API answers, cross-site requests allowed only from our GitHub Pages site) and asked the live chat a 2020 Iowa question: its answer (15 of 95 counties, trigger score 3.7) matches the dashboard.
* Rebuilt the frontend after every UI change and checked the result in a screenshot.
* Re-pulled every headline number in this file from the live app on Oct 18 rather than trusting earlier notes.

### Team to confirm
* [ ] Add how we checked the Antigravity-built code (e.g. ran the Streamlit app, compared its numbers with the React dashboard).
* [ ] Confirm which tool wrote `src/advisor.py` and the React pages, and add any other AI tool used (e.g. for the slides).
* [ ] Every member can explain and change any part of the code during judging (required by the briefing).

