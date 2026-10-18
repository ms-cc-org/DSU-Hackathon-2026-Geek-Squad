import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import ControlBar from './components/ControlBar.jsx';
import IntroOverlay from './components/IntroOverlay.jsx';
import GeospatialView from './components/GeospatialView.jsx';
import AssistanceView from './components/AssistanceView.jsx';
import ValidationView from './components/ValidationView.jsx';
import ReportCardView from './components/ReportCardView.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';
import { StatusPanel } from './components/Status.jsx';
import { apiUrl, useApi } from './lib/api.js';

export default function App() {
  const [introOpen, setIntroOpen] = useState(true);
  const [view, setView] = useState('geospatial');
  const [toast, setToast] = useState(null);
  const [pendingAnchor, setPendingAnchor] = useState(null);
  const toastTimer = useRef();

  // Targeting parameters: the same controls as the Streamlit sidebar.
  const [stateCode, setStateCode] = useState('IA');
  const [crop, setCrop] = useState('CORN');
  const [year, setYear] = useState(2020);
  const [budgetM, setBudgetM] = useState(25);
  const [quotaPct, setQuotaPct] = useState(15);
  const [sortBy, setSortBy] = useState('urgency');
  const [activeFips, setActiveFips] = useState(null);

  const options = useApi(apiUrl('options'));
  const params = { state: stateCode, crop, year, budget: budgetM * 1e6, quota: quotaPct, sort: sortBy };
  const ranking = useApi(apiUrl('ranking', params));
  const geo = useApi(apiUrl('geojson', { state: stateCode }));

  // Switching state resets crop to CORN when available (as Streamlit does).
  const changeState = (code) => {
    setStateCode(code);
    const crops = options.data?.states.find((s) => s.code === code)?.crops ?? [];
    setCrop(crops.includes('CORN') ? 'CORN' : crops[0]);
    setActiveFips(null);
  };

  // Keep a valid selected county: default to the #1 ranked county.
  const rows = ranking.data?.rows;
  useEffect(() => {
    if (!rows?.length) return;
    if (!activeFips || (view !== 'report' && !rows.some((r) => r.fips === activeFips))) setActiveFips(rows[0].fips);
  }, [rows, activeFips, view]);

  const showToast = useCallback((title, msg) => {
    clearTimeout(toastTimer.current);
    setToast({ title, msg });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const navigate = useCallback((target, anchorId) => {
    setView(target);
    if (anchorId) setPendingAnchor(anchorId);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!pendingAnchor) return;
    document.getElementById(pendingAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingAnchor(null);
  }, [pendingAnchor, view]);

  const openReportCard = (fips) => {
    setActiveFips(fips);
    navigate('report');
  };

  const openIntro = () => {
    setIntroOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ctx = useMemo(
    () => ({
      stateCode,
      stateLabel: options.data?.states.find((s) => s.code === stateCode)?.label ?? stateCode,
      crop,
      year,
      budgetM,
      quotaPct,
      sortBy,
      params,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateCode, crop, year, budgetM, quotaPct, sortBy, options.data],
  );

  const csvUrl = apiUrl('ranking.csv', params);

  let body;
  if (options.error) {
    body = (
      <StatusPanel
        tone="error"
        title="Cannot reach the data API"
        detail={`${options.error}. Start it from the repo root with: python api_server.py`}
      />
    );
  } else if (!options.data) {
    body = <StatusPanel title="Loading master dataset…" />;
  } else if (view === 'validation') {
    body = <ValidationView ctx={ctx} />;
  } else if (view === 'report') {
    body = <ReportCardView ctx={ctx} fips={activeFips} onSelect={setActiveFips} />;
  } else if (view === 'assistance') {
    body = (
      <AssistanceView
        ctx={ctx}
        ranking={ranking}
        onQuotaChange={setQuotaPct}
        onBack={() => navigate('geospatial')}
        onOpenReport={openReportCard}
        csvUrl={csvUrl}
        showToast={showToast}
      />
    );
  } else {
    body = (
      <GeospatialView
        ctx={ctx}
        ranking={ranking}
        geo={geo}
        activeFips={activeFips}
        onSelect={setActiveFips}
        onOpenAssistance={() => navigate('assistance')}
        onOpenReport={openReportCard}
        csvUrl={csvUrl}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      <IntroOverlay
        open={introOpen}
        dataset={options.data?.dataset}
        onEnter={(target) => {
          setIntroOpen(false);
          navigate(target);
        }}
      />
      <Header
        view={view}
        onNavigate={navigate}
        options={options.data}
        stateCode={stateCode}
        onStateChange={changeState}
        crop={crop}
        onCropChange={(c) => {
          setCrop(c);
          setActiveFips(null);
        }}
        year={year}
        onYearChange={setYear}
        budgetM={budgetM}
        csvUrl={csvUrl}
        rows={rows}
        onFindCounty={(fips) => {
          setActiveFips(fips);
          if (view !== 'report') navigate('geospatial', 'diagnostic-card');
        }}
      />

      <main className="w-full pt-28 bg-surface">
        {options.data && (
          <ControlBar
            options={options.data}
            view={view}
            year={year}
            budgetM={budgetM}
            onBudgetChange={setBudgetM}
            quotaPct={quotaPct}
            onQuotaChange={setQuotaPct}
            sortBy={sortBy}
            onSortChange={setSortBy}
            loading={ranking.loading}
          />
        )}
        {body}
      </main>

      <Footer onReturnToIntro={openIntro} dataset={options.data?.dataset} />
      <Toast toast={toast} />
    </>
  );
}
