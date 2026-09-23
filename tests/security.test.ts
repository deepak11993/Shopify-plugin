import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../src/config.js";
import { verifySessionToken } from "../src/security.js";

function signSessionToken(payload: Record<string, unknown>, secret = env.SHOPIFY_API_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

const shop = "teststore.myshopify.com";
const validPayload = { iss: `https://${shop}/admin`, dest: `https://${shop}`, aud: env.SHOPIFY_API_KEY, sub: "1", exp: Math.floor(Date.now() / 1000) + 60 };

describe("verifySessionToken", () => {
  it("accepts a validly signed, unexpired token", () => {
    const result = verifySessionToken(signSessionToken(validPayload));
    expect(result?.shop).toBe(shop);
  });

  it("rejects a token signed with the wrong secret", () => {
    expect(verifySessionToken(signSessionToken(validPayload, "wrong-secret"))).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = { ...validPayload, exp: Math.floor(Date.now() / 1000) - 60 };
    expect(verifySessionToken(signSessionToken(expired))).toBeNull();
  });

  it("rejects a token issued for a different app", () => {
    const wrongAud = { ...validPayload, aud: "some-other-app-key" };
    expect(verifySessionToken(signSessionToken(wrongAud))).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-a-jwt")).toBeNull();
  });
});
