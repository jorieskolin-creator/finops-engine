
import { StrategicTactic } from '../types';
import criteriaData from './finops_criteria.json';
import antipatternData from './finops_antipatterns.json';
import keywordsData from './finops_preflight_keywords.json';
import taxonomyData from './finops_evidence_taxonomy.json';
import personasData from './finops_personas.json';
import tacticsData from './finops_tactics_database.json';
import validationData from './finops_validation_rules.json';

export const FINOPS_CRITERIA = criteriaData.criteria;
export const FINOPS_ANTIPATTERNS = antipatternData.criteria;
export const FINOPS_KEYWORDS = keywordsData;
export const FINOPS_EVIDENCE_TAXONOMY = taxonomyData;
export const FINOPS_PERSONAS = personasData;
export const FINOPS_TACTICS_LOCAL = tacticsData.tactics as StrategicTactic[];
export const FINOPS_VALIDATION_RULES = validationData;

const MASTER_BINGO_FINOPS = {
  maturity: FINOPS_CRITERIA.map(c => ({
    id: c.id,
    title: c.title,
    desc: c.description
  })),
  antipattern: FINOPS_ANTIPATTERNS.map(c => ({
    id: c.id,
    title: c.title,
    desc: c.description
  }))
};

export { MASTER_BINGO_FINOPS };

const buildBatchXml = (items: typeof FINOPS_CRITERIA, batchId: string): string => {
  return items
    .filter(c => c.batch === batchId)
    .map(c => `
        <item id="${c.id}">
            <title>${c.title}</title>
            <description>${c.description}</description>
            <criteria>
            ${c.sub_criteria.map((sc, i) => `${i + 1}. ${sc}`).join('\n            ')}
            </criteria>
        </item>`)
    .join('\n');
};

interface BatchDefinition {
  title: string;
  maturity: string;
  antipattern: string;
}

const BATCH_TITLES: Record<string, string> = {
  A: 'Cost Visibility & Allocation',
  B: 'Rate & Usage Optimization',
  C: 'Governance & Policy',
  D: 'Architecture & Engineering',
  E: 'Culture & Organization'
};

export const BATCH_DEFINITIONS: Record<string, BatchDefinition> = {};
for (const batchId of ['A', 'B', 'C', 'D', 'E']) {
  BATCH_DEFINITIONS[batchId] = {
    title: BATCH_TITLES[batchId],
    maturity: buildBatchXml(FINOPS_CRITERIA, batchId),
    antipattern: buildBatchXml(FINOPS_ANTIPATTERNS, batchId)
  };
}

export const SHARED_GUARDRAILS = `
<task>
You are a **Cloud Financial Forensic Auditor**. Your job is to extract **explicit proof** from the text.
**CRITICAL:** You must NOT give the "benefit of the doubt". You are looking for Traceable Evidence.

For EVERY item in the provided Knowledge Base, you must determine **Signal Strength (Count)**:

**SCALE:**
*   **0 (Absent):** No evidence found.
    *   *Stream A (Maturity):* This is **BAD** (Missing Capability).
    *   *Stream B (Anti-Pattern):* This is **GOOD** (Clean/Healthy).
*   **1 (Aspirational):** Buzzwords, plans, or vague intent only. Plans = Score 1 max.
*   **2 (Operational):** Behavior or process is described and functioning.
*   **3 (Embedded):** Explicit mechanisms, automation, enforcement, or cultural norms.
    *   *Stream A (Maturity):* This is **GOOD** (Mature Capability).
    *   *Stream B (Anti-Pattern):* This is **BAD** (Deep Structural Problem).

**RULES OF EVIDENCE (THE "CLEAN ROOM" PROTOCOL):**
1. **Source of Truth:** You must **ONLY** extract evidence from the XML tag <UNTRUSTED_CONTENT>.
2. **No Inference:** If the text says "We plan to implement cost tagging", that is NOT evidence of a tagging system. Score 1 max.
3. **Tool Presence ≠ Practice:** Mentioning a tool does not prove active use. Look for HOW it is used.
4. **Silence is Data:** If the text is silent, score is **0**. Do not hallucinate.
5. **Financial Sensitivity:** Do not extract specific dollar amounts or account numbers.
6. **Documentation ≠ Practice:** A policy document = Score 1-2. Only enforcement evidence = Score 3.
</task>

<output_format>
STRICTLY return a JSON object. Do not include any text outside the JSON.
**IMPORTANT**: You must analyze ALL 10 items in this batch. Do not skip items.
If an item has score 0, you must still provide the reasoning why (e.g., "Document was silent").

**STEP-BY-STEP FORMATTING**:
For every item, include a "reasoning" field BEFORE the score.
For every item with score > 0, include at least one evidence quote from the source document.
</output_format>
`;

const FALLBACK_TACTICS: StrategicTactic[] = [
  {
    id: "TAC-FALLBACK",
    category: "Visibility",
    problem_pattern: "Missing Cost Visibility",
    solution_mechanism: "Implement Team-Level Cost Dashboards",
    case_study: "AIRBNB: Built internal cost attribution platform showing real-time cost per service."
  }
];

export const knowledgeBaseService = {
  async fetchStrategicPlaybook(): Promise<string> {
    let tactics: StrategicTactic[] = [];
    let blobUrl: string | undefined = undefined;

    const HARDCODED_URL = "";

    const meta = import.meta as any;
    if (meta?.env?.VITE_FINOPS_TACTICS_URL) {
      blobUrl = meta.env.VITE_FINOPS_TACTICS_URL;
    }

    if (!blobUrl) {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env?.VITE_FINOPS_TACTICS_URL) {
          // @ts-ignore
          blobUrl = process.env.VITE_FINOPS_TACTICS_URL;
        }
      } catch (e) {}
    }

    if (blobUrl) {
      try {
        console.log(`[FinOps KnowledgeBase] Fetching tactics DB from Vercel Blob...`);
        const response = await fetch(blobUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'force-cache'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        tactics = await response.json();
      } catch (error) {
        console.error("[FinOps KnowledgeBase] Remote fetch failed, using local DB:", error);
        tactics = FINOPS_TACTICS_LOCAL;
      }
    } else {
      console.info("[FinOps KnowledgeBase] No remote URL configured. Using built-in tactics database.");
      tactics = FINOPS_TACTICS_LOCAL;
    }

    if (!tactics || tactics.length === 0) {
      tactics = FALLBACK_TACTICS;
    }

    const formattedContext = tactics.map(t => {
      let entry = `[${t.category}] IF FOUND "${t.problem_pattern}" -> PRESCRIBE "${t.solution_mechanism}".`;
      entry += `\n   PROOF: ${t.case_study}`;
      if (t.prerequisites?.length) {
        entry += `\n   PREREQUISITES: ${t.prerequisites.join(', ')}`;
      }
      if (t.expected_outcome) {
        entry += `\n   EXPECTED OUTCOME: ${t.expected_outcome}`;
      }
      if (t.risk_notes) {
        entry += `\n   RISK: ${t.risk_notes}`;
      }
      if (t.resource_label) {
        entry += `\n   REFERENCE: ${t.resource_label}`;
      }
      return entry;
    }).join("\n\n");

    return `<VERIFIED_TACTICS_DATABASE>\n${formattedContext}\n</VERIFIED_TACTICS_DATABASE>`;
  }
};
