import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().default("2026-07"),
  SHOPIFY_SCOPES: z.string().default("read_content,write_content,read_online_store_pages,write_online_store_pages"),
  DATABASE_URL: z.string().min(1),
  DATABASE_CA_CERT_PATH: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  ALLOWED_IMAGE_HOSTS: z.string().default("")
});

export const env = envSchema.parse(process.env);
export const allowedImageHosts = new Set(env.ALLOWED_IMAGE_HOSTS.split(",").map(v => v.trim()).filter(Boolean));
