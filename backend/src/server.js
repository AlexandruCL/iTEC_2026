import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { ExecutionManager } from "./services/executionManager.js";
import { healthRoutes } from "./routes/health.js";
import { executionRoutes } from "./routes/executions.js";

const app = Fastify({ logger: true });
const executionManager = new ExecutionManager(config);

app.decorate("executionManager", executionManager);
app.decorate("appConfig", config);

await app.register(cors, {
  origin: config.allowedOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

await app.register(websocket);
await app.register(healthRoutes);
await app.register(executionRoutes);

async function start() {
  await executionManager.init();
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Backend listening on ${config.host}:${config.port}`);
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
