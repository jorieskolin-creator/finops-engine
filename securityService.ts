
import DOMPurify from 'dompurify';

export const forensicSanitizeImport = (dirtyHtml: string): string => {
  return DOMPurify.sanitize(dirtyHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'onmouseover', 'onclick', 'onerror', 'onload']
  });
};

export const generateSafetyAuditPrompt = (textSample: string) => `
<task>
You are a **Data Loss Prevention (DLP) Officer** for a FinOps Assessment Engine.
Scan the following text sample (first 1500 chars) for High-Risk Content.

**HIGH-RISK CATEGORIES:**
1. **PII:** Social Security Numbers, Passport Numbers, Home Addresses, Personal Financial Data.
2. **SECRETS:** API Keys (AWS AKIA*, Azure keys, GCP service account keys), Passwords, Private Keys, Tokens.
3. **CLOUD CREDENTIALS:** Cloud account IDs with associated access keys, billing account numbers with pricing details.
4. **FINANCIAL SENSITIVITY:** Exact contract values, specific negotiated discount rates, EDP pricing terms (flag but do not block — mark as CAUTION).
5. **IRRELEVANCE:** Cooking recipes, fiction, code repositories, or gibberish.

**IMPORTANT:** Documents about cloud costs, budgets, and FinOps strategies are EXPECTED and should pass even if they mention dollar amounts in a business context. Only flag raw financial instruments or personal financial data.

**OUTPUT FORMAT:**
Return a JSON object ONLY:
{
  "safe": boolean,
  "risk_detected": "None" | "PII" | "Secrets" | "CloudCredentials" | "FinancialSensitivity" | "Irrelevant",
  "reason": "Short explanation",
  "caution_notes": "Optional: notes about financial sensitivity that should be handled with care"
}
</task>

<text_sample>
${textSample.substring(0, 1500)}...
</text_sample>
`;

export const validateMetadataPayload = (payload: any): boolean => {
  if (!payload) return false;
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > 500000) return false;
  const validKeys = ['meta', 'phase_1_audit_logs', 'phase_2_validation', 'phase_3_strategy'];
  return validKeys.every(k => k in payload);
};
