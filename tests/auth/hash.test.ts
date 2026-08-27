import { describe, it, expect } from "vitest";
import { hashToken, constantTimeEqual, toHex } from "../../src/crypto/hash";

describe("hashToken", () => {
  it("is deterministic for the same key + token", async () => {
    const a = await hashToken("key-material", "tok_abc123");
    const b = await hashToken("key-material", "tok_abc123");
    expect(toHex(a)).toBe(toHex(b));
    expect(a.byteLength).toBe(32); // SHA-256
  });

  it("differs when the token differs", async () => {
    const a = await hashToken("key-material", "tok_abc123");
    const b = await hashToken("key-material", "tok_abc124");
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it("differs when the HMAC key differs (same token)", async () => {
    const a = await hashToken("key-1", "tok_abc123");
    const b = await hashToken("key-2", "tok_abc123");
    expect(toHex(a)).not.toBe(toHex(b));
  });
});

describe("constantTimeEqual", () => {
  it("matches identical hashes and rejects a one-byte difference", async () => {
    const good = await hashToken("k", "right-token");
    const goodAgain = await hashToken("k", "right-token");
    const wrong = await hashToken("k", "wrong-token");
    expect(constantTimeEqual(good, goodAgain)).toBe(true);
    expect(constantTimeEqual(good, wrong)).toBe(false);
  });

  it("rejects arrays of differing length", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
