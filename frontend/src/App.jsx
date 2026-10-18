import { useEffect, useState } from 'react';
import Header, { PAGES } from './components/Header.jsx';
import DecisionSection from './components/DecisionSection.jsx';
import AnswerSection from './components/AnswerSection.jsx';
import WhySection from './components/WhySection.jsx';
import ProofSection from './components/ProofSection.jsx';
import ReportCardSection from './components/ReportCardSection.jsx';
import LimitsSection from './components/LimitsSection.jsx';
import AdvisorView from './components/AdvisorView.jsx';
import RationaleModal from './components/RationaleModal.jsx';
import Footer from './components/Footer.jsx';
import Icon from './components/Icon.jsx';
import { StatusPanel } from './components/Status.jsx';
import { apiUrl, useApi } from './lib/api.js';

// One page per step of the pitch, in order: decision -> answer -> why -> proof -> county -> limits, plus "Ask the data".
export default function App() {
  const [page, setPage] = useState('decision');
  const [stateCode, setStateCode] = useState('IA');
  const [crop, setCrop] = useState('CORN');
  const [year, setYear] = useState(2020);
  const [budgetM, setBudgetM] = useState(25);
  const [quotaPct, setQuotaPct] = useState(15);
  const [fips, setFips] = useState(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [chat, setChat] = useState([]); // kept here so the conversation survives switching pages

  const options = useApi(apiUrl('options'));
  const params = { state: stateCode, crop, year, budget: budgetM * 1e6, quota: quotaPct, sort: 'urgency' };
  const ranking = useApi(apiUrl('ranking', params));
  const validation = useApi(apiUrl('validation', { state: stateCode, crop, quota: quotaPct }));
  const geo = useApi(apiUrl('geojson', { state: stateCode }));

  const rows = ranking.data?.rows;
  useEffect(() => {
    if (rows?.length && !rows.some((r) => r.fips === fips)) setFips(rows[0].fips);
  }, [rows, fips]);

  const go = (id) => {
    setPage(id);
    window.scrollTo({ top: 0 });
  };

  const ctx = {
    stateCode,
    stateLabel: options.data?.states.find((s) => s.code === stateCode)?.label ?? stateCode,
    crop,
    year,
    budgetM,
    quotaPct,
  };

  // Clicking a county anywhere opens its report card.
  const openCounty = (f) => {
    setFips(f);
    go('county');
  };

  const changeState = (code) => {
    setStateCode(code);
    const crops = options.data?.states.find((s) => s.code === code)?.crops ?? [];
    setCrop(crops.includes('CORN') ? 'CORN' : crops[0]);
    setFips(null);
  };

  const r = ranking.data;
  const active = r?.rows?.find((x) => x.fips === fips) ?? r?.rows?.[0];
  // Pages that need a ranked season can't render when NASS published no yields for it.
  const needsRanking = !['decision', 'why', 'proof', 'ask'].includes(page);

  let body;
  if (options.error) {
    body = <StatusPanel tone="error" title="Cannot reach the data API" detail={`${options.error}. Start it from the repo root with: python api_server.py`} />;
  } else if (!options.data || (needsRanking && !r)) {
    body = <StatusPanel title="Loading the 26-year county dataset…" />;
  } else if (needsRanking && ranking.error) {
    body = <StatusPanel tone="error" title="The priority model failed" detail={ranking.error} />;
  } else if (needsRanking && r.empty) {
    body = (
      <StatusPanel
        tone="warning"
        title={`NASS published no ${crop.toLowerCase()} yields for ${ctx.stateLabel} in ${year}.`}
        detail="Nothing to rank for this season. Pick another season or crop; Iowa and Nebraska corn and soybeans have the fullest records."
      />
    );
  } else {
    body = {
      decision: <DecisionSection ctx={ctx} />,
      answer: r && !r.empty && <AnswerSection ctx={ctx} ranking={r} geo={geo} activeFips={active.fips} onOpenCounty={openCounty} />,
      why: <WhySection ctx={ctx} validation={validation} />,
      proof: <ProofSection ctx={ctx} validation={validation} />,
      county: r && !r.empty && <ReportCardSection ctx={ctx} row={active} rows={r.rows} onSelect={setFips} onShowMath={() => setMathOpen(true)} />,
      limits: r && !r.empty && <LimitsSection ctx={ctx} ranking={r} csvUrl={apiUrl('ranking.csv', params)} onOpenCounty={openCounty} />,
      ask: <AdvisorView ctx={ctx} messages={chat} setMessages={setChat} topCounty={active} />,
    }[page];
  }

  return (
    <>
      <Header
        page={page}
        onNavigate={go}
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
      <main className="w-full pt-32 min-h-[70vh] bg-surface">
        {body}
        <PageNav page={page} onNavigate={go} />
      </main>
      {mathOpen && active && <RationaleModal open row={active} ranking={r} onClose={() => setMathOpen(false)} />}
      <Footer dataset={options.data?.dataset} />
    </>
  );
}

// "Back / Next" so the pitch can be walked through page by page.
function PageNav({ page, onNavigate }) {
  const i = PAGES.findIndex((p) => p.id === page);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  const btn =
    'flex items-center gap-1.5 px-4 py-2 rounded-lg font-headline-sm text-body-sm font-bold transition-all';
  return (
    // First page has no Back button, so Next sits centered under the content.
    <div className={`max-w-7xl mx-auto px-gutter pb-space-lg flex gap-space-md ${prev ? 'justify-between' : 'justify-center'}`}>
      {prev && (
        <button onClick={() => onNavigate(prev.id)} className={`${btn} bg-surface-container-high text-on-surface hover:bg-surface-bright`}>
          <Icon name="arrow_back" className="text-[18px]" />
          {prev.label}
        </button>
      )}
      {next && (
        <button onClick={() => onNavigate(next.id)} className={`${btn} bg-primary-container text-on-primary-container hover:bg-accent-hover`}>
          Next: {next.label}
          <Icon name="arrow_forward" className="text-[18px]" />
        </button>
      )}
    </div>
  );
}
