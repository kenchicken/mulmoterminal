// Which browser origins may open this server's sockets and reach its privileged routes.
//
// Only same-machine browser origins, so a malicious website the user happens to visit can't
// drive the local Claude PTY (a cross-site WebSocket hijack). A MISSING Origin is allowed —
// that is a non-browser local client, which cannot be a cross-site request. Any localhost
// host on any port is allowed, which is what covers the Vite dev proxy.
//
// MULMOTERMINAL_ALLOWED_ORIGINS (comma-separated full origins, e.g.
// "http://my-host:34567,https://my-host.tailnet.ts.net") extends the allowlist for
// operators who reach the server over a LAN or VPN hostname. This does not weaken the
// cross-site protection: the Origin header is attached by the browser and a visited page
// cannot forge it, so a malicious site still presents its own origin and is rejected.
// Entries are normalised through `new URL().origin` (case, default ports, trailing "/"),
// and malformed entries are ignored rather than taking the server down.
//
// Out of index.ts because every route module and the pub/sub socket take this as a
// dependency and every one of their tests passes a stub, so the real predicate — the single
// thing standing between a visited page and the user's terminal — was the one piece nothing
// exercised (#548).
//
// `hostname` is what `new URL()` normalises to, so an IPv6 literal arrives bracketed
// (`[::1]`) however it was written, and a host is already lower-cased and punycoded.
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function parseAllowedOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const entry of raw?.split(",") ?? []) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // A typo in the env var should not disable the server (or the allowlist).
    }
  }
  return origins;
}

// The env var is parsed once per value, not once per request — but re-read on change so
// tests (and a hypothetical embedder) don't fight a module-load-time snapshot.
let cached: { raw: string | undefined; origins: Set<string> } | undefined;
function extraAllowedOrigins(): Set<string> {
  const raw = process.env.MULMOTERMINAL_ALLOWED_ORIGINS;
  if (!cached || cached.raw !== raw) cached = { raw, origins: parseAllowedOrigins(raw) };
  return cached.origins;
}

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return LOOPBACK_HOSTNAMES.has(url.hostname) || extraAllowedOrigins().has(url.origin);
  } catch {
    return false;
  }
}
