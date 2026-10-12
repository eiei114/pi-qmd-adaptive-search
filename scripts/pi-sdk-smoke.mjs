import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  EXTENSION_LOAD_ERROR_PATTERN,
  SDK_VERSIONS,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
  extensionCommandAssertion,
  extensionRegistrationAssertion,
  hostShellAssertion,
  reloadAssertions,
  shutdownAssertion,
  toolResponseAssertion,
} from "./pi-sdk-smoke-contract.mjs";

ensureRuntimeSupportsSdk();

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const reportPath = join(root, "docs", "verification", "pi-sdk-smoke.json");
const fixturePath = "docs/ReleaseDecision.md";
const probeTimeoutMs = 15_000;
const sdkVersions = {};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = readJson(join(root, "package.json"));
for (const [name, expected] of Object.entries(SDK_VERSIONS)) {
  const installed = readJson(join(root, "node_modules", name, "package.json")).version;
  if (installed !== expected || manifest.devDependencies?.[name] !== expected) {
    throw new Error(`Smoke requires exact ${name}@${expected}; installed=${installed}, devDependency=${manifest.devDependencies?.[name]}`);
  }
  sdkVersions[name] = installed;
}

const piManifest = readJson(join(root, "node_modules", "@earendil-works", "pi-coding-agent", "package.json"));
const piCli = join(root, "node_modules", "@earendil-works", "pi-coding-agent", piManifest.bin.pi);
const temporaryRoot = mkdtempSync(join(tmpdir(), "pi-qmd-sdk-smoke-"));
const projectRoot = join(temporaryRoot, "project");
const agentDir = join(temporaryRoot, "agent");
mkdirSync(join(projectRoot, "docs"), { recursive: true });
mkdirSync(agentDir, { recursive: true });
writeFileSync(
  join(projectRoot, fixturePath),
  "# Release decision\nThe release rollout decision is to ship in stages, starting with internal users.\n",
  "utf8",
);

const providerState = { mode: "text", requests: [] };

function chunk({ delta, finishReason = null }) {
  return {
    id: "qmd-sdk-smoke",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "qmd-sdk-smoke",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function toolCallArguments(mode) {
  if (mode === "invalid") return JSON.stringify({});
  return JSON.stringify({ query: "release rollout decision", mode: "auto", maxResults: 1 });
}

function completionChunks(mode, requestNumber) {
  const callTool = (mode === "search" || mode === "invalid") && requestNumber === 1;
  if (callTool) {
    return [
      chunk({
        delta: {
          role: "assistant",
          tool_calls: [{
            index: 0,
            id: "call_qmd_adaptive_search",
            type: "function",
            function: {
              name: mode === "invalid" ? "qmd_search_feedback" : "qmd_adaptive_search",
              arguments: toolCallArguments(mode),
            },
          }],
        },
      }),
      chunk({ delta: {}, finishReason: "tool_calls" }),
    ];
  }
  return [
    chunk({ delta: { role: "assistant", content: "Offline Pi SDK smoke complete." } }),
    chunk({ delta: {}, finishReason: "stop" }),
  ];
}

const provider = createServer(async (request, response) => {
  if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
    response.writeHead(404).end("not found");
    return;
  }
  let body = "";
  for await (const part of request) body += part;
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    response.writeHead(400).end("invalid JSON");
    return;
  }
  providerState.requests.push(payload);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const record of completionChunks(providerState.mode, providerState.requests.length)) {
    response.write(`data: ${JSON.stringify(record)}\n\n`);
  }
  response.end("data: [DONE]\n\n");
});

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
}

function parseLine(line, records) {
  if (!line.trim()) return;
  try {
    records.push(JSON.parse(line));
  } catch {
    // Keep non-protocol output in captured evidence; it cannot satisfy assertions.
  }
}

