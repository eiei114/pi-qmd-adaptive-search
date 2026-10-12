import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionCommandAssertion,
  extensionRegistrationAssertion,
  reloadAssertions,
  shutdownAssertion,
  toolResponseAssertion,
} from "./pi-sdk-smoke-contract.mjs";

const commands = [
  { name: "qmd-a:status", source: "extension" },
  { name: "qmd-a:init", source: "extension" },
];
const toolNames = ["qmd_adaptive_search", "qmd_search_feedback", "qmd_adaptive_status"];
const successfulTool = {
  type: "tool_execution_end",
  toolName: "qmd_adaptive_search",
  isError: false,
  result: {
    content: [{ type: "text", text: "qmd_adaptive_search: 1 result(s)\n1. docs/ReleaseDecision.md" }],
    details: { resultPaths: ["docs/ReleaseDecision.md"] },
  },
};

test("feature response requires actual text and structured search results", () => {
  assert.equal(
    toolResponseAssertion([successfulTool], { expectedPath: "docs/ReleaseDecision.md" }).passed,
    true,
  );
  assert.equal(toolResponseAssertion([], { expectedPath: "docs/ReleaseDecision.md" }).passed, false);
  assert.equal(
    toolResponseAssertion(
      [{ ...successfulTool, result: { content: successfulTool.result.content, details: { resultPaths: [] } } }],
      { expectedPath: "docs/ReleaseDecision.md" },
    ).passed,
    false,
  );
});

test("handled error requires a real failed tool result", () => {
  const failedTool = {
    type: "tool_execution_end",
    toolName: "qmd_adaptive_search",
    isError: true,
    result: { content: [{ type: "text", text: "Invalid arguments: query must be a string" }] },
  };
  assert.equal(toolResponseAssertion([failedTool], { expectError: true }).passed, true);
  assert.equal(toolResponseAssertion([], { expectError: true }).passed, false);
  assert.equal(toolResponseAssertion([successfulTool], { expectError: true }).passed, false);
});

test("extension command response requires the handled RPC response, notification, and created config", () => {
  const handledCommand = {
    commandHandled: true,
    records: [
      { id: "smoke-prompt", success: true, data: { disposition: "handled" } },
      { type: "extension_ui_request", method: "notify", message: "qmd adaptive config initialized" },
    ],
  };
  const config = { changeDetection: { manifestEnabled: false }, fileGlobs: ["**/*.md"] };
  assert.equal(extensionCommandAssertion(handledCommand, config).passed, true);
  assert.equal(extensionCommandAssertion({ records: [] }, config).passed, false);
  assert.equal(extensionCommandAssertion(handledCommand, null).passed, false);
});

test("reload contract fails closed when second-process registration or response is missing", () => {
  const settled = { type: "agent_settled", aborted: false };
  const processResult = { exit_code: 0, output: "", records: [settled] };
  const positive = reloadAssertions(processResult, { ...processResult, records: [successfulTool, settled] }, {
    commands: [
      ...commands,
      ...["qmd-a:review", "qmd-a:approve", "qmd-a:configure", "qmd-a:install", "qmd-a:setup", "qmd-a:setup-run", "qmd-a:update", "qmd-a:update-run", "qmd-a:embed", "qmd-a:embed-run", "qmd-a:maintain", "qmd-a:maintain-run"].map((name) => ({ name, source: "extension" })),
    ],
    toolNames,
    expectedPath: "docs/ReleaseDecision.md",
  });
  assert.equal(positive.every((item) => item.passed), true);

  const missingReloadResponse = reloadAssertions(processResult, processResult, {
    commands,
    toolNames: [],
    expectedPath: "docs/ReleaseDecision.md",
  });
  assert.equal(missingReloadResponse[0].passed, false);
  assert.equal(missingReloadResponse[1].passed, false);
  assert.equal(shutdownAssertion({ exit_code: 0, output: "", records: [] }).passed, false);
  assert.ok(JSON.parse(positive[2].observed).second.agentSettled);
});
