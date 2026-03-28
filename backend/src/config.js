import path from "node:path";

function readInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFloat(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: readInt("PORT", 8787),
  host: process.env.HOST || "0.0.0.0",
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  executionWorkdir: path.resolve(process.cwd(), process.env.EXECUTION_WORKDIR || ".tmp-runs"),
  executionTimeoutMs: readInt("EXECUTION_TIMEOUT_MS", 10_000),
  executionMemoryMb: readInt("EXECUTION_MEMORY_MB", 256),
  executionCpus: readFloat("EXECUTION_CPUS", 0.5),
  maxCodeSizeBytes: readInt("MAX_CODE_SIZE_BYTES", 200_000),
  maxFiles: readInt("MAX_FILES", 20),
  maxOutputBytes: readInt("MAX_OUTPUT_BYTES", 200_000),
  logBacklogEvents: readInt("LOG_BACKLOG_EVENTS", 300),
};
