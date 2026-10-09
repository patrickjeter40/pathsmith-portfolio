import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseJson, validateFixtures, validateSuite, validateWorkflow } from "@pathsmith/contracts";
import { runSuite, compareRuns } from "@pathsmith/evaluation";
import { createMockProvider } from "@pathsmith/provider-mock";

const fixtureUrl = new URL("../examples/support-routing/", import.meta.url);
const load = async (name) => parseJson(await readFile(new URL(name, fixtureUrl), "utf8"));

function requireValid(label, validation) {
  if (!validation.valid) throw new Error(`${label}: ${JSON.stringify(validation.diagnostics)}`);
}

export async function runDemo() {
  const [baseline, candidate, suite, fixtures] = await Promise.all([
    load("baseline.workflow.json"), load("candidate.workflow.json"),
    load("suite.json"), load("mock-fixtures.json"),
  ]);
  requireValid("Baseline workflow", validateWorkflow(baseline));
  requireValid("Candidate workflow", validateWorkflow(candidate));
  requireValid("Suite against baseline", validateSuite(suite, baseline));
  requireValid("Suite against candidate", validateSuite(suite, candidate));
  requireValid("Mock fixtures", validateFixtures(fixtures));

  const binding = () => ({
    decisions: { providerId: "mock", model: "mock-v1", adapter: createMockProvider(fixtures) },
  });
  const reports = {};
  for (const [name, workflow] of [["baseline", baseline], ["candidate", candidate]]) {
    reports[name] = await runSuite({ workflow, suite, mode: "mock", bindings: binding(), concurrency: 1 });
    if (reports[name].status !== "completed") throw new Error(`${name} run did not complete: ${reports[name].status}`);
  }
  const comparison = compareRuns(reports.baseline, reports.candidate);
  return { reports, comparison };
}

function printReport(name, report) {
  const s = report.summary;
  console.log(`\n${name.toUpperCase()}  ${s.completed}/${s.selected} completed  ${s.assertionPassed} passed  ${s.assertionFailed} failed  ${report.coverage.branchPortsVisited}/${report.coverage.branchPortsTotal} branch ports  ${s.logicalJudgments} judgments`);
  for (const row of report.scenarios) {
    const path = row.selectedEdges.join(" → ");
    console.log(`  ${row.assertionStatus === "passed" ? "✓" : "✗"} ${row.scenarioId.padEnd(27)} ${String(row.result?.outcomeId ?? row.status).padEnd(20)} ${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { reports, comparison } = await runDemo();
  printReport("baseline", reports.baseline);
  printReport("candidate", reports.candidate);
  console.log(`\nComparison: ${comparison.changedCases} changed, ${comparison.newAssertionRegressions} new regressions, ${comparison.assertionImprovements} improvement; gate ${comparison.gate}.`);
  for (const row of comparison.cases.filter((c) => c.behaviorChanged)) {
    const verdict = row.newAssertionRegression ? "regression" : row.assertionImprovement ? "improvement" : "changed";
    console.log(`  ${row.scenarioId}: ${row.baseline.outcome} → ${row.candidate.outcome} (${verdict})`);
  }
  console.log("Synthetic, offline mock data. No live provider requests or external actions.");
}
