import { describe, it, expect } from "vitest";
import { signR2Request } from "./sigv4.js";

describe("signR2Request", () => {
  const base = {
    accountId: "acct123",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secretkey",
    bucket: "alma-media",
  };

  it("builds a path-style R2 URL with the bucket and encoded key", async () => {
    const { url } = await signR2Request({ method: "GET", ...base, key: "sounds/nature/calming rain_v2.m4a" });
    expect(url).toBe(
      "https://acct123.r2.cloudflarestorage.com/alma-media/sounds/nature/calming%20rain_v2.m4a"
    );
  });

  it("produces an Authorization header with a hex signature and the right scope", async () => {
    const { headers } = await signR2Request({ method: "PUT", ...base, key: "catalog.json", body: "{}", contentType: "application/json" });
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
    );
    expect(headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes an empty body deterministically for GET requests", async () => {
    const { headers } = await signR2Request({ method: "GET", ...base, key: "catalog.json" });
    // SHA-256 of the empty string
    expect(headers["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("signatures differ when the secret key differs", async () => {
    const a = await signR2Request({ method: "GET", ...base, key: "catalog.json" });
    const b = await signR2Request({ method: "GET", ...base, secretAccessKey: "other", key: "catalog.json" });
    expect(a.headers.Authorization).not.toBe(b.headers.Authorization);
  });
});
