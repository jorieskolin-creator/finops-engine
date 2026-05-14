import React, { useState } from 'react';
import { AuditItem, DiagnosticResult } from '../types';
import { MarkdownRenderer } from './DashboardComponents';
import { BATCH_TITLES, MASTER_BINGO_FINOPS } from '../knowledge_base';

const BATCHES: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];

const statusBadgeClass = (status: string): string => {
  if (status === 'OK') return 'bg-emerald-100 text-emerald-700';
  if (status === 'NOK') return 'bg-rose-100 text-rose-700';
  if (status === 'Partial') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-500';
};

const ForensicCriterion: React.FC<{
  catalog: { id: string; title: string; desc: string };
  item?: AuditItem;
}> = ({ catalog, item }) => (
  <div className="p-5 bg-white rounded-xl border border-slate-200">
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="min-w-0">
        <span className="font-mono text-xs text-slate-400">{catalog.id}</span>
        <h4 className="font-bold text-slate-900 leading-snug">{catalog.title}</h4>
      </div>
      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider shrink-0 ${statusBadgeClass(item?.status ?? '')}`}>
        {item?.status ?? 'No Data'}
      </span>
    </div>
    <p className="text-sm text-slate-500 mb-3">{catalog.desc}</p>
    {item?.reasoning && (
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">AI Reasoning</p>
        <p className="text-sm text-slate-700 whitespace-pre-line">{item.reasoning}</p>
      </div>
    )}
    {item?.evidence_quotes && item.evidence_quotes.length > 0 && (
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Evidence</p>
        <ul className="space-y-2">
          {item.evidence_quotes.map((q, i) => (
            <li key={i} className="border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
              &ldquo;{q.quote}&rdquo;
              {q.section && <span className="text-xs text-slate-400 not-italic"> — {q.section}</span>}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const ForensicSection: React.FC<{
  title: string;
  stream: 'maturity' | 'antipattern';
  logs: Record<string, AuditItem>;
  criticalLabel: string;
  criticalHint: string;
}> = ({ title, stream, logs, criticalLabel, criticalHint }) => {
  const [mode, setMode] = useState<'all' | 'critical'>('all');
  const catalog = MASTER_BINGO_FINOPS[stream];
  const totalCount = catalog.length;
  const isCritical = (item?: AuditItem): boolean => item?.status === 'NOK';
  const criticalCount = catalog.filter(c => isCritical(logs[c.id])).length;
  const visibleCatalog = mode === 'critical' ? catalog.filter(c => isCritical(logs[c.id])) : catalog;

  const pillBase = 'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors';
  const pillActive = 'bg-slate-900 text-white';
  const pillIdle = 'bg-slate-100 text-slate-500 hover:bg-slate-200';

  return (
    <div className="mb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
        <h2 className="text-2xl font-display font-bold text-slate-900">
          {title}
          <span className="ml-3 text-sm font-normal text-slate-400">
            {totalCount} criteria · {criticalCount} {criticalHint}
          </span>
        </h2>
        <div className="flex items-center gap-2" role="group" aria-label={`${title} filter`}>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`${pillBase} ${mode === 'all' ? pillActive : pillIdle}`}
            aria-pressed={mode === 'all'}
          >
            All {totalCount}
          </button>
          <button
            type="button"
            onClick={() => setMode('critical')}
            disabled={criticalCount === 0}
            className={`${pillBase} ${mode === 'critical' ? pillActive : pillIdle} ${criticalCount === 0 ? 'opacity-40 cursor-not-allowed hover:bg-slate-100' : ''}`}
            aria-pressed={mode === 'critical'}
            title={criticalCount === 0 ? `No ${criticalHint} in this stream.` : undefined}
          >
            {criticalLabel} {criticalCount}
          </button>
        </div>
      </div>

      {visibleCatalog.length === 0 ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          No {criticalHint} in this stream — nothing to flag.
        </div>
      ) : (
        <div className="space-y-8">
          {BATCHES.map(batchId => {
            const items = visibleCatalog.filter(c => c.batch === batchId);
            if (items.length === 0) return null;
            return (
              <div key={batchId}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">
                  {batchId} — {BATCH_TITLES[batchId]}
                </h3>
                <div className="space-y-3">
                  {items.map(cat => (
                    <ForensicCriterion key={cat.id} catalog={cat} item={logs[cat.id]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ReportViewProps {
  result: DiagnosticResult;
  onBack: () => void;
  onDownload: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ result, onBack, onDownload }) => {
  const m = result.phase_2_validation.metrics;
  const cwrClass = result.phase_2_validation.crawl_walk_run;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </button>
          <button onClick={onDownload} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 transition-colors">
            Download Report
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-display font-bold text-slate-900 mb-2">FinOps Maturity Assessment</h1>
          <p className="text-slate-500">Generated: {result.meta.timestamp} | Engine: {result.meta.engine_version}</p>
        </div>

        <div className="mb-12 p-8 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-4 mb-6">
            <span className={`px-4 py-2 rounded-lg font-bold text-sm ${cwrClass.includes('Crawl') ? 'bg-rose-100 text-rose-700' : cwrClass.includes('Run') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {cwrClass}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm font-mono text-slate-500">
              Delivery {m.delivery_integrity}% · Evidence {m.evidence_density}%
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">FinOps Readiness</p>
              <p className="text-3xl font-bold text-emerald-600">{Math.round(m.finops_readiness)}%</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Maturity Depth</p>
              <p className="text-3xl font-bold text-teal-600">{Math.round(m.maturity_depth)}%</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Anti-Pattern Burden</p>
              <p className="text-3xl font-bold text-rose-600">{Math.round(m.antipattern_burden)}%</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Maturity Ratio</p>
              <p className="text-3xl font-bold text-violet-600">{Math.round(m.maturity_ratio)}%</p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">Executive Summary</h2>
          <MarkdownRenderer content={result.phase_3_strategy.executive_summary} textColor="text-slate-700" />
        </div>

        {result.phase_3_strategy.remediation_roadmap.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">Remediation Roadmap</h2>
            <div className="space-y-6">
              {result.phase_3_strategy.remediation_roadmap.map((step, index) => (
                <div key={index} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-lg text-slate-900 mb-4">{step.phase}</h3>
                  <ul className="space-y-3">
                    {step.actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <ForensicSection
          title="Forensic Audit: FinOps Maturity"
          stream="maturity"
          logs={result.phase_1_audit_logs.maturity}
          criticalLabel="Gaps only"
          criticalHint="gaps"
        />

        <ForensicSection
          title="Forensic Audit: Anti-Patterns"
          stream="antipattern"
          logs={result.phase_1_audit_logs.antipattern}
          criticalLabel="Red flags only"
          criticalHint="red flags"
        />

        <div className="text-center py-8 border-t border-slate-200 text-sm text-slate-400">
          <p>FinOps Assessment Engine v{result.meta.engine_version}</p>
          <p>Models: {result.meta.model_config.phase0_phase1} (Audit) | {result.meta.model_config.phase3} (Strategy)</p>
        </div>
      </div>
    </div>
  );
};
