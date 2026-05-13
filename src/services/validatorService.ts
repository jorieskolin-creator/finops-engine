
import { Phase1AuditLogs, AuditItem, Phase2Validation, ValidationResult } from '../types';
import { FINOPS_TACTICS_LOCAL } from '../knowledge_base';

const ALL_CRITERIA_IDS = [
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'D3', 'D4', 'D5',
  'E1', 'E2', 'E3', 'E4', 'E5'
];

export const validatePhase1Output = (rawData: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawData?.phase_1_audit_logs) {
    errors.push('Missing phase_1_audit_logs root key');
    return { valid: false, errors, warnings };
  }

  const logs = rawData.phase_1_audit_logs;

  for (const stream of ['maturity', 'antipattern'] as const) {
    if (!logs[stream]) {
      errors.push(`Missing stream: ${stream}`);
      continue;
    }

    const presentIds = new Set(Object.keys(logs[stream]));
    const missingIds = ALL_CRITERIA_IDS.filter(id => !presentIds.has(id));

    if (missingIds.length > 0) {
      errors.push(`${stream}: Missing criteria IDs: ${missingIds.join(', ')}`);
    }

    const duplicateCheck = Object.keys(logs[stream]);
    if (new Set(duplicateCheck).size !== duplicateCheck.length) {
      errors.push(`${stream}: Duplicate criteria IDs detected`);
    }

    for (const [id, item] of Object.entries(logs[stream])) {
      const auditItem = item as any;

      if (typeof auditItem?.count !== 'number' || auditItem.count < 0 || auditItem.count > 3 || !Number.isInteger(auditItem.count)) {
        errors.push(`${stream}.${id}: Invalid score ${auditItem?.count} (must be integer 0-3)`);
      }

      if (auditItem?.count > 0) {
        const evidence = auditItem?.evidence || '';
        const quotes = auditItem?.evidence_quotes || [];
        if (evidence.length < 20 && quotes.length === 0) {
          warnings.push(`${stream}.${id}: Score ${auditItem.count} but insufficient evidence`);
        }
      }

      if (auditItem?.count === 0) {
        const evidence = (auditItem?.evidence || '').toLowerCase();
        const silenceKeywords = ['silent', 'absent', 'not found', 'no evidence', 'missing', 'not mentioned'];
        if (!silenceKeywords.some(kw => evidence.includes(kw)) && evidence.length > 5) {
          warnings.push(`${stream}.${id}: Score 0 but evidence does not indicate silence`);
        }
      }

      if (!auditItem?.reasoning || typeof auditItem.reasoning !== 'string') {
        warnings.push(`${stream}.${id}: Missing reasoning field`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repaired: false
  };
};

export const validatePhase3Grounding = (strategyData: any, phase2: Phase2Validation): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!strategyData?.phase_3_strategy) {
    errors.push('Missing phase_3_strategy root key');
    return { valid: false, errors, warnings };
  }

  const strategy = strategyData.phase_3_strategy;

  if (!strategy.executive_summary || strategy.executive_summary.length < 100) {
    errors.push('Executive summary missing or too short');
  }

  if (!strategy.remediation_roadmap || !Array.isArray(strategy.remediation_roadmap) || strategy.remediation_roadmap.length === 0) {
    errors.push('Remediation roadmap missing or empty');
  }

  const WEASEL_WORDS = ['consider', 'might', 'could potentially', 'perhaps', 'it may be worth', 'you could try', 'we suggest exploring'];
  const allActions: string[] = [];
  if (strategy.remediation_roadmap && Array.isArray(strategy.remediation_roadmap)) {
    for (const phase of strategy.remediation_roadmap) {
      if (phase.actions && Array.isArray(phase.actions)) {
        allActions.push(...phase.actions);
      }
    }
  }

  for (const action of allActions) {
    const lower = action.toLowerCase();
    for (const weasel of WEASEL_WORDS) {
      if (lower.includes(weasel)) {
        warnings.push(`Weasel word "${weasel}" found in action: "${action.substring(0, 60)}..."`);
      }
    }
  }

  const tacticIdPattern = /TAC-[A-Z]+-\d{3}/g;
  const referencedTacticIds = new Set<string>();
  const fullText = JSON.stringify(strategy);
  const matches = fullText.match(tacticIdPattern);
  if (matches) {
    matches.forEach(id => referencedTacticIds.add(id));
  }

  const validTacticIds = new Set(FINOPS_TACTICS_LOCAL.map(t => t.id));
  for (const refId of referencedTacticIds) {
    if (!validTacticIds.has(refId)) {
      warnings.push(`Referenced tactic ID "${refId}" not found in verified tactics database`);
    }
  }

  const summaryText = strategy.executive_summary || '';
  const percentPattern = /(\d+)%/g;
  const percentMatches = summaryText.match(percentPattern);
  if (percentMatches) {
    for (const pctStr of percentMatches) {
      const pct = parseInt(pctStr);
      if (!isNaN(pct)) {
        const metricsValues = Object.values(phase2.metrics) as number[];
        const roundedMetrics = metricsValues.map(v => Math.round(v));
        if (!roundedMetrics.includes(pct) && pct !== 100 && pct !== 0) {
          warnings.push(`Percentage ${pctStr} in summary may not match Phase 2 metrics`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};
