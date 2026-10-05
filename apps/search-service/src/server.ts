import { createPool } from "@medlink/db";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
const app = await buildApp(db, config);

// Pool errors on idle clients must not crash the process.
db.on("error", (err) => app.log.error({ err }, "idle database client error"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await db.end();
    process.exit(0);
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
