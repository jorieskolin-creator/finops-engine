
export interface EvidenceQuote {
  quote: string;
  source_document?: string;
  section?: string;
}

export interface AuditItem {
  count: number;
  status: "OK" | "Partial" | "NOK";
  evidence: string;
  evidence_quotes: EvidenceQuote[];
  reasoning?: string;
  is_silent?: boolean;
}

export interface AuditCategory {
  [key: string]: AuditItem;
}

export interface Phase1AuditLogs {
  maturity: AuditCategory;
  antipattern: AuditCategory;
}

export interface Metrics {
  maturity_ratio: number;
  antipattern_ratio: number;
  maturity_depth: number;
  antipattern_burden: number;
  finops_readiness: number;
  signal_strength: number;
}

export interface RawCounts {
  maturity_sub_criteria_met: number;
  antipattern_sub_criteria_met: number;
}

export interface Phase2Validation {
  metrics: Metrics;
  raw_counts: RawCounts;
  maturity_gaps: string[];
  antipattern_findings: string[];
  silent_areas: string[];
  category_scores: Record<string, number>;
  crawl_walk_run: 'Crawl' | 'Walk' | 'Walk with significant friction' | 'Run';
}

export interface RemediationStep {
  phase: string;
  actions: string[];
}

export interface VisualScorecard {
  headline: string;
  maturity_score: string;
  burden_score: string;
}

export interface Phase3Strategy {
  executive_summary: string;
  visual_scorecard: VisualScorecard;
  remediation_roadmap: RemediationStep[];
  persona_lens?: string;
}

export interface AnalysisMeta {
  document_analyzed: string;
  timestamp: string;
  engine_version: string;
  model_config: {
    phase0_phase1: string;
    phase3: string;
    validators: string;
  };
}

export interface DiagnosticResult {
  meta: AnalysisMeta;
  phase_1_audit_logs: Phase1AuditLogs;
  phase_2_validation: Phase2Validation;
  phase_3_strategy: Phase3Strategy;
}

export interface ScanResult {
  score: number;
  status: 'Ready' | 'Weak' | 'Insufficient' | 'PassWithWarning';
  message: string;
  details: string[];
  canRun: boolean;
  confidence_warning?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repaired?: boolean;
}

export interface StrategicTactic {
  id: string;
  category: 'Visibility' | 'Optimization' | 'Governance' | 'Architecture' | 'Culture';
  problem_pattern: string;
  solution_mechanism: string;
  case_study: string;
  prerequisites?: string[];
  owner_persona?: string;
  expected_outcome?: string;
  risk_notes?: string;
  resource_label?: string;
  resource_url?: string;
}
