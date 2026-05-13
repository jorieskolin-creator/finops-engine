
import { generateBatchSystemInstruction, generateBatchUserPrompt } from './prompts';
import { BATCH_DEFINITIONS } from './knowledge_base';
import { GoogleGenAI } from "@google/genai";

const parseAiResponse = (text: string): any => {
  if (!text) return {};
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[FinOps Orchestrator] AI Response contained no JSON braces. Raw:", text.substring(0, 200));
    return {};
  }
  const jsonString = jsonMatch[0];
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("[FinOps Orchestrator] JSON Parse Failed. Raw Text:", text.substring(0, 500));
    throw new Error("AI response was not valid JSON.");
  }
};

const callGeminiGenerate = async (model: string, contents: any[], systemInstruction: string) => {
  const isDev = (import.meta as any)?.env?.DEV;

  if (isDev || !window.location.host.includes('vercel.app')) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });
    return { text: response.text };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 595000);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, contents, systemInstruction }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 404) {
        clearTimeout(timeoutId);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const fallbackResponse = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json"
          }
        });
        return { text: fallbackResponse.text };
      }
      const errorText = await response.text();
      throw new Error(`Proxy Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const runPhase1Audit = async (text: string, onProgress: (completed: number, total: number) => void): Promise<any> => {
  const batches = ['A', 'B', 'C', 'D', 'E'];
  const totalBatches = batches.length;

  const aggregatedResults = {
    phase_1_audit_logs: {
      maturity: {} as Record<string, any>,
      antipattern: {} as Record<string, any>
    }
  };

  let completedCount = 0;

  const auditPromises = batches.map(async (batchId) => {
    try {
      const definitions = BATCH_DEFINITIONS[batchId];
      const systemInstruction = generateBatchSystemInstruction(batchId, definitions.title);
      const userPrompt = generateBatchUserPrompt(batchId, definitions);

      const response = await callGeminiGenerate(
        'gemini-2.5-pro-preview-05-06',
        [
          {
            role: 'user',
            parts: [
              { text: userPrompt },
              { text: `\n\n<UNTRUSTED_CONTENT>\n${text}\n</UNTRUSTED_CONTENT>` }
            ]
          }
        ],
        systemInstruction
      );

      try {
        const batchResult = parseAiResponse(response.text);
        if (batchResult.maturity) Object.assign(aggregatedResults.phase_1_audit_logs.maturity, batchResult.maturity);
        if (batchResult.antipattern) Object.assign(aggregatedResults.phase_1_audit_logs.antipattern, batchResult.antipattern);
      } catch (parseError) {
        console.error(`[FinOps] Error Parsing Batch ${batchId}:`, parseError);
      }

    } catch (error) {
      console.error(`[FinOps] Error processing Batch ${batchId}:`, error);
    } finally {
      completedCount++;
      onProgress(completedCount, totalBatches);
    }
  });

  await Promise.all(auditPromises);
  return aggregatedResults;
};