function runRpcProcess({ mode, prompt }) {
  providerState.mode = mode;
  providerState.requests = [];
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PATH: isolatedPath(),
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
    };
    const args = [
      piCli,
      "--offline",
      "--no-session",
      "--no-builtin-tools",
      "--no-skills",
      "--no-context-files",
      "--no-prompt-templates",
      "--no-mcp",
      "--mode",
      "rpc",
      "--provider",
      "qmd-sdk-smoke",
      "--model",
      "qmd-sdk-smoke",
      "-e",
      root,
    ];
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const records = [];
    let stdout = "";
    let stderr = "";
    let pendingLine = "";
    let launchError;
    let timedOut = false;
    let shutdownTimedOut = false;
    let endedInput = false;
    let commandHandled = false;
    let closed = false;
    let deadline;
    let shutdownDeadline;

    const finish = (code, signal) => {
      if (closed) return;
      closed = true;
      clearTimeout(deadline);
      clearTimeout(shutdownDeadline);
      if (pendingLine) parseLine(pendingLine, records);
      const output = `${stdout}${stderr}`;
      resolve({
        exit_code: code ?? null,
        signal: signal ?? null,
        records,
        output,
        timedOut,
        shutdownTimedOut,
        commandHandled,
        launchError: launchError?.message ?? null,
        toolNames: requestedToolNames(providerState.requests),
      });
    };

    const terminate = () => {
      if (closed) return;
      child.kill();
      setTimeout(() => {
        if (!closed && process.platform === "win32" && child.pid) {
          const taskkill = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
          spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 1000 });
        } else if (!closed && child.pid) {
          try { process.kill(child.pid, "SIGKILL"); } catch {}
        }
      }, 1000).unref();
    };

    child.on("error", (error) => { launchError = error; });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (part) => {
      stdout += part;
      pendingLine += part;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? "";
      for (const line of lines) {
        const previousLength = records.length;
        parseLine(line, records);
        if (records.length > previousLength) {
          const record = records.at(-1);
          if (record?.id === "smoke-prompt" && record.data?.disposition === "handled" && record.success === true) {
            commandHandled = true;
          }
          if ((record?.type === "agent_settled" || commandHandled) && !endedInput) {
            endedInput = true;
            child.stdin.end();
            shutdownDeadline = setTimeout(() => {
              shutdownTimedOut = true;
              terminate();
            }, 1000);
          }
        }
      }
    });
    child.stderr.on("data", (part) => { stderr += part; });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") launchError ??= error;
    });
    child.on("close", finish);

    deadline = setTimeout(() => {
      timedOut = true;
      terminate();
    }, probeTimeoutMs);
    const commands = { id: "smoke-commands", type: "get_commands" };
    const promptCommand = { id: "smoke-prompt", type: "prompt", message: prompt };
    child.stdin.write(`${JSON.stringify(commands)}\n${JSON.stringify(promptCommand)}\n`);
  });
}

function isolatedPath() {
  const values = [dirname(process.execPath)];
  if (process.platform === "win32") {
    const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
    values.push(join(windowsRoot, "System32"));
  } else {
    values.push("/usr/bin", "/bin");
  }
  return values.join(delimiter);
}

function requestedToolNames(requests) {
  const names = new Set();
  for (const request of requests) {
    for (const tool of request.tools ?? []) {
      const name = tool.function?.name ?? tool.name;
      if (typeof name === "string") names.add(name);
    }
  }
  return [...names].sort();
}

function commandNames(processResult) {
  const response = processResult.records.find((record) => record?.id === "smoke-commands");
  return response?.success === true && Array.isArray(response.data?.commands)
    ? response.data.commands
    : [];
}

function runClean(processResult) {
  return processResult.exit_code === 0 &&
    !processResult.timedOut &&
    !processResult.shutdownTimedOut &&
    !processResult.launchError &&
    !UNHANDLED_ERROR_PATTERN.test(processResult.output);
}

