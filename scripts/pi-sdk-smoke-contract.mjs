export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";

export const SDK_VERSIONS = {
  "@earendil-works/pi-agent-core": "1.1.0",
  "@earendil-works/pi-ai": "1.1.0",
  "@earendil-works/pi-coding-agent": "1.1.0",
  "@earendil-works/pi-tui": "1.1.0",
};

export const QMD_COMMANDS = [
  "qmd-a:init",
  "qmd-a:status",
  "qmd-a:review",
  "qmd-a:approve",
  "qmd-a:configure",
  "qmd-a:install",
  "qmd-a:setup",
  "qmd-a:setup-run",
  "qmd-a:update",
  "qmd-a:update-run",
  "qmd-a:embed",
  "qmd-a:embed-run",
  "qmd-a:maintain",
  "qmd-a:maintain-run",
];

export const UNHANDLED_ERROR_PATTERN =
  /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN =
  /Failed to load extension|Error loading extension/i;

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

export function extensionRegistrationAssertion(commands, toolNames) {
  const commandRows = Array.isArray(commands) ? commands : [];
  const registeredCommands = commandRows
    .filter((command) => command?.source === "extension")
    .map((command) => command.name);
  const searchToolRegistered = Array.isArray(toolNames) && toolNames.includes("qmd_adaptive_search");
  const missingCommands = QMD_COMMANDS.filter((name) => !registeredCommands.includes(name));
  const observed = {
    qmdCommandCount: registeredCommands.filter((name) => QMD_COMMANDS.includes(name)).length,
    missingCommands,
    searchToolRegistered,
  };
  return assertion(
    "extension_registered",
    "Actual Pi registers all qmd-a commands and advertises qmd_adaptive_search to its provider",
    observed,
    missingCommands.length === 0 && searchToolRegistered,
  );
}

export function toolResponseAssertion(records, {
  expectedPath,
  expectError = false,
  toolName = "qmd_adaptive_search",
  expectedErrorText,
} = {}) {
  const event = [...(Array.isArray(records) ? records : [])]
    .reverse()
    .find((record) => record?.type === "tool_execution_end" && record.toolName === toolName);
  const content = Array.isArray(event?.result?.content) ? event.result.content : [];
  const text = content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
  const details = event?.result?.details;
  const resultPaths = Array.isArray(details?.resultPaths) ? details.resultPaths : [];
  const passed = expectError
    ? event?.isError === true && text.length > 0 && (!expectedErrorText || text.includes(expectedErrorText))
    : event?.isError === false && resultPaths.includes(expectedPath) && text.includes(expectedPath);
  const expected = expectError
    ? `Pi reports ${toolName} rejection as a handled tool error${expectedErrorText ? ` containing ${expectedErrorText}` : ""}`
    : `Pi runs qmd_adaptive_search and returns ${expectedPath} in text and structured details`;
  return assertion(
    expectError ? "handled_error" : "feature_response",
    expected,
    event ? { isError: event.isError, text, resultPaths } : null,
    passed,
  );
}

export function extensionCommandAssertion(processResult, initializedConfig) {
  const promptResponse = processResult?.records?.find((record) => record?.id === "smoke-prompt");
  const notification = processResult?.records?.find((record) =>
    record?.type === "extension_ui_request" &&
    record.method === "notify" &&
    record.message === "qmd adaptive config initialized",
  );
  const expectedConfig = initializedConfig &&
    typeof initializedConfig.changeDetection?.manifestEnabled === "boolean" &&
    Array.isArray(initializedConfig.fileGlobs);
  return assertion(
    "extension_command_response",
    "Pi handles /qmd-a:init, emits its notification, and creates the project config",
    {
      prompt: promptResponse ? { success: promptResponse.success, disposition: promptResponse.data?.disposition } : null,
      notification: notification?.message ?? null,
      configCreated: expectedConfig === true,
    },
    promptResponse?.success === true && promptResponse.data?.disposition === "handled" &&
      !!notification && expectedConfig === true,
  );
}

export function shutdownAssertion(processResult) {
  const settled = Array.isArray(processResult?.records)
    ? processResult.records.find((record) => record?.type === "agent_settled")
    : undefined;
  const hasErrors = UNHANDLED_ERROR_PATTERN.test(processResult?.output ?? "");
  const commandHandled = processResult?.commandHandled === true;
  const completed = (settled && settled.aborted !== true) || commandHandled;
  const observed = {
    exit_code: processResult?.exit_code ?? null,
    agentSettled: settled ? { aborted: settled.aborted === true } : null,
    commandHandled,
    errors: hasErrors,
    timedOut: processResult?.timedOut === true,
    shutdownTimedOut: processResult?.shutdownTimedOut === true,
    launchError: processResult?.launchError ?? null,
  };
  return assertion(
    "clean_shutdown",
    "Actual Pi reaches agent_settled and exits zero without unhandled or shutdown errors",
    observed,
    processResult?.exit_code === 0 && !!completed && !hasErrors &&
      processResult?.timedOut !== true && processResult?.shutdownTimedOut !== true && !processResult?.launchError,
  );
}

export function hostShellAssertion({ exit_code, output, expectedVersion }) {
  return assertion(
    "native_shell_boundary",
    "Native host shell starts the locally pinned Pi CLI and returns its exact version",
    { exit_code, output: String(output ?? "").trim(), expectedVersion },
    exit_code === 0 && typeof expectedVersion === "string" && expectedVersion.length > 0 && String(output ?? "").trim() === expectedVersion,
  );
}

export function reloadAssertions(first, second, { commands, toolNames, expectedPath }) {
  const registration = extensionRegistrationAssertion(commands, toolNames);
  const feature = toolResponseAssertion(second.records, { expectedPath });
  const firstShutdown = shutdownAssertion(first);
  const secondShutdown = shutdownAssertion(second);
  return [
    assertion(
      "reloaded_extension_registered",
      registration.expected,
      registration.observed,
      registration.passed,
    ),
    assertion(
      "reloaded_feature_response",
      "The second Pi process executes qmd_adaptive_search and returns the fixture path",
      feature.observed,
      feature.passed,
    ),
    assertion(
      "clean_shutdown",
      "Both actual Pi processes settle and exit zero without unhandled or shutdown errors",
      { first: JSON.parse(firstShutdown.observed), second: JSON.parse(secondShutdown.observed) },
      firstShutdown.passed && secondShutdown.passed,
    ),
  ];
}
