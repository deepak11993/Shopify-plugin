import { defineConfig } from "vitest/config";

// Dummy values only — tests must never depend on (or contain) real credentials.
export default defineConfig({
  test: {
    env: {
      APP_URL: "https://hrl-test.example.com",
      SHOPIFY_API_KEY: "test_api_key",
      SHOPIFY_API_SECRET: "test_api_secret",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      TOKEN_ENCRYPTION_KEY: "0".repeat(64)
    }
  }
});
