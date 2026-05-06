import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

// Dynamic SAP proxy: target host comes from the `x-sap-target` request header,
// which the frontend sets from the user-entered Server URL (saved in localStorage).
// This lets the user point the app at any SAP host at runtime without restarting Vite.
const dynamicSapProxy = {
  name: 'dynamic-sap-proxy',
  configureServer(server: any) {
    server.middlewares.use('/sap-api', (req: any, res: any) => {
      const rawTarget = req.headers['x-sap-target']
      const target = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget
      if (!target) {
        res.statusCode = 400
        res.end('Missing x-sap-target header. Set the SAP server in the Login dialog first.')
        return
      }

      let parsed: URL
      try {
        parsed = new URL(target)
      } catch {
        res.statusCode = 400
        res.end(`Invalid x-sap-target: ${target}`)
        return
      }

      const isHttps = parsed.protocol === 'https:'
      const lib = isHttps ? https : http

      // Connect strips the `/sap-api` mount prefix, so req.url already starts with `/sap/...`
      const targetPath = req.url || '/'

      const fwdHeaders: Record<string, any> = { ...req.headers }
      delete fwdHeaders['x-sap-target']
      delete fwdHeaders['host']
      delete fwdHeaders['origin']
      delete fwdHeaders['referer']
      fwdHeaders['host'] = parsed.host

      const proxyReq = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: targetPath,
          method: req.method,
          headers: fwdHeaders,
          rejectUnauthorized: false,
        },
        (proxyRes) => {
          const setCookie = proxyRes.headers['set-cookie']
          if (setCookie) {
            // Rewrite cookies so the browser stores them for localhost:
            //   - strip Domain=...   (so the cookie is scoped to current origin)
            //   - strip Secure       (Vite dev runs over http://localhost)
            //   - downgrade SameSite=None to Lax (None requires Secure)
            proxyRes.headers['set-cookie'] = setCookie.map((c) =>
              c
                .replace(/;\s*Domain=[^;]+/gi, '')
                .replace(/;\s*Secure/gi, '')
                .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
            )
          }
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
          proxyRes.pipe(res)
        }
      )

      proxyReq.on('error', (err) => {
        console.error('[sap-proxy] error:', (err as Error).message)
        if (!res.headersSent) {
          res.statusCode = 502
          res.end(`Proxy error: ${(err as Error).message}`)
        }
      })

      req.pipe(proxyReq)
    })
  },
}

export default defineConfig({
  plugins: [react(), dynamicSapProxy],
  // Note on logging: Vite 8 uses Oxc (not esbuild) by default, so build-time
  // `drop` options are not honoured. Sensitive logs in src/ are wrapped in
  // `if (import.meta.env.DEV)` instead — Vite replaces that with `false` in
  // production and the minifier drops the dead branch.
})
