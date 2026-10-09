# Pathsmith: offline workflow evaluation sample

This portfolio project runs a synthetic support-routing workflow through Pathsmith's portable TypeScript runtime. It compares a baseline policy that routes automatically at confidence `>= 0.70` with a candidate policy that uses `>= 0.80`. The policy change creates two new assertion regressions and one improvement in the authored twelve-case suite. Routing is a recommendation only: the demo sends no messages or ticket updates.

## Run it

Use Node.js 24 and pnpm 10.33.0. From this directory:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm test
corepack pnpm demo
```

The demo prints all 24 executed cases with their outcome, assertion status, and selected graph edges. A sample from an actual run:

```text
BASELINE  12/12 completed  11 passed  1 failed  10/10 branch ports  16 judgments
  ✓ billing_threshold_075       billing_priority     e_start_next → e_assess_request_next → e_confidence_gate_auto → e_department_router_billing → e_billing_priority_priority
  ✗ technical_threshold_079     technical_standard   e_start_next → e_assess_request_next → e_confidence_gate_auto → e_department_router_technical → e_technical_context_next → e_technical_priority_default

CANDIDATE  12/12 completed  10 passed  2 failed  10/10 branch ports  14 judgments
  ✗ billing_threshold_075       manual_review        e_start_next → e_assess_request_next → e_confidence_gate_default
  ✓ technical_threshold_079     manual_review        e_start_next → e_assess_request_next → e_confidence_gate_default

Comparison: 3 changed, 2 new regressions, 1 improvement; gate fail.
  billing_threshold_075: billing_priority → manual_review (regression)
  technical_threshold_070: technical_priority → manual_review (regression)
  technical_threshold_079: technical_standard → manual_review (improvement)
```

The baseline's existing failed expectation is intentional. The comparison gate fails because two previously passing cases regress; branch coverage remains 10/10 in both runs, showing why coverage and correctness must be reported separately.

## How it works

`examples/support-routing/` holds two canonical workflow definitions, a shared suite of human-authored expectations, exact-request mock responses, and an independently checked expected-results file. The only workflow edit between versions is the automatic-routing confidence threshold. A technical case reaches a second judgment whose state explicitly includes the earlier judgment's answers.

`packages/contracts` validates JSON shape and graph semantics. `packages/core` executes one active path through the validated graph, evaluates the restricted expression tree, and records the route. `packages/provider-mock` accepts only exact fixture requests. `packages/evaluation` applies the suite's expectations, computes observed coverage, and compares complete runs. The terminal program in `demo/run.mjs` uses these built package exports; it contains no routing or assertion algorithm of its own. Tests cover schema and graph rejection, expression rules, exact mock matching, the 24 observed outcomes and paths, and the three changed cases against the independent expectation file.

All fixture inputs, response probabilities, confidence values, and expected outcomes are synthetic illustration. They are not live model results, recommended support policies, or evidence of real-world routing quality. `expected-results.json` is an independent oracle, not a runtime report or a replay recording.

This is a deliberately limited public sample of the local runtime. It does not include the private product's web editor, API, persistence, live provider adapters, credentials, deployment setup, or internal planning material. The four packages remain private workspace packages and are not published to a registry. No public open-source license is assigned.
