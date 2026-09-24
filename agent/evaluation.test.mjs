import assert from "node:assert/strict";
import test from "node:test";
import { assessGoalCompletion, assessVerification } from "./evaluation.mjs";

test("confirms a journey only when the goal is supported by changed browser evidence", () => {
  const result = assessGoalCompletion({
    goal: "Find the English encyclopedia without signing in",
    observation: { url: "https://en.wikipedia.org/wiki/Main_Page", title: "Wikipedia, the free encyclopedia", text: "Welcome to Wikipedia in English" },
    history: [{ ok: true, changed: true }],
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.matchedTerms.sort(), ["encyclopedia", "english"]);

  const unchanged = assessGoalCompletion({ goal: "Find pricing", observation: { url: "https://example.com/", title: "Home", text: "Pricing" }, history: [] });
  assert.equal(unchanged.passed, false);
});

test("verification requires a previous workflow and a passing replay", () => {
  assert.equal(assessVerification({ baselineWorkflow: null, replayResult: { passed: true } }).passed, false);
  assert.equal(assessVerification({ baselineWorkflow: { id: "known" }, replayResult: null }).passed, false);
  assert.equal(assessVerification({ baselineWorkflow: { id: "known" }, replayResult: { passed: false, message: "CTA missing" } }).passed, false);
  assert.equal(assessVerification({ baselineWorkflow: { id: "known" }, replayResult: { passed: true, message: "Passed" } }).passed, true);
});
