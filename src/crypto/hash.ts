// HMAC-SHA256 token hashing + constant-time compare.
//
// Connector tokens are stored in D1 only as HMAC fingerprints; the auth path on
// /mcp/u/{user_id}?token=<t> recomputes the HMAC and constant-time-compares it
// against users.mcp_url_token_hash. Web Crypto exposes HMAC but no timing-safe
// compare, so we roll our own — the standard xor-and-fold over the byte arrays.
// (Pattern lifted from voygent-lite src/crypto/hash.ts.)

export async function hashToken(
  hmacKeyMaterial: string,
  token: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacKeyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(token),
  );
  return new Uint8Array(sig);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Hex-encode raw bytes (used when minting a token's stored fingerprint). */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
