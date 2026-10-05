import { createPool } from "./pool.js";
import { migrate, resetSchema } from "./migrate.js";
import { seed } from "./seed.js";

const command = process.argv[2];
const db = createPool();

try {
  if (command === "migrate") {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "No pending migrations");
  } else if (command === "seed") {
    console.log("Seeded:", await seed(db));
  } else if (command === "reset") {
    await resetSchema(db);
    console.log("Applied:", (await migrate(db)).join(", "));
    console.log("Seeded:", await seed(db));
  } else {
    console.error("Usage: cli.ts <migrate|seed|reset>");
    process.exitCode = 1;
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await db.end();
}
