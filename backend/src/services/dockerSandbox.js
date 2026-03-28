import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

function isSafeRelativePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("://")) {
    return false;
  }
  const parts = normalized.split("/");
  return !parts.some((part) => part === ".." || part === "");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}: ${stderr || stdout}`));
    });
  });
}

function hashFiles(files, language) {
  const hash = crypto.createHash("sha256");
  hash.update(language);
  for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update(file.content);
  }
  return hash.digest("hex").slice(0, 20);
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeExecutionContext({ contextDir, dockerfile, files }) {
  await ensureDirectory(contextDir);
  await fs.writeFile(path.join(contextDir, "Dockerfile"), dockerfile, "utf8");

  for (const file of files) {
    if (!isSafeRelativePath(file.path)) {
      throw new Error(`Invalid file path: ${file.path}`);
    }
    const targetPath = path.join(contextDir, file.path);
    await ensureDirectory(path.dirname(targetPath));
    await fs.writeFile(targetPath, file.content, "utf8");
  }
}

async function imageExists(tag) {
  try {
    await runCommand("docker", ["image", "inspect", tag]);
    return true;
  } catch {
    return false;
  }
}

export async function buildImageIfNeeded({ contextDir, imageTag, onSystemEvent }) {
  if (await imageExists(imageTag)) {
    onSystemEvent?.(`Using cached image ${imageTag}`);
    return;
  }

  onSystemEvent?.(`Building image ${imageTag}`);
  await runCommand("docker", ["build", "-t", imageTag, contextDir]);
}

export async function prepareSandbox({ workdir, executionId, language, profile, files }) {
  const digest = hashFiles(files, language);
  const imageTag = `collabcode-runner:${language}-${digest}`;
  const contextDir = path.join(workdir, executionId);

  await writeExecutionContext({
    contextDir,
    dockerfile: profile.dockerfile,
    files,
  });

  return { contextDir, imageTag };
}

export function runSandboxedContainer({
  imageTag,
  executionId,
  memoryMb,
  cpus,
  timeoutMs,
  onStdout,
  onStderr,
  onSystemEvent,
}) {
  const containerName = `collabcode-${executionId}`;

  const args = [
    "run",
    "-i",
    "--name",
    containerName,
    "--rm",
    "--network",
    "none",
    "--cpus",
    String(cpus),
    "--memory",
    `${memoryMb}m`,
    "--pids-limit",
    "128",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    imageTag,
  ];

  const child = spawn("docker", args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let timedOut = false;

  const timeoutHandle = setTimeout(async () => {
    timedOut = true;
    onSystemEvent?.("Execution timeout reached. Stopping container.");
    try {
      await stopContainer(containerName);
    } catch {
      // Ignore stop failures after timeout.
    }
  }, timeoutMs);

  child.stdout.on("data", (chunk) => {
    onStdout?.(chunk.toString());
  });

  child.stderr.on("data", (chunk) => {
    onStderr?.(chunk.toString());
  });

  const result = new Promise((resolve, reject) => {
    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      resolve({ code: code ?? 1, timedOut, containerName });
    });
  });

  const writeStdin = (input) => {
    if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {
      throw new Error("Process stdin is not writable");
    }
    child.stdin.write(input);
  };

  return {
    containerName,
    result,
    writeStdin,
  };
}

export async function stopContainer(containerName) {
  try {
    await runCommand("docker", ["rm", "-f", containerName]);
  } catch {
    // Container may already be gone.
  }
}

export async function removeSandboxContext(contextDir) {
  try {
    await fs.rm(contextDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup.
  }
}

export async function checkDockerAvailability() {
  try {
    await runCommand("docker", ["version", "--format", "{{.Server.Version}}"]);
    return { available: true, error: null };
  } catch (error) {
    return {
      available: false,
      error:
        "Docker is not available. Ensure Docker Desktop/Engine is running and docker CLI is in PATH.",
    };
  }
}
