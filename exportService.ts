
import { DiagnosticResult } from '../types';

export const downloadReport = (result: DiagnosticResult) => {
  const html = generateReportHtml(result);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FinOps_Assessment_${new Date().toISOString().split('T')[0]}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

const generateReportHtml = (result: DiagnosticResult): string => {
  const m = result.phase_2_validation.metrics;
  const cwrClass = result.phase_2_validation.crawl_walk_run;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinOps Maturity Assessment Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #f8fafc; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
    .meta { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }
    .scorecard { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 1.5rem; }
    .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 0.5rem; }
    .card-value { font-size: 2rem; font-weight: 700; }
    .positive { color: #06b6d4; }
    .negative { color: #f43f5e; }
    .neutral { color: #a855f7; }
    .classification { font-size: 1.25rem; font-weight: 700; padding: 0.5rem 1rem; border-radius: 0.5rem; display: inline-block; margin: 1rem 0; }
    .crawl { background: #7f1d1d; color: #fca5a5; }
    .walk { background: #78350f; color: #fcd34d; }
    .run { background: #14532d; color: #86efac; }
    .summary { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 2rem; margin: 1.5rem 0; line-height: 1.8; }
    .roadmap-phase { background: #1e293b; border-left: 3px solid #06b6d4; padding: 1rem 1.5rem; margin: 1rem 0; border-radius: 0 0.5rem 0.5rem 0; }
    .roadmap-phase h3 { color: #06b6d4; margin-bottom: 0.5rem; }
    .roadmap-phase ul { padding-left: 1.5rem; }
    .roadmap-phase li { margin: 0.5rem 0; }
    @media print { body { background: white; color: #1e293b; } .card, .summary, .roadmap-phase { border-color: #e2e8f0; } }
  </style>
</head>
<body>
  <h1>FinOps Maturity Assessment Report</h1>
  <div class="meta">
    <p>Generated: ${result.meta.timestamp} | Engine: ${result.meta.engine_version}</p>
    <p>Models: ${result.meta.model_config.phase0_phase1} (Audit) | ${result.meta.model_config.phase3} (Strategy)</p>
  </div>

  <h2>Maturity Classification</h2>
  <span class="classification ${cwrClass.toLowerCase().includes('crawl') ? 'crawl' : cwrClass.toLowerCase().includes('run') ? 'run' : 'walk'}">${cwrClass}</span>

  <h2>Key Metrics</h2>
  <div class="scorecard">
    <div class="card"><div class="card-label">FinOps Readiness</div><div class="card-value positive">${Math.round(m.finops_readiness)}%</div></div>
    <div class="card"><div class="card-label">Maturity Depth</div><div class="card-value neutral">${Math.round(m.maturity_depth)}%</div></div>
    <div class="card"><div class="card-label">Anti-Pattern Burden</div><div class="card-value negative">${Math.round(m.antipattern_burden)}%</div></div>
    <div class="card"><div class="card-label">Signal Strength</div><div class="card-value">${Math.round(m.signal_strength)}%</div></div>
  </div>

  <h2>Executive Summary</h2>
  <div class="summary">${result.phase_3_strategy.executive_summary.replace(/\n/g, '<br>')}</div>

  <h2>Remediation Roadmap</h2>
  ${result.phase_3_strategy.remediation_roadmap.map(step => `
    <div class="roadmap-phase">
      <h3>${step.phase}</h3>
      <ul>${step.actions.map(a => `<li>${a}</li>`).join('')}</ul>
    </div>
  `).join('')}

  <script id="finops-data" type="application/json">${JSON.stringify(result)}</script>
</body>
</html>`;
};
