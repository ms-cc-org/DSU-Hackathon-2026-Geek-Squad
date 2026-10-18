import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import DecisionSection from './components/DecisionSection.jsx';
import AnswerSection from './components/AnswerSection.jsx';
import WhySection from './components/WhySection.jsx';
import ProofSection from './components/ProofSection.jsx';
import ReportCardSection from './components/ReportCardSection.jsx';
import LimitsSection from './components/LimitsSection.jsx';
import RationaleModal from './components/RationaleModal.jsx';
import Footer from './components/Footer.jsx';
import { StatusPanel } from './components/Status.jsx';
import { apiUrl, useApi } from './lib/api.js';

// One page that reads in pitch order: decision -> answer -> why -> proof -> county -> limits.
export default function App() {
  const [stateCode, setStateCode] = useState('IA');
  const [crop, setCrop] = useState('CORN');
  const [year, setYear] = useState(2020);
  const [budgetM, setBudgetM] = useState(25);
  const [quotaPct, setQuotaPct] = useState(15);
  const [fips, setFips] = useState(null);
  const [mathOpen, setMathOpen] = useState(false);

  const options = useApi(apiUrl('options'));
  const params = { state: stateCode, crop, year, budget: budgetM * 1e6, quota: quotaPct, sort: 'urgency' };
  const ranking = useApi(apiUrl('ranking', params));
  const validation = useApi(apiUrl('validation', { state: stateCode, crop, quota: quotaPct }));
  const geo = useApi(apiUrl('geojson', { state: stateCode }));

  const rows = ranking.data?.rows;
  useEffect(() => {
    if (rows?.length && !rows.some((r) => r.fips === fips)) setFips(rows[0].fips);
  }, [rows, fips]);

  const ctx = {
    stateCode,
    stateLabel: options.data?.states.find((s) => s.code === stateCode)?.label ?? stateCode,
    crop,
    year,
    budgetM,
    quotaPct,
  };

  // Clicking a county anywhere loads it into the report card and scrolls there.
  const openCounty = (f) => {
    setFips(f);
    document.getElementById('county')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeState = (code) => {
    setStateCode(code);
    const crops = options.data?.states.find((s) => s.code === code)?.crops ?? [];
    setCrop(crops.includes('CORN') ? 'CORN' : crops[0]);
    setFips(null);
  };

  let body;
  if (options.error) {
    body = <StatusPanel tone="error" title="Cannot reach the data API" detail={`${options.error}. Start it from the repo root with: python api_server.py`} />;
  } else if (!options.data || !ranking.data) {
    body = <StatusPanel title="Loading the 26-year county dataset…" />;
  } else if (ranking.error) {
    body = <StatusPanel tone="error" title="The priority model failed" detail={ranking.error} />;
  } else {
    const r = ranking.data;
    const active = r.rows?.find((x) => x.fips === fips) ?? r.rows?.[0];
    body = (
      <>
        <DecisionSection ctx={ctx} />
        {r.empty ? (
          <StatusPanel
            tone="warning"
            title={`NASS published no ${crop.toLowerCase()} yields for ${ctx.stateLabel} in ${year}.`}
            detail="Nothing to rank for this year. Pick another year or crop; Iowa and Nebraska corn and soybeans have the fullest records."
          />
        ) : (
          <>
            <AnswerSection ctx={ctx} ranking={r} geo={geo} activeFips={active.fips} onOpenCounty={openCounty} />
            <WhySection ctx={ctx} validation={validation} />
            <ProofSection ctx={ctx} validation={validation} />
            <ReportCardSection ctx={ctx} row={active} rows={r.rows} onSelect={setFips} onShowMath={() => setMathOpen(true)} />
            <LimitsSection ctx={ctx} ranking={r} csvUrl={apiUrl('ranking.csv', params)} onOpenCounty={openCounty} />
            <RationaleModal open={mathOpen} row={active} ranking={r} onClose={() => setMathOpen(false)} />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Header
        options={options.data}
        stateCode={stateCode}
        onStateChange={changeState}
        crop={crop}
        onCropChange={(c) => {
          setCrop(c);
          setFips(null);
        }}
        year={year}
        onYearChange={setYear}
        budgetM={budgetM}
        onBudgetChange={setBudgetM}
        quotaPct={quotaPct}
        onQuotaChange={setQuotaPct}
        loading={ranking.loading || validation.loading}
      />
      <main className="w-full pt-32 bg-surface">{body}</main>
      <Footer dataset={options.data?.dataset} />
    </>
  );
}