function evidenceSnapshot(result) {
  const records = [];
  for (const record of result.records) {
    if (record?.id === "smoke-commands") {
      records.push({
        id: record.id,
        type: record.type,
        command: record.command,
        success: record.success,
        extensionCommands: (record.data?.commands ?? [])
          .filter((command) => command?.source === "extension")
          .map((command) => command.name),
      });
    } else if (record?.id === "smoke-prompt") {
      records.push({
        id: record.id,
        type: record.type,
        command: record.command,
        success: record.success,
        disposition: record.data?.disposition ?? null,
      });
    } else if (record?.type === "tool_execution_start") {
      records.push({ type: record.type, toolCallId: record.toolCallId, toolName: record.toolName, args: record.args });
    } else if (record?.type === "tool_execution_end") {
      records.push({
        type: record.type,
        toolCallId: record.toolCallId,
        toolName: record.toolName,
        isError: record.isError,
        result: record.result,
      });
    } else if (record?.type === "agent_settled") {
      records.push({ type: record.type, aborted: record.aborted === true });
    } else if (record?.type === "extension_ui_request" && record.method === "notify") {
      records.push({ type: record.type, method: record.method, message: record.message, notifyType: record.notifyType });
    }
  }
  return {
    exit_code: result.exit_code,
    signal: result.signal,
    timedOut: result.timedOut,
    shutdownTimedOut: result.shutdownTimedOut,
    commandHandled: result.commandHandled,
    launchError: result.launchError,
    providerToolNames: result.toolNames,
    records,
  };
}

function evidence(...processResults) {
  return JSON.stringify(processResults.map(evidenceSnapshot));
}

function makeCase(name, result, assertions, processResults = [result]) {
  const combinedOutput = processResults.map((item) => item.output).join("\n");
  const passed = assertions.every((item) => item.passed) && processResults.every(runClean);
  return {
    report: { name, command: "npm run smoke:pi", exit_code: result.exit_code, passed, evidence: evidence(...processResults), assertions },
    unhandledError: UNHANDLED_ERROR_PATTERN.test(combinedOutput),
    extensionLoadError: EXTENSION_LOAD_ERROR_PATTERN.test(combinedOutput) || (name === "extension_load" && !passed),
  };
}

function runNativeShell() {
  const env = { ...process.env, PATH: isolatedPath(), PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: "1", PI_TELEMETRY: "0" };
  if (process.platform === "win32") {
    const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const command = `& ${quote(process.execPath)} ${quote(piCli)} --version; exit $LASTEXITCODE`;
    return spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], {
      cwd: projectRoot,
      env,
      encoding: "utf8",
      timeout: probeTimeoutMs,
      windowsHide: true,
    });
  }
  return spawnSync("/bin/sh", ["-c", '"$1" "$2" --version', "pi-host-shell", process.execPath, piCli], {
    cwd: projectRoot,
    env,
    encoding: "utf8",
    timeout: probeTimeoutMs,
    windowsHide: true,
  });
}

