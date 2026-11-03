# ciba-hitl-lab — CIBA HITL Lab (catalog id provisional, Demo tier)

Twenty-four steps from scope to tool, with a human in the loop: one login (full scope consent), one agent identity, ONE RFC 8693 token exchange producing an OBO token that keeps the FULL scope set. Per-tool narrowing never happens in the token — the Authorize policy does it. A write is DENIED with a CIBA identifier (403); the gateway rewrites the 403 into a JSON-RPC 2.0 error so SDKs that treat raw 403s as fatal keep the session; the human approves; the agent replays with the identifier header; Authorize verifies the CIBA record (never the agent's word) and PERMITs; the tool runs and the response is inspected on the way back. Steps 19-24 are owner-named (2026-11-03).

Follow the rulebook at `~/Development/STANDALONE-RULES.md`.

## Real and Mock (rule 19)

- **Mock** (default when Real is not configured): in-process mock IAM, mock Authorize policy, mock CIBA, mock gateway, mock MCP/RS. Every token is mock and labelled. Fully offline.
- **Real**: the agent identity (client credentials) and the RFC 8693 token exchange run against YOUR PingOne tenant. Credentials come from the shared `~/Development/.env` (owner-set: `PINGONE_ENVIRONMENT_ID`, Worker app id + secret, `CIBA_LAB_PERSON_TOKEN` from the owner's own sign-in, `CIBA_LAB_AUDIENCE`). Agents never sign a person in. The Worker secret is write-only and never leaves the env; token bodies stay server-side (claims + sha256/8 hash only). The policy decision, the CIBA identifier flow and the MCP tool execution stay SIMULATED in Real mode too — the banner says exactly that.
- The header toggle POSTs `/api/mode {source}`; default source is Real if configured else Mock; Real unconfigured answers 409 with the how-to.

## Non-negotiables

- Loopback bind only (`CIBA_BIND` opt-in; Docker publishes `127.0.0.1:` only), Host check, same-origin writes.
- Mock mode: zero outbound (netguard, self-test at boot). Real mode: exactly the configured PingOne calls.
- No identifiers from other projects. The mock world uses `.invalid` hosts only.
- The identifier is single use: a second replay with the same identifier denies again (test + mutation pinned).
- Node 26 only.

## Module map

- `server/src/flow.js` — the 24 steps (labels, what/why/open, tokens, the JSON-RPC shape), the groups, and the mock write engine (deny -> approve -> replay -> permit, single-use identifier).
- `server/src/jwt.js` — HS256 fixture signer/verifier (aud, act, scope checks).
- `server/src/realPingOne.js` — the Real-mode tenant client (owner-configured).
- `server/src/app.js` — `/api/write`, `/api/approve`, `/api/deny`, `/api/decode`, `/api/mode`, `/api/catalog`.
- `server/src/talkTrack.js` + `server/data/scenarios.json` — the step data; the page and the generated talk track read the same source.
- `web/src/tabs/FlowTab.jsx` — the ReactFlow diagram: movable boxes, Simulate, Next step, Reset (restores positions), speed control, step list with what/why/open.
- `web/src/tabs/RunTab.jsx` — the live run: write -> identifier -> approve/refuse -> replay -> permit.

## Verify before claiming done

```bash
npm ci && npm test && npm run doctor && npm run build -w web
```

Then drive the real page (port 7580): Simulate the 24 steps, then on Live run: write, read the JSON-RPC error, approve, replay with the identifier, see PERMIT + the tool result, replay again for the single-use refusal, flip Mock/Real.
