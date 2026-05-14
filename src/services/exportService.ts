
import { AuditItem, DiagnosticResult, QualityGateResult } from '../types';
import { BATCH_TITLES, MASTER_BINGO_FINOPS } from '../knowledge_base';
import { METRIC_DESCRIPTIONS } from '../constants';

const BATCHES: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderQualityGate = (gate: QualityGateResult): string => {
  if (gate.decision === 'GO') {
    return `<div class="gate gate-go"><strong>Quality Gate: GO</strong> — ${escapeHtml(gate.notes[0] ?? '')}</div>`;
  }
  const cls = gate.decision === 'BLOCK' ? 'gate-block' : 'gate-warn';
  return `
  <div class="gate ${cls}">
    <h2 class="gate-title">Quality Gate: ${gate.decision}</h2>
    <p class="gate-note">${escapeHtml(gate.notes[0] ?? '')}</p>
    ${gate.blocking_reasons.length > 0 ? `
    <div class="gate-block-section">
      <div class="gate-label">Blocking</div>
      <ul>${gate.blocking_reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </div>` : ''}
    ${gate.warnings.length > 0 ? `
    <div class="gate-warn-section">
      <div class="gate-label">Warnings</div>
      <ul>${gate.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
    </div>` : ''}
    ${gate.fact_check && !gate.fact_check.failed && gate.fact_check.unsupported_claims.length > 0 ? `
    <div class="gate-factcheck">
      <div class="gate-label">Unverified claims (${gate.fact_check.unsupported_claims.length} survived ${gate.fact_check.attempts} pass${gate.fact_check.attempts === 1 ? '' : 'es'})</div>
      <ul>${gate.fact_check.unsupported_claims.map(c => `<li><em>&ldquo;${escapeHtml(c.claim)}&rdquo;</em>${c.rationale ? `<span class="gate-rationale"> — ${escapeHtml(c.rationale)}</span>` : ''}</li>`).join('')}</ul>
    </div>` : ''}
  </div>`;
};

const statusBadgeClass = (status: string): string => {
  if (status === 'OK') return 'badge-ok';
  if (status === 'NOK') return 'badge-nok';
  if (status === 'Partial') return 'badge-partial';
  return 'badge-none';
};

const renderForensicCriterion = (cat: { id: string; title: string; desc: string }, item: AuditItem | undefined): string => `
    <div class="forensic-card">
      <div class="forensic-head">
        <div>
          <span class="forensic-id">${escapeHtml(cat.id)}</span>
          <h4>${escapeHtml(cat.title)}</h4>
        </div>
        <span class="badge ${statusBadgeClass(item?.status ?? '')}">${escapeHtml(item?.status ?? 'No Data')}</span>
      </div>
      <p class="forensic-desc">${escapeHtml(cat.desc)}</p>
      ${item?.reasoning ? `
      <div class="forensic-block">
        <div class="forensic-label">AI Reasoning</div>
        <p class="forensic-reasoning">${escapeHtml(item.reasoning)}</p>
      </div>` : ''}
      ${item?.evidence_quotes && item.evidence_quotes.length > 0 ? `
      <div class="forensic-block">
        <div class="forensic-label">Evidence</div>
        <ul class="forensic-quotes">
          ${item.evidence_quotes.map(q => `
            <li>&ldquo;${escapeHtml(q.quote)}&rdquo;${q.section ? `<span class="forensic-section"> — ${escapeHtml(q.section)}</span>` : ''}</li>
          `).join('')}
        </ul>
      </div>` : ''}
    </div>`;

const renderForensicSection = (
  title: string,
  stream: 'maturity' | 'antipattern',
  logs: Record<string, AuditItem>
): string => {
  const catalog = MASTER_BINGO_FINOPS[stream];
  const body = BATCHES.map(batchId => {
    const items = catalog.filter(c => c.batch === batchId);
    if (items.length === 0) return '';
    return `
    <div class="forensic-batch">
      <h3 class="forensic-batch-title">${batchId} — ${escapeHtml(BATCH_TITLES[batchId])}</h3>
      ${items.map(cat => renderForensicCriterion(cat, logs[cat.id])).join('')}
    </div>`;
  }).join('');
  return `
  <h2>${escapeHtml(title)}</h2>
  ${body}`;
};

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
    .card-desc { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; line-height: 1.4; }
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
    .forensic-batch { margin: 1.5rem 0 2rem; }
    .forensic-batch-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin: 1.5rem 0 0.75rem; }
    .forensic-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.25rem; margin: 0.75rem 0; }
    .forensic-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
    .forensic-head h4 { font-size: 1rem; color: #f8fafc; line-height: 1.3; margin-top: 0.125rem; }
    .forensic-id { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.75rem; color: #64748b; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; flex-shrink: 0; }
    .badge-ok { background: #14532d; color: #86efac; }
    .badge-partial { background: #78350f; color: #fcd34d; }
    .badge-nok { background: #7f1d1d; color: #fca5a5; }
    .badge-none { background: #334155; color: #94a3b8; }
    .forensic-desc { font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.75rem; }
    .forensic-block { margin-top: 0.75rem; }
    .forensic-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; margin-bottom: 0.25rem; }
    .forensic-reasoning { font-size: 0.875rem; color: #cbd5e1; white-space: pre-line; }
    .forensic-quotes { list-style: none; padding: 0; margin: 0; }
    .forensic-quotes li { font-size: 0.875rem; font-style: italic; color: #cbd5e1; border-left: 2px solid #475569; padding-left: 0.75rem; margin: 0.5rem 0; }
    .forensic-section { font-size: 0.75rem; color: #64748b; font-style: normal; }
    .gate { padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0 2rem; border-left: 4px solid; }
    .gate.gate-go { background: #052e16; border-color: #22c55e; color: #bbf7d0; font-size: 0.875rem; }
    .gate.gate-warn { background: #451a03; border-color: #f59e0b; color: #fde68a; }
    .gate.gate-block { background: #450a0a; border-color: #ef4444; color: #fecaca; }
    .gate-title { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .gate-note { font-size: 0.9rem; margin-bottom: 1rem; opacity: 0.9; }
    .gate-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin: 0.75rem 0 0.5rem; opacity: 0.8; }
    .gate ul { list-style: none; padding: 0; margin: 0; }
    .gate li { padding-left: 0.75rem; border-left: 2px solid currentColor; margin: 0.4rem 0; opacity: 0.9; font-size: 0.875rem; }
    .gate-factcheck { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); }
    .gate-rationale { font-size: 0.75rem; opacity: 0.7; font-style: normal; }
    @media print { body { background: white; color: #1e293b; } .card, .summary, .roadmap-phase, .forensic-card { border-color: #e2e8f0; background: #f8fafc; color: #1e293b; } .forensic-head h4 { color: #0f172a; } .forensic-reasoning, .forensic-quotes li { color: #334155; } }
  </style>
</head>
<body>
  <h1>FinOps Maturity Assessment Report</h1>
  <div class="meta">
    <p>Generated: ${result.meta.timestamp} | Engine: ${result.meta.engine_version}</p>
    <p>Models: ${result.meta.model_config.phase0_phase1} (Audit) | ${result.meta.model_config.phase3} (Strategy)</p>
  </div>

  ${renderQualityGate(result.quality_gate)}

  <h2>Maturity Classification</h2>
  <span class="classification ${cwrClass.toLowerCase().includes('crawl') ? 'crawl' : cwrClass.toLowerCase().includes('run') ? 'run' : 'walk'}">${cwrClass}</span>

  <h2>Key Metrics</h2>
  <div class="scorecard">
    <div class="card"><div class="card-label">FinOps Readiness</div><div class="card-value positive">${Math.round(m.finops_readiness)}%</div><div class="card-desc">${escapeHtml(METRIC_DESCRIPTIONS.finops_readiness)}</div></div>
    <div class="card"><div class="card-label">Maturity Depth</div><div class="card-value neutral">${Math.round(m.maturity_depth)}%</div><div class="card-desc">${escapeHtml(METRIC_DESCRIPTIONS.maturity_depth)}</div></div>
    <div class="card"><div class="card-label">Anti-Pattern Burden</div><div class="card-value negative">${Math.round(m.antipattern_burden)}%</div><div class="card-desc">${escapeHtml(METRIC_DESCRIPTIONS.antipattern_burden)}</div></div>
    <div class="card"><div class="card-label">Delivery Integrity</div><div class="card-value">${m.delivery_integrity}%</div><div class="card-desc">${escapeHtml(METRIC_DESCRIPTIONS.delivery_integrity)}</div></div>
    <div class="card"><div class="card-label">Evidence Density</div><div class="card-value">${m.evidence_density}%</div><div class="card-desc">${escapeHtml(METRIC_DESCRIPTIONS.evidence_density)}</div></div>
  </div>

  <h2>Executive Summary</h2>
  <div class="summary">${result.phase_3_strategy.executive_summary.replace(/\n/g, '<br>')}</div>

  <h2>Remediation Roadmap</h2>
  ${result.phase_3_strategy.remediation_roadmap.map(step => `
    <div class="roadmap-phase">
      <h3>${escapeHtml(step.phase)}</h3>
      <ul>${step.actions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    </div>
  `).join('')}

  ${renderForensicSection('Forensic Audit: FinOps Maturity', 'maturity', result.phase_1_audit_logs.maturity)}
  ${renderForensicSection('Forensic Audit: Anti-Patterns', 'antipattern', result.phase_1_audit_logs.antipattern)}

  <script id="finops-data" type="application/json">${JSON.stringify(result)}</script>
</body>
</html>`;
};