function localPiVersion() {
  const result = spawnSync(process.execPath, [piCli, "--version"], {
    cwd: projectRoot,
    env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: "1", PI_TELEMETRY: "0" },
    encoding: "utf8",
    timeout: probeTimeoutMs,
    windowsHide: true,
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

function writeModelConfiguration(providerUrl) {
  writeFileSync(join(agentDir, "models.json"), `${JSON.stringify({
    providers: {
      "qmd-sdk-smoke": {
        baseUrl: `${providerUrl}/v1`,
        api: "openai-completions",
        apiKey: "offline-test-only",
        models: [{
          id: "qmd-sdk-smoke",
          name: "Offline QMD SDK smoke",
          contextWindow: 8192,
          maxTokens: 512,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }],
      },
    },
  }, null, 2)}\n`, "utf8");
}

async function runSmoke() {
  const cases = [];
  await new Promise((resolve, reject) => {
    provider.once("error", reject);
    provider.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = provider.address();
    const providerUrl = `http://127.0.0.1:${address.port}`;
    writeModelConfiguration(providerUrl);

    let result = await runRpcProcess({ mode: "text", prompt: "Reply with a short offline SDK smoke acknowledgement; do not call a tool." });
    const registration = extensionRegistrationAssertion(commandNames(result), result.toolNames);
    const startup = shutdownAssertion(result);
    const commandResult = await runRpcProcess({ mode: "text", prompt: "/qmd-a:init" });
    let initializedConfig = null;
    try {
      initializedConfig = readJson(join(projectRoot, ".qmd-adaptive-search", "config.json"));
    } catch {}
    cases.push(makeCase("extension_load", commandResult, [
      registration,
      extensionCommandAssertion(commandResult, initializedConfig),
      startup,
      shutdownAssertion(commandResult),
    ], [result, commandResult]));

    result = await runRpcProcess({ mode: "search", prompt: "Run qmd_adaptive_search for the exact query release rollout decision." });
    cases.push(makeCase("happy_path", result, [toolResponseAssertion(result.records, { expectedPath: fixturePath }), shutdownAssertion(result)]));

    result = await runRpcProcess({ mode: "invalid", prompt: "Call qmd_search_feedback without selected paths." });
    cases.push(makeCase("error_path", result, [toolResponseAssertion(result.records, {
      expectError: true,
      toolName: "qmd_search_feedback",
      expectedErrorText: "selectedPaths or selectedPath is required",
    }), shutdownAssertion(result)]));

    const firstReloadProcess = await runRpcProcess({ mode: "search", prompt: "Run qmd_adaptive_search for release rollout decision." });
    const secondReloadProcess = await runRpcProcess({ mode: "search", prompt: "Run qmd_adaptive_search for release rollout decision after restart." });
    const reloadRegistration = extensionRegistrationAssertion(commandNames(secondReloadProcess), secondReloadProcess.toolNames);
    const reload = reloadAssertions(firstReloadProcess, secondReloadProcess, {
      commands: commandNames(secondReloadProcess),
      toolNames: secondReloadProcess.toolNames,
      expectedPath: fixturePath,
    });
    // Keep the full observations from the required second-process assertions.
    reload[0] = { ...reload[0], observed: reloadRegistration.observed, passed: reloadRegistration.passed };
    cases.push(makeCase("reload_cleanup", secondReloadProcess, reload, [firstReloadProcess, secondReloadProcess]));

    const shellResult = runNativeShell();
    const shellOutput = `${shellResult.stdout ?? ""}${shellResult.stderr ?? ""}`;
    const expectedVersion = localPiVersion();
    const shellAssertion = hostShellAssertion({
      exit_code: shellResult.status ?? 1,
      output: shellOutput,
      expectedVersion,
    });
    cases.push({
      report: {
        name: "host_shell",
        command: "npm run smoke:pi",
        exit_code: shellResult.status ?? 1,
        passed: !shellResult.error && shellAssertion.passed,
        evidence: shellOutput.slice(-6000) || String(shellResult.error?.message ?? "No output captured"),
        assertions: [shellAssertion],
      },
      unhandledError: UNHANDLED_ERROR_PATTERN.test(shellOutput),
      extensionLoadError: EXTENSION_LOAD_ERROR_PATTERN.test(shellOutput),
    });
  } finally {
    await closeServer(provider);
  }

  const report = {
    schema_version: 1,
    verification_contract: VERIFICATION_CONTRACT,
    sdk_versions: sdkVersions,
    platform: process.platform,
    model_inference: "none; an isolated deterministic local OpenAI-compatible stream supplies tool calls to the actual Pi host, which loads and executes the real package extension",
    unhandled_errors: cases.filter((item) => item.unhandledError).length,
    extension_load_errors: cases.filter((item) => item.extensionLoadError).length,
    cases: cases.map((item) => item.report),
  };
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    verification_contract: report.verification_contract,
    platform: report.platform,
    unhandled_errors: report.unhandled_errors,
    extension_load_errors: report.extension_load_errors,
    cases: report.cases.map(({ name, exit_code, passed }) => ({ name, exit_code, passed })),
  }));
  if (report.cases.some((item) => !item.passed) || report.unhandled_errors !== 0 || report.extension_load_errors !== 0) {
    process.exitCode = 1;
  }
}

function main() {
  runSmoke()
    .catch((error) => {
      console.error(error?.stack ?? error);
      process.exitCode = 1;
    })
    .finally(() => rmSync(temporaryRoot, { recursive: true, force: true }));
}

function ensureRuntimeSupportsSdk() {
  const minimumNode = 22;
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < minimumNode || (major === minimumNode && minor < 19)) {
    throw new Error(`Pi SDK smoke requires Node.js >=22.19.0; found ${process.versions.node}`);
  }
}

main();
