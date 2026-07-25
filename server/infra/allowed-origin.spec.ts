// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { isAllowedOrigin, parseAllowedOrigins } from "./allowed-origin.js";

const ENV = "MULMOTERMINAL_ALLOWED_ORIGINS";

afterEach(() => {
  delete process.env[ENV];
});

describe("isAllowedOrigin", () => {
  it("allows loopback origins on any port", () => {
    expect(isAllowedOrigin("http://localhost:34567")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:6856")).toBe(true);
    expect(isAllowedOrigin("http://[::1]:34567")).toBe(true);
  });

  it("allows a missing origin (non-browser local client)", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it("rejects non-loopback origins by default", () => {
    expect(isAllowedOrigin("http://my-host:34567")).toBe(false);
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  it("rejects garbage that is not an origin", () => {
    expect(isAllowedOrigin("not a url")).toBe(false);
  });

  it("allows origins listed in MULMOTERMINAL_ALLOWED_ORIGINS", () => {
    process.env[ENV] = "http://my-host:34567,https://my-host.tailnet.ts.net";
    expect(isAllowedOrigin("http://my-host:34567")).toBe(true);
    expect(isAllowedOrigin("https://my-host.tailnet.ts.net")).toBe(true);
  });

  it("matches the exact origin, not just the hostname", () => {
    process.env[ENV] = "http://my-host:34567";
    expect(isAllowedOrigin("http://my-host:9999")).toBe(false);
    expect(isAllowedOrigin("https://my-host:34567")).toBe(false);
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  it("re-reads the env var when its value changes", () => {
    process.env[ENV] = "http://first:34567";
    expect(isAllowedOrigin("http://first:34567")).toBe(true);
    process.env[ENV] = "http://second:34567";
    expect(isAllowedOrigin("http://first:34567")).toBe(false);
    expect(isAllowedOrigin("http://second:34567")).toBe(true);
  });
});

describe("parseAllowedOrigins", () => {
  it("returns an empty set for an unset or blank value", () => {
    expect(parseAllowedOrigins(undefined).size).toBe(0);
    expect(parseAllowedOrigins("").size).toBe(0);
    expect(parseAllowedOrigins(" , ,").size).toBe(0);
  });

  it("normalises entries to their URL origin", () => {
    const origins = parseAllowedOrigins(" HTTP://My-Host:34567/ , https://a.example:443 ");
    expect(origins.has("http://my-host:34567")).toBe(true);
    // 443 is the https default port, so the normalised origin omits it.
    expect(origins.has("https://a.example")).toBe(true);
  });

  it("ignores malformed entries instead of throwing", () => {
    const origins = parseAllowedOrigins("not a url,http://ok-host:34567");
    expect(origins.size).toBe(1);
    expect(origins.has("http://ok-host:34567")).toBe(true);
  });
});
