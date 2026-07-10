# Testing NextDJ

## Local quality gates

Run the same static, unit, coverage, and production-build checks used by CI:

```bash
npm run check
npm run test:coverage
```

Coverage has a modest repository-wide floor and higher, path-specific floors
for recording admission, playlist validation, deck transport, output routing,
library persistence, and performance instrumentation. Raise a focused floor
when adding tests to one of those subsystems; do not lower one to merge an
untested behavior change.

The HTML report is written to `coverage/`, and `coverage/coverage-summary.json`
is suitable for CI artifact inspection.
