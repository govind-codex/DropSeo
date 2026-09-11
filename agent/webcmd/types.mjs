/**
 * Runtime constants and JSDoc types for Sitepulse's Webcmd integration.
 * Webcmd's public workflow primitive is a sandboxed Playwright-style
 * `browser run` program, so stored steps remain portable and auditable.
 */

export const WORKFLOW_STATUSES = ["learned", "validated", "stale", "failed"];
export const WORKFLOW_STEP_TYPES = ["navigate", "click", "type", "extract", "wait", "verify"];

/** @typedef {"navigate"|"click"|"type"|"extract"|"wait"|"verify"} WorkflowStepType */

/**
 * @typedef {object} WorkflowTarget
 * @property {string=} role
 * @property {string=} name
 * @property {string=} href
 * @property {string=} selector
 */

/**
 * @typedef {object} WorkflowStep
 * @property {WorkflowStepType} type
 * @property {string} description
 * @property {WorkflowTarget=} target
 * @property {string=} url
 * @property {string=} value
 * @property {number=} durationMs
 * @property {string=} expectedOutcome
 */

/**
 * @typedef {object} LearnedWorkflow
 * @property {string} id
 * @property {string} domain
 * @property {string} name
 * @property {string} goal
 * @property {string} runType
 * @property {WorkflowStep[]} steps
 * @property {"learned"|"validated"|"stale"|"failed"} status
 * @property {number} successRate
 * @property {number} attempts
 * @property {number} successes
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string=} lastValidatedAt
 * @property {{passed: boolean, at: string, finalUrl?: string, message?: string}=} lastResult
 * @property {{provider: "webcmd", mode: "browser-run", version?: string, profile: string}} webcmd
 */

export function isWorkflowStep(value) {
  return Boolean(value && typeof value === "object" && WORKFLOW_STEP_TYPES.includes(value.type) && typeof value.description === "string");
}

export function isLearnedWorkflow(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.domain === "string" &&
    Array.isArray(value.steps) &&
    value.steps.every(isWorkflowStep) &&
    WORKFLOW_STATUSES.includes(value.status),
  );
}
