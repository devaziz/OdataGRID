import type { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { URL } from 'node:url';

// Hostname allowlist comes from a Vercel env variable (CSV). The dev middleware
// trusts the user-supplied host; in prod we must not, since this endpoint is
// reachable from the public internet (even if gated by Vercel Password
// Protection, an attacker who guesses the password should not get an SSRF
// primitive against Vercel's internal network).
const allowedHosts = (process.env.SAP_ALLOWED_HOSTS || '')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

// Best-effort in-memory rate limit. Cold starts reset the counter, but with
// a single function instance per region this still throttles a runaway client.
const RATE_LIMIT_PER_MIN = 60;
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const r = rateMap.get(ip);
  if (!r || now > r.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (r.count >= RATE_LIMIT_PER_MIN) return false;
  r.count++;
  return true;
}

// DNS rebinding defence: a hostname in the allowlist may still resolve to a
// private IP if an attacker controls its DNS. Resolve once and reject if the
// answer falls inside RFC1918, loopback, link-local or unique local space.
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0) return true;
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    // fc00::/7 (unique local)
    if (/^f[cd]/.test(lower)) return true;
    // fe80::/10 (link-local)
    if (/^fe[89ab]/.test(lower)) return true;
    return false;
  }
  return false;
}

const reject = (res: ServerResponse, status: number, msg: string) => {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(msg);
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (allowedHosts.length === 0) {
    return reject(res, 503, 'Proxy is not configured: SAP_ALLOWED_HOSTS env is empty.');
  }

  // Resolve client IP for rate limiting (Vercel sets x-forwarded-for).
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  const clientIp = xff.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimitOk(clientIp)) return reject(res, 429, 'Rate limit exceeded.');

  // Origin check: only accept requests whose Origin matches the deployment Host.
  // Browsers send Origin on cross-origin and on POSTs from forms; same-origin
  // GETs may omit it, in which case we don't fail — we just rely on the
  // password-protection layer + allowlist for those.
  const origin = req.headers.origin as string | undefined;
  const host = req.headers.host as string | undefined;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return reject(res, 403, 'Cross-origin request rejected.');
      }
    } catch {
      return reject(res, 400, 'Invalid Origin header.');
    }
  }

  // x-sap-target tells the proxy which SAP host to talk to. Validate strictly.
  const rawTarget = req.headers['x-sap-target'];
  const target = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;
  if (!target) return reject(res, 400, 'Missing x-sap-target header.');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return reject(res, 400, 'Invalid x-sap-target URL.');
  }

  if (parsed.protocol !== 'https:') {
    return reject(res, 403, 'Only https targets are allowed.');
  }

  const targetHost = parsed.hostname.toLowerCase();
  if (!allowedHosts.includes(targetHost)) {
    return reject(res, 403, 'Target host is not in the allowlist.');
  }

  try {
    const { address } = await lookup(targetHost);
    if (isPrivateIp(address)) {
      return reject(res, 403, 'Target resolves to a private network.');
    }
  } catch {
    return reject(res, 502, 'Could not resolve target host.');
  }

  // Path on the upstream is whatever follows /api/sap-proxy in our URL.
  const url = req.url || '/';
  const upstreamPath = url.replace(/^\/api\/sap-proxy/, '') || '/';

  // Forward most headers, but strip the ones that leak internal routing or
  // would confuse the upstream (e.g. Host pointing at *.vercel.app).
  const fwdHeaders: Record<string, any> = { ...req.headers };
  for (const k of [
    'x-sap-target',
    'host',
    'origin',
    'referer',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'x-vercel-id',
    'x-vercel-deployment-url',
    'x-vercel-forwarded-for',
    'x-vercel-ip-country',
    'x-vercel-ip-country-region',
    'x-vercel-ip-city',
  ]) {
    delete fwdHeaders[k];
  }
  fwdHeaders['host'] = parsed.host;

  const upstreamReq = https.request(
    {
      protocol: 'https:',
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: upstreamPath,
      method: req.method,
      headers: fwdHeaders,
      // rejectUnauthorized defaults to true — we deliberately do NOT relax
      // TLS in production. For self-signed SAP certs, set NODE_EXTRA_CA_CERTS
      // in the Vercel project's environment variables.
    },
    (upstreamRes) => {
      const setCookie = upstreamRes.headers['set-cookie'];
      if (setCookie) {
        // Rewrite cookies so the browser stores them for the Vercel domain
        // and sends them only over HTTPS, with sane defaults.
        upstreamRes.headers['set-cookie'] = setCookie.map((c) => {
          let out = c.replace(/;\s*Domain=[^;]+/gi, '');
          if (!/;\s*HttpOnly/i.test(out)) out += '; HttpOnly';
          if (!/;\s*Secure/i.test(out)) out += '; Secure';
          if (!/;\s*SameSite=/i.test(out)) out += '; SameSite=Lax';
          return out;
        });
      }
      // Never let SAP responses be cached by the browser or any intermediate
      // CDN: a stale 200/304 would mask a fresh 401 + WWW-Authenticate, which
      // the browser needs to surface its native basic-auth dialog.
      upstreamRes.headers['cache-control'] = 'no-store, no-cache, must-revalidate, private';
      delete upstreamRes.headers['etag'];
      delete upstreamRes.headers['last-modified'];
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', (err) => {
    // Sanitized log: status, target host, path, error message — never the
    // Authorization header, never the response body.
    console.error(
      `[sap-proxy] ${req.method} ${targetHost}${upstreamPath} -> error: ${err.message}`
    );
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Upstream error.');
    }
  });

  req.pipe(upstreamReq);
}
