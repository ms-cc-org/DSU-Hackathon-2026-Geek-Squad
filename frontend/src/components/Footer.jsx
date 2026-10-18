export default function Footer({ dataset }) {
  return (
    <footer className="w-full bg-surface-container-low py-space-lg mt-space-xl">
      <div className="max-w-7xl mx-auto px-gutter flex flex-col md:flex-row items-center justify-between gap-space-md font-body-sm text-body-sm text-on-surface-variant">
        <span>
          🌽 <b className="text-primary-fixed">Team Geek Squad</b> · DSU Hackathon 2026
        </span>
        <span className="text-center">
          Data: USDA NASS yields &amp; acres · NOAA ACIS weather · U.S. Drought Monitor · USDA NRCS SSURGO soils · USDA price averages
        </span>
        {dataset && (
          <span className="font-label-code text-label-code text-text-muted">
            {dataset.rows.toLocaleString()} county-crop-years · {dataset.year_min}–{dataset.year_max}
          </span>
        )}
      </div>
    </footer>
  );
}
