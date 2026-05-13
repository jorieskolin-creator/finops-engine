// Centralized model IDs. Swap these one-liners to change the engine's model
// mix without hunting through services.
//
// During technical testing we run cheap models only — `gemini-2.5-flash` for
// fan-out batch audits and DLP, `gemini-2.5-pro` for the single Phase 3
// strategy synthesis. The Anthropic path (callOpusStrategy / callSonnetValidator
// in services/anthropicService.ts) is left in the codebase but is not wired
// into the pipeline right now.

// Fast / cheap workhorse — Phase 1 parallel audit batches + Phase 0 DLP scan.
export const MODEL_PHASE1 = 'gemini-2.5-flash';

// More capable — Phase 3 strategy synthesis (one call per assessment).
export const MODEL_PHASE3 = 'gemini-2.5-pro';
