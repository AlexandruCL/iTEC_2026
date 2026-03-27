import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { getLanguageProfile } from "./languageProfiles.js";
import { scanSourceBeforeRun } from "./securityScanner.js";
import {
  prepareSandbox,
  buildImageIfNeeded,
  runSandboxedContainer,
  stopContainer,
  removeSandboxContext,
  checkDockerAvailability,
} from "./dockerSandbox.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeFiles({ language, code, files, profile }) {
  if (Array.isArray(files) && files.length > 0) {
    return files;
  }

  const mainFile = {
    path: `main.${profile.extension}`,
    content: code || "",
  };

  return [mainFile];
}

export class ExecutionManager {
  constructor(config) {
    this.config = config;
    this.executions = new Map();
    this.emitter = new EventEmitter();
    this.dockerAvailable = false;
    this.dockerError = null;
  }

  async init() {
    await fs.mkdir(this.config.executionWorkdir, { recursive: true });
    const docker = await checkDockerAvailability();
    this.dockerAvailable = docker.available;
    this.dockerError = docker.error;
  }

  getSystemStatus() {
    return {
      dockerAvailable: this.dockerAvailable,
      dockerError: this.dockerError,
      supportedLanguages: this.listSupportedLanguages(),
    };
  }

  listSupportedLanguages() {
    return ["javascript", "python", "rust"];
  }

  getExecution(executionId) {
    return this.executions.get(executionId) || null;
  }

  subscribe(executionId, callback) {
    const eventName = `execution:${executionId}`;
    this.emitter.on(eventName, callback);

    return () => {
      this.emitter.off(eventName, callback);
    };
  }

  emitEvent(executionId, event) {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const seq = execution.nextSeq;
    execution.nextSeq += 1;

    const payload = {
      seq,
      executionId,
      ts: nowIso(),
      ...event,
    };

    execution.events.push(payload);
    if (execution.events.length > this.config.logBacklogEvents) {
      execution.events.shift();
    }

    const eventName = `execution:${executionId}`;
    this.emitter.emit(eventName, payload);
  }

  async createExecution(request) {
    const executionId = uuidv4();
    const profile = getLanguageProfile(request.language);
    if (!profile) {
      throw new Error(`Unsupported language: ${request.language}`);
    }

    const normalizedFiles = normalizeFiles({
      language: request.language,
      code: request.code,
      files: request.files,
      profile,
    });

    const execution = {
      id: executionId,
      sessionId: request.sessionId || null,
      language: request.language,
      status: "queued",
      createdAt: nowIso(),
      startedAt: null,
      endedAt: null,
      exitCode: null,
      timedOut: false,
      blockedByScan: false,
      scanSummary: { high: 0, medium: 0, low: 0, total: 0 },
      scanFindings: [],
      filesCount: normalizedFiles.length,
      failureReason: null,
      nextSeq: 1,
      events: [],
      containerName: null,
    };

    this.executions.set(executionId, execution);

    this.emitEvent(executionId, {
      type: "system",
      stage: "queued",
      message: "Execution queued",
    });

    this.runExecution(executionId, normalizedFiles, profile).catch((error) => {
      const current = this.executions.get(executionId);
      if (!current) return;
      current.status = "failed";
      current.endedAt = nowIso();
      current.failureReason = error.message;
      this.emitEvent(executionId, {
        type: "system",
        stage: "failed",
        message: error.message,
      });
    });

    return execution;
  }

  async runExecution(executionId, files, profile) {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    if (!this.dockerAvailable) {
      execution.status = "failed";
      execution.endedAt = nowIso();
      execution.failureReason = this.dockerError || "Docker is unavailable";
      this.emitEvent(executionId, {
        type: "system",
        stage: "failed",
        message: execution.failureReason,
      });
      return;
    }

    execution.status = "scanning";
    this.emitEvent(executionId, {
      type: "system",
      stage: "scanning",
      message: "Running live security scan",
    });

    const scanResult = await scanSourceBeforeRun({ files });
    execution.scanSummary = scanResult.summary;
    execution.scanFindings = scanResult.findings;

    this.emitEvent(executionId, {
      type: "scan-report",
      stage: "scan-complete",
      summary: scanResult.summary,
      findings: scanResult.findings,
    });

    if (scanResult.blocked) {
      execution.status = "blocked";
      execution.blockedByScan = true;
      execution.endedAt = nowIso();
      this.emitEvent(executionId, {
        type: "system",
        stage: "blocked",
        message: "Execution blocked due to high-severity findings.",
      });
      return;
    }

    execution.status = "building";
    this.emitEvent(executionId, {
      type: "system",
      stage: "building",
      message: "Preparing sandbox and building runtime image",
    });

    let contextDir = null;
    try {
      const prepared = await prepareSandbox({
        workdir: this.config.executionWorkdir,
        executionId,
        language: execution.language,
        profile,
        files,
      });
      contextDir = prepared.contextDir;

      await buildImageIfNeeded({
        contextDir,
        imageTag: prepared.imageTag,
        onSystemEvent: (message) => {
          this.emitEvent(executionId, {
            type: "system",
            stage: "building",
            message,
          });
        },
      });

      execution.status = "running";
      execution.startedAt = nowIso();

      this.emitEvent(executionId, {
        type: "run-started",
        stage: "running",
        message: "Container started",
      });

      const runtime = runSandboxedContainer({
        imageTag: prepared.imageTag,
        executionId,
        memoryMb: this.config.executionMemoryMb,
        cpus: this.config.executionCpus,
        timeoutMs: this.config.executionTimeoutMs,
        onStdout: (chunk) => {
          this.emitEvent(executionId, {
            type: "stdout",
            stage: "running",
            chunk,
          });
        },
        onStderr: (chunk) => {
          this.emitEvent(executionId, {
            type: "stderr",
            stage: "running",
            chunk,
          });
        },
        onSystemEvent: (message) => {
          this.emitEvent(executionId, {
            type: "system",
            stage: "running",
            message,
          });
        },
      });

      execution.containerName = runtime.containerName;

      const { code, timedOut } = await runtime.result;
      execution.exitCode = code;
      execution.timedOut = timedOut;
      execution.status = code === 0 && !timedOut ? "completed" : "failed";
      execution.endedAt = nowIso();

      this.emitEvent(executionId, {
        type: "run-ended",
        stage: execution.status,
        exitCode: code,
        timedOut,
        message: timedOut
          ? "Execution timed out and was stopped"
          : "Execution finished",
      });
    } catch (error) {
      execution.status = "failed";
      execution.endedAt = nowIso();
      execution.failureReason = error.message;
      this.emitEvent(executionId, {
        type: "system",
        stage: "failed",
        message: error.message,
      });
    } finally {
      if (contextDir) {
        await removeSandboxContext(contextDir);
      }
    }
  }

  async stopExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error("Execution not found");
    }

    if (!execution.containerName) {
      return { stopped: false, reason: "No active container" };
    }

    await stopContainer(execution.containerName);
    execution.status = "stopped";
    execution.endedAt = nowIso();
    execution.failureReason = "Stopped by user";
    this.emitEvent(executionId, {
      type: "system",
      stage: "stopped",
      message: "Stop requested by user",
    });

    return { stopped: true };
  }
}
