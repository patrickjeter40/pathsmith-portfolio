import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runDemo } from "../demo/run.mjs";
import { createMockProvider } from "@pathsmith/provider-mock";
import { executeWorkflow } from "@pathsmith/core";
import { parseJson } from "@pathsmith/contracts";

const load = async (name) => parseJson(await readFile(new URL(`../examples/support-routing/${name}`, import.meta.url), "utf8"));

test("24 mock executions agree with independently checked outcomes and paths", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Network is forbidden in portfolio tests"); };
  let results;
  try {
    results = await runDemo();
  } finally {
    globalThis.fetch = originalFetch;
  }
  const { reports, comparison } = results;
  const expected = await load("expected-results.json");
  for (const name of ["baseline", "candidate"]) {
    const report = reports[name];
    const wanted = expected[name];
    assert.equal(report.summary.completed, wanted.completed);
    assert.equal(report.summary.assertionPassed, wanted.assertionPassed);
    assert.equal(report.summary.assertionFailed, wanted.assertionFailed);
    assert.equal(report.summary.logicalJudgments, wanted.logicalJudgments);
    assert.equal(report.coverage.branchPortsVisited, wanted.branchPortsVisited);
    assert.equal(report.coverage.branchPortsTotal, wanted.branchPortsTotal);
    assert.equal(report.summary.actualHttpAttempts, 0);
    assert.equal(report.scenarios.length, 12);
    for (const row of report.scenarios) {
      const oracle = wanted.scenarios.find((item) => item.scenarioId === row.scenarioId);
      assert.ok(oracle, row.scenarioId);
      assert.equal(row.status, oracle.executionStatus);
      assert.equal(row.assertionStatus, oracle.assertionStatus);
      assert.equal(row.result?.outcomeId, oracle.outcomeId);
      assert.deepEqual(row.result?.value, oracle.value);
      assert.deepEqual(row.visitedNodes, oracle.visitedNodes);
      assert.deepEqual(row.selectedEdges, oracle.selectedEdges);
      assert.equal(row.logicalJudgments, oracle.logicalJudgments);
    }
  }
  assert.equal(comparison.gate, "fail");
  assert.equal(comparison.changedCases, 3);
  assert.equal(comparison.newAssertionRegressions, 2);
  assert.equal(comparison.assertionImprovements, 1);
  assert.deepEqual(comparison.cases.filter((c) => c.newAssertionRegression).map((c) => c.scenarioId).sort(), ["billing_threshold_075", "technical_threshold_070"]);
  assert.deepEqual(comparison.cases.filter((c) => c.assertionImprovement).map((c) => c.scenarioId), ["technical_threshold_079"]);
});

test("a changed request fails exact mock matching without fallback", async () => {
  const [workflow, suite, fixtures] = await Promise.all([
    load("baseline.workflow.json"), load("suite.json"), load("mock-fixtures.json"),
  ]);
  const changed = structuredClone(workflow);
  changed.nodes.find((node) => node.id === "assess_request").questions.department.instructions += " Changed";
  const result = await executeWorkflow({
    workflow: changed,
    input: suite.scenarios[0].input,
    scenarioId: suite.scenarios[0].id,
    mode: "mock",
    bindings: { decisions: { providerId: "mock", model: "mock-v1", adapter: createMockProvider(fixtures) } },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error.code, "MOCK_REQUEST_MISMATCH");
  assert.equal(result.actualHttpAttempts, 0);
});
