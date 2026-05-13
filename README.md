# Golden Test Corpus for Drift Detection

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
