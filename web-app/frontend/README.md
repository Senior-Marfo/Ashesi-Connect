# Ashesi Graduation Tracker web client

Next.js static export (`out/`) that calls the API at `NEXT_PUBLIC_API_BASE_URL`.

```bash
npm install
npm run build         # static export to out/
npm test              # unit tests (Vitest + Testing Library)
npm run test:e2e      # Playwright; starts the backend demo API and serves out/
```

`index.html` and `degree-audit-2028-prototype.html` are the legacy browser-only demo, which is still what Render publishes. They are kept until the authenticated screens replace them.
