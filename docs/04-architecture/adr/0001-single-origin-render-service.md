# ADR 0001: Serve the web client and API from one Render web service

- **Status:** Accepted, 2026-11-17
- **Supersedes:** the master build prompt's plan for a separate Render static site and Node web service.

## Context

Sessions use a short-lived access token held in memory, plus a rotating refresh token in an `httpOnly` cookie. Render gives each service its own `*.onrender.com` subdomain. `onrender.com` is on the Public Suffix List, so browsers treat two such subdomains as **different sites**. A refresh cookie set by the API would then be a third-party cookie for the web client. Safari blocks those by default and other browsers are restricting them, so users would be signed out on every reload or after 15 minutes.

The alternatives each had a cost:

- **Custom domains on both services**, so they share a registrable domain. Requires owning a domain and configuring DNS before the first deploy.
- **A static-site rewrite that proxies `/api/*` to the API.** It couldn't be verified for cookie and POST handling from the development environment, and it adds a hop that hides client IPs from rate limiting.
- **Refresh tokens in browser storage.** Exposes them to any script on the page, which this design is meant to prevent.

## Decision

The Next.js client stays a fully static export (`next build` → `web-app/frontend/out`). The Express API serves those files when `STATIC_DIR` is set. Everything is delivered from one origin by one Render web service:

- the refresh cookie is first-party: `Secure; HttpOnly; SameSite=Strict; Path=/api/v1/auth`;
- no CORS is needed in production;
- the Content-Security-Policy can set `connect-src 'self'`;
- only one free-tier service needs to stay warm.

## Consequences

- The front end can still be moved to a CDN or static host later without code changes. Set `NEXT_PUBLIC_API_BASE_URL` at build time and give both services a shared custom domain.
- The CSP allows `'unsafe-inline'` scripts, because the Next.js static export bootstraps hydration inline. Replacing this with hashes needs a build step that computes them; that is tracked as hardening work.
- Render's free plan sleeps after inactivity, so the first request after idle is slow. A paid plan removes this.
