# Architecture

```text
web (React/Vite, built to web/dist, served by the server)
  └── /api  (same origin only)
        server (Express, one process)
          ├── flow.js         the 24 steps (labels, what/why/open), groups, the mock write engine
          ├── jwt.js          HS256 fixture signer/verifier (aud, act, scope checks)
          ├── realPingOne.js  Real mode: live client credentials + token exchange (owner-configured)
          ├── app.js          /api/write, /api/approve, /api/deny, /api/decode, /api/mode, /api/catalog
          ├── safety.js       loopback bind, Host check, same-origin writes, host/key scanners
          ├── netguard.js     blocks all non-loopback outbound (Mock); self-test at boot
          ├── doctor.js       preflight checks shared by /api/health and npm run doctor
          └── mode.js         Mock/Real at runtime (rule 19); Real refused with the how-to when unconfigured
```

The step data lives in `flow.js` (and `server/data/scenarios.json` for the generated artifacts): the page renders the server's catalog, so the diagram, the step list, the talk track and the content pack cannot drift. The policy rule (write requires human-in-the-loop) and the single-use identifier are engine behaviour, pinned by tests and mutation checks — the client cannot influence a decision, only trigger a write and echo an identifier.
