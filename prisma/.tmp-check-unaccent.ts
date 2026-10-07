import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS unaccent;");
    const res = await client.query("SELECT unaccent('João Fonseca') AS result;");
    console.log("unaccent works:", res.rows[0]);
  } finally {
    client.release();
  }
}

main()
  .catch((e) => console.error("FAILED:", e.message))
  .finally(() => pool.end());
