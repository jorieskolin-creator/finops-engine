# FinOps Engine

Evidence-gated FinOps Maturity Assessment scanner. React + TypeScript + Vite frontend; Gemini and Anthropic providers proxied through Vercel serverless functions under `api/`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in API_KEY and ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Set environment variables in **Project Settings → Environment Variables**:
   - `API_KEY` — Gemini key (server-side only, never exposed to browser)
   - `ANTHROPIC_API_KEY` — Anthropic key (server-side only)
   - `VITE_FINOPS_TACTICS_URL` — optional public Blob URL for the tactics DB
3. Build command: `npm run build` (default). Output: `dist/`.
4. The serverless functions in `api/` are auto-registered by Vercel; `vercel.json` grants them up to 600s execution.

Secrets are **not** inlined into the client bundle — `vite.config.ts` only exposes `VITE_*` vars. All Gemini/Anthropic traffic from the browser goes through `/api/generate` and `/api/anthropic-generate`.

## Deployment (Railway)

Railway can host the same build via its Vite preset; configure the same env vars in the service settings. Note that `api/*.js` are written for the Vercel function runtime — running on Railway as a Node server would require a small adapter.

---

## Golden Test Corpus for Drift Detection

Synthetic FinOps documents with known maturity profiles. Used to detect when Gemini model updates silently change scoring behavior.

## Documents

| File | Profile | Expected Classification | Purpose |
|------|---------|------------------------|---------|
| `golden-crawl.txt` | Immature org | Crawl | Low maturity, high anti-patterns |
| `golden-walk.txt` | Partially mature | Walk | Mix of signals |
| `golden-run.txt` | Mature org | Run | High maturity, low anti-patterns |

## How to Use

1. Upload each golden document pair (you need 2+ files per assessment) to the engine
2. Run assessment
3. Compare Phase 1 scores against `knowledge_base/golden_baselines.json`
4. Use `services/driftDetectionService.ts` to automate the comparison

## When to Run

- After every Gemini model update
- Before every production release
- Quarterly as a baseline check

## Important

These are **synthetic** documents. Do not modify them — their content is calibrated to the expected score ranges in `golden_baselines.json`. If you change the criteria definitions, update the baselines accordingly.
