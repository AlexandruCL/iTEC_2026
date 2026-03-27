export async function healthRoutes(fastify) {
  fastify.get("/health", async () => {
    const system = fastify.executionManager.getSystemStatus();
    return {
      ok: true,
      service: "collabcode-backend",
      system,
      ts: new Date().toISOString(),
    };
  });
}
