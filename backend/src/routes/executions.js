import { z } from "zod";

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const createExecutionSchema = z.object({
  sessionId: z.string().optional(),
  language: z.enum(["javascript", "python", "rust"]),
  code: z.string().optional(),
  files: z.array(fileSchema).optional(),
});

export async function executionRoutes(fastify) {
  const manager = fastify.executionManager;

  fastify.post("/v1/executions", async (request, reply) => {
    const parsed = createExecutionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    const payload = parsed.data;
    const files = payload.files || [];
    const totalSize = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0) + Buffer.byteLength(payload.code || "", "utf8");

    if ((payload.files?.length || 0) > fastify.appConfig.maxFiles) {
      return reply.code(400).send({
        error: `Too many files. Max allowed: ${fastify.appConfig.maxFiles}`,
      });
    }

    if (totalSize > fastify.appConfig.maxCodeSizeBytes) {
      return reply.code(400).send({
        error: `Code payload too large. Max allowed bytes: ${fastify.appConfig.maxCodeSizeBytes}`,
      });
    }

    const execution = await manager.createExecution(payload);

    return reply.code(202).send({
      executionId: execution.id,
      status: execution.status,
      language: execution.language,
      createdAt: execution.createdAt,
    });
  });

  fastify.get("/v1/executions/:executionId", async (request, reply) => {
    const { executionId } = request.params;
    const execution = manager.getExecution(executionId);

    if (!execution) {
      return reply.code(404).send({ error: "Execution not found" });
    }

    return {
      id: execution.id,
      sessionId: execution.sessionId,
      status: execution.status,
      language: execution.language,
      createdAt: execution.createdAt,
      startedAt: execution.startedAt,
      endedAt: execution.endedAt,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      blockedByScan: execution.blockedByScan,
      failureReason: execution.failureReason,
      scanSummary: execution.scanSummary,
      scanFindings: execution.scanFindings,
      filesCount: execution.filesCount,
    };
  });

  fastify.post("/v1/executions/:executionId/stop", async (request, reply) => {
    const { executionId } = request.params;

    try {
      const result = await manager.stopExecution(executionId);
      return { executionId, ...result };
    } catch (error) {
      if (error.message === "Execution not found") {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message });
    }
  });

  fastify.get("/v1/executions/:executionId/stream", { websocket: true }, (connection, request) => {
    const socket = connection?.socket || connection;
    const { executionId } = request.params;
    const execution = manager.getExecution(executionId);

    if (!execution) {
      socket.send(JSON.stringify({ type: "error", message: "Execution not found" }));
      socket.close();
      return;
    }

    for (const event of execution.events) {
      socket.send(JSON.stringify(event));
    }

    const unsubscribe = manager.subscribe(executionId, (event) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(event));
      }
    });

    socket.on("close", () => {
      unsubscribe();
    });
  });
}
