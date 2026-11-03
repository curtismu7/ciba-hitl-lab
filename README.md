# CIBA HITL LAB

Tier: Demo
Repo: local first; GitHub repo, catalog id and shelf entry need owner approval
Catalog: C1 (provisional, owner to confirm)
Ports: 7580-7589 (default 7580)

Twenty-four steps from scope to tool, with a human in the loop. One login (full scope consent, once), one agent identity, ONE RFC 8693 token exchange: the OBO token keeps the FULL scope set — per-tool narrowing never happens in the token, the Authorize policy does it. A write is DENIED with a CIBA identifier (403); the gateway rewrites the 403 into a JSON-RPC 2.0 error so SDKs that treat raw 403s as fatal keep the session; the human approves; the agent replays with the identifier header; Authorize verifies the CIBA record (never the agent's word) and PERMITs; the tool runs and the response is inspected on the way back. Steps 19-24 are owner-named (2026-11-03).

## What is simulated

**Everything here is SIMULATED.** **Mock mode: everything is SIMULATED** — in-process mock IAM, mock Authorize policy, mock CIBA, mock gateway, mock MCP/RS; every token is mock and labelled; the banner on every page says so. **Real mode: the agent identity and the token exchange run against YOUR PingOne tenant** (owner-configured); the policy decision, the CIBA identifier flow and the MCP tool execution stay SIMULATED app-side in both modes, and the banner names them.

## Run from a clone

```bash
npm ci
npm test          # server (node --test) + web (vitest) + repo checks
npm run doctor    # preflight: ports, hosts, netguard, the mock write cycle behaves as written
npm start         # http://localhost:7580
./scripts/run.sh  # same, checks the port first
```

Endpoints: `GET /api/health`, `GET /api/catalog`, `POST /api/write`, `POST /api/approve`, `POST /api/deny`, `POST /api/decode`, `POST /api/reset`, `POST /api/mode`, `GET /api/info`.

How it fits together: `docs/architecture.md`. What is honest and what is not: `docs/safety.md`. Sources: `docs/references.md`. Owner-only live comparisons: `docs/live-checks.md`. Generated from the step data: `docs/talk-track.md`, `content-pack.json`, `docs/shelf-entry.json`.

## Settings file

Real mode reads the ONE shared settings file `~/Development/.env` (never a per-app file):
`PINGONE_ENVIRONMENT_ID`, Worker app client id + secret, `CIBA_LAB_PERSON_TOKEN` (a real person access token from your own sign-in — agents never sign a person in), `CIBA_LAB_AUDIENCE`, optional `CIBA_LAB_SCOPE` and `CIBA_LAB_AGENT_SCOPE`. See `.env.example`.

## Try it

1. **Flow tab**: press Simulate and walk all 24 steps; click any step for what/why/open; drag boxes, Reset restores the layout.
2. **Live run tab**: Call the write tool -> DENY + identifier + the JSON-RPC 2.0 error. Approve as the human, replay with the identifier -> PERMIT, the tool result returns. Replay again with the same identifier -> denied (single use).
3. **Real button**: disabled with a how-to until the `PINGONE_*` + `CIBA_LAB_*` variables exist in `~/Development/.env` (restart after setting).

## Ports

7580-7589, default 7580. Start with `PORT=<other port in 7580-7589> npm start`.

## Ports, and what to do if the port is taken

7580-7589, default 7580. If it is taken, find the holder with `lsof -iTCP:7580 -sTCP:LISTEN -n -P` and start with `PORT=<other port in 7580-7589> npm start`.

## Mock and Real modes

Mock (default): in-process mock IAM, Authorize policy, CIBA, gateway, MCP and RS; fully offline; the netguard proves zero outbound. Real: the agent identity and the token exchange run against YOUR PingOne tenant from `~/Development/.env` (owner-set); policy, gateway rewrite and MCP stay simulated in both modes. The toggle is in the header of every page; switching reloads all data without a restart.

## Health, doctor and reset

`GET /api/health` returns `demo-health/1`. `npm run doctor` runs the same checks plus a full HTTP cycle (write -> deny -> approve -> permit) and the port check. `npm run reset` (or the Reset control) clears the approval records so identifiers deny again.

## Docker

OrbStack, never Docker Desktop: `HOST_PORT=7580 docker compose up --build -d` -> http://127.0.0.1:7580 (published on 127.0.0.1 only; the container binds 0.0.0.0 via `CIBA_BIND`).

## Tests

`npm test` runs the server tests (node --test), the web tests (vitest) and the repo checks. `npm run mutation-check` pins the policy rule, the single-use identifier, sub/act and the safety middlewares (8 mutants, all killed). `npm run content-pack` rebuilds `content-pack.json`; `npm run talk-track` rebuilds `docs/talk-track.md`.

## Troubleshooting

- **Real button disabled.** Set the `PINGONE_*` + `CIBA_LAB_*` variables in `~/Development/.env` and restart.
- **Port taken.** See the Ports section.
- **Container unhealthy.** `docker compose up --build` again; the healthcheck needs `demo-health/1` ready.

## Ownership

Owned by the owner's AI-DEMO2 session (2026-11-03). Ports 7580-7589. Catalog id C1 is provisional until the owner assigns a real one. GitHub repo, runner and shelf entry need owner approval.
