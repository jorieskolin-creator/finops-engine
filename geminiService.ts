
import { STRATEGY_SYSTEM_INSTRUCTION, STRATEGY_USER_PROMPT } from "../constants";
import { runPhase1Audit } from "../orchestrator";
import { knowledgeBaseService, BATCH_DEFINITIONS } from "../knowledge_base";
import { DiagnosticResult, Phase1AuditLogs, Phase2Validation, AuditItem, EvidenceQuote } from "../types";
import { generateSafetyAuditPrompt } from "./securityService";
import { validatePhase1Output, validatePhase3Grounding } from "./validatorService";
import { callOpusStrategy } from "./anthropicService";

const ALL_CRITERIA_IDS = [
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'D3', 'D4', 'D5',
  'E1', 'E2', 'E3', 'E4', 'E5'
];

const parseAiResponse = (text: string): any => {
  if (!text) return {};
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[FinOps Pipeline] AI Response contained no JSON braces.");
    return {};
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[FinOps Pipeline] JSON Parse Error:", text.substring(0, 500));
    throw new Error("AI response was malformed and could not be repaired safely.");
  }
};

const callGeminiGenerate = async (model: string, contents: any[], systemInstruction?: string) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, contents, systemInstruction })
  });

  if (!response.ok) {
    throw new Error(`Proxy Error: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
};

const validateAndSanitizeLogs = (rawData: any): Phase1AuditLogs => {
  const safeLog: Phase1AuditLogs = { maturity: {}, antipattern: {} };

  const validateItem = (item: any, isAntipattern: boolean): AuditItem => {
    if (!item || typeof item !== 'object') {
      return {
        count: -1, status: "NOK", evidence: "AI Analysis Failed",
        evidence_quotes: [], is_silent: true, reasoning: "Data missing."
      };
    }

    const safeItem: AuditItem = {
      count: 0, status: "NOK", evidence: "Evidence extracted.",
      evidence_quotes: [], is_silent: false, reasoning: "No reasoning provided."
    };

    if (typeof item.count === 'number') {
      safeItem.count = Math.min(Math.max(Math.round(item.count), 0), 3);
    }

    if (isAntipattern) {
      if (safeItem.count === 0) { safeItem.status = "OK"; safeItem.is_silent = true; safeItem.evidence = "Anti-pattern not detected. (Clean)"; }
      else if (safeItem.count === 3) { safeItem.status = "NOK"; safeItem.is_silent = false; }
      else { safeItem.status = "Partial"; safeItem.is_silent = false; }
    } else {
      if (safeItem.count === 3) { safeItem.status = "OK"; safeItem.is_silent = false; }
      else if (safeItem.count === 0) { safeItem.status = "NOK"; safeItem.is_silent = true; safeItem.evidence = "Capability missing."; }
      else { safeItem.status = "Partial"; safeItem.is_silent = false; }
    }

    if (typeof item.evidence === 'string' && item.evidence.length > 5) safeItem.evidence = item.evidence;
    if (typeof item.reasoning === 'string') safeItem.reasoning = item.reasoning;

    if (Array.isArray(item.evidence_quotes)) {
      safeItem.evidence_quotes = item.evidence_quotes
        .filter((q: any) => q && typeof q === 'object' && typeof q.quote === 'string')
        .map((q: any): EvidenceQuote => ({
          quote: q.quote,
          source_document: typeof q.source_document === 'string' ? q.source_document : undefined,
          section: typeof q.section === 'string' ? q.section : undefined
        }));
    }

    return safeItem;
  };

  const rawMaturity = rawData?.phase_1_audit_logs?.maturity || {};
  ALL_CRITERIA_IDS.forEach(id => safeLog.maturity[id] = validateItem(rawMaturity[id], false));

  const rawAntipattern = rawData?.phase_1_audit_logs?.antipattern || {};
  ALL_CRITERIA_IDS.forEach(id => safeLog.antipattern[id] = validateItem(rawAntipattern[id], true));

  return safeLog;
};

const calculateMetrics = (logs: Phase1AuditLogs): Phase2Validation => {
  let maturityCount = 0; let maturitySum = 0; const maturityGaps: string[] = [];
  let antipatternCount = 0; let antipatternSum = 0; const antipatternFindings: string[] = [];
  let validItemsFound = 0;
  const silentAreas: string[] = [];
  const categoryScores: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  Object.entries(logs.maturity).forEach(([key, rawItem]) => {
    const item = rawItem as AuditItem;
    if (item.count !== -1) validItemsFound++;
    maturitySum += Math.max(item.count, 0);
    if (item.status === 'OK') maturityCount++;
    const catPrefix = key.charAt(0);
    if (categoryScores[catPrefix] !== undefined) categoryScores[catPrefix] += Math.max(item.count, 0);
    if (item.count === 0) {
      silentAreas.push(`Missing Capability: ${key}`);
      maturityGaps.push(`[${key}] Missing: ${item.reasoning}`);
    }
  });

  Object.entries(logs.antipattern).forEach(([key, rawItem]) => {
    const item = rawItem as AuditItem;
    if (item.count !== -1) validItemsFound++;
    antipatternSum += Math.max(item.count, 0);
    if (item.status === 'NOK') antipatternCount++;
    if (item.count > 0) {
      antipatternFindings.push(`[${key}] Finding: ${item.evidence.substring(0, 100)}...`);
    }
  });

  const coverageRatio = validItemsFound / 50;
  const signalStrength = Math.round(coverageRatio * 100);

  const maturity_ratio = (maturityCount / 25) * 100;
  const maturity_depth = (maturitySum / 75) * 100;
  const antipattern_ratio = (antipatternCount / 25) * 100;
  const antipattern_burden = (antipatternSum / 75) * 100;
  const finops_readiness = ((maturitySum + (75 - antipatternSum)) / 150) * 100;

  let crawl_walk_run: Phase2Validation['crawl_walk_run'];
  if (finops_readiness < 33) {
    crawl_walk_run = 'Crawl';
  } else if (finops_readiness < 66) {
    crawl_walk_run = antipattern_burden > 50 ? 'Walk with significant friction' : 'Walk';
  } else {
    crawl_walk_run = 'Run';
  }

  return {
    metrics: {
      maturity_ratio,
      antipattern_ratio,
      maturity_depth,
      antipattern_burden,
      finops_readiness,
      signal_strength: signalStrength
    },
    raw_counts: {
      maturity_sub_criteria_met: maturitySum,
      antipattern_sub_criteria_met: antipatternSum
    },
    maturity_gaps: maturityGaps,
    antipattern_findings: antipatternFindings,
    silent_areas: silentAreas,
    category_scores: categoryScores,
    crawl_walk_run
  };
};

const SIGNAL_THRESHOLD = 85;

export const analyzeDocument = async (
  text: string,
  onProgress: (stage: 'audit' | 'calc' | 'strategy', progress?: number) => void
): Promise<DiagnosticResult> => {
  try {
    console.log("[FinOps] Running Security Pre-Flight (DLP)...");
    onProgress('audit', 1);
    const dlpPrompt = generateSafetyAuditPrompt(text);

    const dlpResponse = await callGeminiGenerate(
      'gemini-2.5-pro-preview-05-06',
      [{ role: 'user', parts: [{ text: dlpPrompt }] }]
    );
    const dlpResult = parseAiResponse(dlpResponse.text);

    if (dlpResult && dlpResult.safe === false) {
      throw new Error(`Security Alert: Document rejected due to ${dlpResult.risk_detected} content. (${dlpResult.reason})`);
    }
    console.log("[FinOps] DLP Scan Passed.");

    console.log("[FinOps] Pre-fetching Tactics Database for Phase 3...");
    const tacticsPromise = knowledgeBaseService.fetchStrategicPlaybook();

    onProgress('audit', 5);
    console.log("[FinOps] Running Phase 1 Parallel Audit (5 batches)...");
    const aggregatedRawData = await runPhase1Audit(text, (completed, total) => {
      onProgress('audit', Math.round((completed / total) * 100));
    });

    const phase1Validation = validatePhase1Output(aggregatedRawData);
    if (!phase1Validation.valid) {
      console.warn("[FinOps] Phase 1 validation errors:", phase1Validation.errors);
    }
    if (phase1Validation.warnings.length > 0) {
      console.warn("[FinOps] Phase 1 validation warnings:", phase1Validation.warnings);
    }

    const auditLogs = validateAndSanitizeLogs(aggregatedRawData);

    onProgress('calc', 0);
    await new Promise(r => setTimeout(r, 600));
    onProgress('calc', 100);
    const validationData = calculateMetrics(auditLogs);

    console.log(`[FinOps] Phase 2 Complete. Readiness: ${Math.round(validationData.metrics.finops_readiness)}%, Classification: ${validationData.crawl_walk_run}`);

    if (validationData.metrics.signal_strength < SIGNAL_THRESHOLD) {
      onProgress('strategy', 100);
      return {
        meta: {
          document_analyzed: "Uploaded Text",
          timestamp: new Date().toISOString(),
          engine_version: "finops-1.0.0",
          model_config: {
            phase0_phase1: "gemini-2.5-pro-preview-05-06",
            phase3: "claude-opus-4-7",
            validators: "deterministic"
          }
        },
        phase_1_audit_logs: auditLogs,
        phase_2_validation: validationData,
        phase_3_strategy: {
          executive_summary: `**ANALYSIS ABORTED: LOW DATA INTEGRITY**\n\nSignal Strength ${Math.round(validationData.metrics.signal_strength)}% < ${SIGNAL_THRESHOLD}%. The AI could not verify enough FinOps criteria to form a safe strategy. Please provide more comprehensive FinOps-relevant documentation.`,
          visual_scorecard: { headline: "Audit Inconclusive", maturity_score: "N/A", burden_score: "N/A" },
          remediation_roadmap: []
        }
      };
    }

    onProgress('strategy', 20);
    const tacticsContext = await tacticsPromise;

    const definitionsContext = JSON.stringify(BATCH_DEFINITIONS, null, 2);
    const fullSSOT = `=== PART 1: THE CRITERIA (DEFINITIONS) ===\n${definitionsContext}\n\n=== PART 2: THE PLAYBOOK (SOLUTIONS) ===\n${tacticsContext}`;

    onProgress('strategy', 50);

    const handoffSummary = `
FINOPS DIAGNOSTIC REPORT SUMMARY (Computed by System):
-------------------------------------------------------
FinOps Readiness Score: ${Math.round(validationData.metrics.finops_readiness)}/100
Maturity Classification: ${validationData.crawl_walk_run}
Maturity Depth Index: ${Math.round(validationData.metrics.maturity_depth)}%
Anti-Pattern Burden: ${Math.round(validationData.metrics.antipattern_burden)}%
Signal Strength: ${Math.round(validationData.metrics.signal_strength)}%
Anti-Pattern Findings: ${validationData.antipattern_findings.length}
Maturity Gaps: ${validationData.maturity_gaps.length}
Silent Areas: ${validationData.silent_areas.length}

CATEGORY BREAKDOWN:
${Object.entries(validationData.category_scores).map(([cat, score]) => `  ${cat}: ${score}/15`).join('\n')}
`;

    const strategyResponse = await callOpusStrategy(
      [
        {
          role: "user",
          content: [
            { type: "text", text: STRATEGY_USER_PROMPT },
            { type: "text", text: `\n\n### THE GOLDEN STANDARD (SSOT)\nYou must ignore generic internet advice. You may ONLY prescribe solutions found in this Knowledge Base:\n\n${fullSSOT}` },
            { type: "text", text: `\n\n### DIAGNOSTIC FINDINGS (Phase 1 & 2)\nUse these specific gaps and anti-patterns to trigger the strategies above:\n${handoffSummary}` },
            { type: "text", text: `\n\n### ORIGINAL SOURCE CONTEXT\n<SOURCE_DOCUMENT_TO_AUDIT>\n${text.substring(0, 50000)}\n</SOURCE_DOCUMENT_TO_AUDIT>` }
          ]
        }
      ],
      STRATEGY_SYSTEM_INSTRUCTION
    );

    onProgress('strategy', 90);
    const strategyData = parseAiResponse(strategyResponse.text);

    const groundingValidation = validatePhase3Grounding(strategyData, validationData);
    if (groundingValidation.warnings.length > 0) {
      console.warn("[FinOps] Phase 3 grounding warnings:", groundingValidation.warnings);
    }

    onProgress('strategy', 100);

    return {
      meta: {
        document_analyzed: "Uploaded Text",
        timestamp: new Date().toISOString(),
        engine_version: "finops-1.0.0",
        model_config: {
          phase0_phase1: "gemini-2.5-pro-preview-05-06",
          phase3: "claude-opus-4-7",
          validators: "deterministic"
        }
      },
      phase_1_audit_logs: auditLogs,
      phase_2_validation: validationData,
      phase_3_strategy: strategyData.phase_3_strategy || {
        executive_summary: "Strategy incomplete.",
        visual_scorecard: { headline: "Error", maturity_score: "N/A", burden_score: "N/A" },
        remediation_roadmap: []
      }
    };

  } catch (error) {
    console.error("[FinOps Pipeline] Error:", error);
    throw error;
  }
};
