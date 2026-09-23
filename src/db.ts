import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./config.js";

// node-postgres 8.x now maps a bare `sslmode=require` query param to full
// certificate-chain verification instead of its historical "encrypt only"
// meaning, which breaks providers (Aiven, etc.) that sit behind a private CA.
// Parse it ourselves and build the ssl option explicitly so behavior is
// predictable regardless of pg's own connection-string parsing.
function buildConnection() {
  const url = new URL(env.DATABASE_URL);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const connectionString = url.toString();

  if (sslmode === "disable") return { connectionString, ssl: undefined };
  if (env.DATABASE_CA_CERT_PATH) {
    return { connectionString, ssl: { ca: fs.readFileSync(env.DATABASE_CA_CERT_PATH, "utf8"), rejectUnauthorized: true } };
  }
  if (sslmode === "verify-ca" || sslmode === "verify-full") return { connectionString, ssl: { rejectUnauthorized: true } };
  return { connectionString, ssl: { rejectUnauthorized: false } };
}

const { connectionString, ssl } = buildConnection();
const adapter = new PrismaPg({ connectionString, ssl });

export const db = new PrismaClient({ adapter });
