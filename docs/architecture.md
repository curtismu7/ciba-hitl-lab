# Architecture

```text
web (React/Vite, built to web/dist, served by the server)
  └── /api  (same origin only)
        server (Express, one process)
          ├── decisions.js   two deciders: keyword rules + the simulated model (deterministic features)
          ├── corpora.js     hand-labelled rows: 8 guardrail + 8 intent
          ├── app.js         /api/judge, /api/bakeoff, policy mapping (allow/step-up/deny)
          ├── safety.js      loopback bind, Host check, same-origin writes, host/key scanners
          ├── netguard.js    blocks all non-loopback outbound; self-test at boot
          ├── doctor.js      preflight checks shared by /api/health and npm run doctor
          └── mode.js        Mock only; Live refused with the honest reason
```

The question definitions live in `decisions.js`, never in the request: the client may only pick a scenario and send text (the AI-DEMO2 `jevService` trust boundary, copied). The model's feature weights are pinned by tests and mutation checks so the bake-off numbers cannot drift silently.
