import { hostEnvironment, loadConfig } from "./config.ts";
import { defaultHarnesses, stopWithBackstop } from "./wiring.ts";
import { startQm } from "./runtime.ts";

const env = hostEnvironment();
const config = loadConfig(env);
const runtime = await startQm(config, { env, defaultHarnesses });

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[qm] ${signal} received, shutting down`);
  stopWithBackstop(runtime, config.shutdownDrainMs, "qm", () => runtime.server.closeAllConnections());
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
