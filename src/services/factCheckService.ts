
import { AuditItem, FactCheckClaim, FactCheckResult, Phase1AuditLogs, Phase2Validation } from '../types';

export interface FactCheckInputs {
  executiveSummary: string;
  remediationRoadmapText: string;
  sourceDocument: string;
  phase1: Phase1AuditLogs;
  phase2: Phase2Validation;
}

const MAX_SOURCE_CHARS = 40000;

const compactEvidence = (phase1: Phase1AuditLogs): string => {
  const lines: string[] = [];
  for (const stream of ['maturity', 'antipattern'] as const) {
    for (const [id, item] of Object.entries(phase1[stream])) {
      const a = item as AuditItem;
      if (a.evidence_quotes.length === 0) continue;
      const quotes = a.evidence_quotes.map(q => `"${q.quote.replace(/"/g, "'").substring(0, 200)}"`).join(' | ');
      lines.push(`${stream}.${id} (count=${a.count}): ${quotes}`);
    }
  }
  return lines.join('\n');
};

const compactMetrics = (phase2: Phase2Validation): string => {
  const m = phase2.metrics;
  return [
    `finops_readiness=${Math.round(m.finops_readiness)}%`,
    `maturity_depth=${Math.round(m.maturity_depth)}%`,
    `antipattern_burden=${Math.round(m.antipattern_burden)}%`,
    `maturity_ratio=${Math.round(m.maturity_ratio)}%`,
    `antipattern_ratio=${Math.round(m.antipattern_ratio)}%`,
    `delivery_integrity=${m.delivery_integrity}%`,
    `evidence_density=${m.evidence_density}%`,
    `classification=${phase2.crawl_walk_run}`,
    `silent_areas_count=${phase2.silent_areas.length}`,
    `maturity_gaps_count=${phase2.maturity_gaps.length}`,
    `antipattern_findings_count=${phase2.antipattern_findings.length}`
  ].join(', ');
};

export const buildFactCheckPrompt = (inputs: FactCheckInputs): string => `
<role>
You are a fact-checker for a FinOps maturity assessment.
Your job: extract every distinct factual claim from the STRATEGY OUTPUT below, then classify each claim against the source material the strategy was generated from.
</role>

<classifications>
- "supported_by_source": the claim is directly stated or clearly implied in the SOURCE_DOCUMENT.
- "supported_by_audit": the claim is derived from PHASE_1_EVIDENCE or PHASE_2_METRICS (both produced by this engine from the source).
- "unsupported": the claim cannot be traced to either above. This includes invented numbers, named entities not in the source, organizational claims with no evidence, and confident assertions about facts not present in the inputs.
</classifications>

<rules>
- ONLY flag CONCRETE FACTUAL CLAIMS. Skip stylistic adjectives ("dangerously misleading"), generic FinOps principles ("FinOps requires culture change"), and uncontroversial truths.
- Specifically check: percentages, named tools/companies/teams/products, numerical counts (e.g. "22 anti-patterns"), claims about specific organizational structures, claims about specific named processes.
- Be skeptical: if a claim is specific enough to be falsifiable but you cannot find it in the inputs, classify as "unsupported".
- Maximum 15 claims per pass — focus on the most consequential.
- Output JSON ONLY, no prose.
</rules>

<output_format>
{
  "claims": [
    { "claim": "exact phrase from the strategy output", "classification": "supported_by_source" | "supported_by_audit" | "unsupported", "rationale": "one short sentence" }
  ]
}
</output_format>

<phase_2_metrics>
${compactMetrics(inputs.phase2)}
</phase_2_metrics>

<phase_1_evidence>
${compactEvidence(inputs.phase1)}
</phase_1_evidence>

<source_document>
${inputs.sourceDocument.substring(0, MAX_SOURCE_CHARS)}
</source_document>

<strategy_output_to_check>
EXECUTIVE SUMMARY:
${inputs.executiveSummary}

REMEDIATION ROADMAP ACTIONS:
${inputs.remediationRoadmapText}
</strategy_output_to_check>
`;

export const parseFactCheckResponse = (text: string, attempts: number): FactCheckResult => {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      attempts,
      total_claims: 0,
      supported_count: 0,
      unsupported_claims: [],
      failed: true,
      failure_reason: 'Fact-check response contained no JSON.'
    };
  }
  try {
    const parsed = JSON.parse(match[0]);
    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    const validClaims: FactCheckClaim[] = claims
      .filter((c: any) => c && typeof c.claim === 'string' && typeof c.classification === 'string')
      .map((c: any) => ({
        claim: c.claim,
        classification: ['supported_by_source', 'supported_by_audit', 'unsupported'].includes(c.classification)
          ? c.classification
          : 'unsupported',
        rationale: typeof c.rationale === 'string' ? c.rationale : ''
      }));
    const unsupported = validClaims.filter(c => c.classification === 'unsupported');
    return {
      attempts,
      total_claims: validClaims.length,
      supported_count: validClaims.length - unsupported.length,
      unsupported_claims: unsupported,
      failed: false
    };
  } catch (e) {
    return {
      attempts,
      total_claims: 0,
      supported_count: 0,
      unsupported_claims: [],
      failed: true,
      failure_reason: 'Fact-check response was not valid JSON.'
    };
  }
};

export const buildRegenerateAppendix = (unsupported: FactCheckClaim[]): string => `

### REGENERATE INSTRUCTIONS — your previous output failed fact-check

A separate fact-check pass found these claims in your previous executive summary or roadmap that were not supported by the source document or the verified Phase 1 evidence:

${unsupported.map(c => `- "${c.claim}"\n    Reason: ${c.rationale}`).join('\n')}

Regenerate the executive summary AND remediation roadmap. The new output:
- MUST NOT include any of the above claims, even rephrased.
- MUST cite only facts that appear in <SOURCE_DOCUMENT_TO_AUDIT> or in the Phase 1 evidence quotes already provided.
- Prefer fewer specific claims over inventing replacements. It is better to be vague but truthful than precise but unsupported.
- Keep the exact same JSON output shape.
`;
