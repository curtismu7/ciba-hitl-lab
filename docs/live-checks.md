# Live checks (optional, owner only)

Mock mode talks to nothing real, and the tests prove it (netguard). Real mode talks ONLY to the PingOne tenant configured in the shared settings file, and only for the token legs. This page is for the owner who wants to compare the mock with real products. **It is instructions only: no script in this repo runs any of it, and the agent that built this repo never ran it.** Run it from your own shell. Never paste tenant ids, client ids, hostnames, keys or tokens into this repo, its issues or its commit messages.

**Read-only first.** Every check sends at most one call with a token you already own, to a test environment. Anything that creates, changes or revokes configuration is owner-only and listed last.

## What you need

- A PingOne environment with a Worker app (client credentials) and a person access token from your own sign-in, held in a `chmod 600` file outside this repo, loaded with `TOKEN=$(cat ~/path/outside/repo)`. Never print them.
- An app with the CIBA capability enabled if you want to compare the identifier flow (owner-set).

## Checks

1. **The exchange (mock steps 5-7).** With the app's Real mode, or by hand: `client_credentials` for the agent, then the token exchange with `subject_token` + `actor_token`, `audience` set. Verify the result keeps `sub`, adds `act` and KEEPS the full scope set (the token does not narrow). UNVERIFIED: whether your TE policy allows the audience change from API gateway to AI gateway.
2. **Write policy (mock steps 10-11).** In Authorize/PAZ, author the write-requires-HITL rule and call the decision endpoint with the OBO token. Compare the DENY shape and where the identifier travels. UNVERIFIED: PAZ can both start and complete CIBA; which pattern you use is a design choice.
3. **Gateway rewrite (mock step 12).** Check whether your gateway (Privilege, Bedrock agentcore gateway, PingGateway) can rewrite a 403 into a JSON-RPC 2.0 error. UNVERIFIED per gateway.
4. **Replay header (mock step 15).** Replay the decision request with the identifier in a header and confirm PERMIT. UNVERIFIED: the header name is a placeholder.
5. **Response path (mock step 21).** Confirm whether responses really traverse Authorize on the way back in your deployment. The POC diagram says so; the reason is UNVERIFIED.

## Not covered here (writes, owner only)

- Enabling CIBA for an application, authoring Authorize policies, changing gateway routes or token-exchange policies.

## Recording results

Keep a few lines in your own notes (not this repo): date, product version, which checks matched the mock, which differed. If a difference changes what an SE should say, update `docs/talk-track.md` and `docs/safety.md` in a normal commit that names no tenant details.

## After you are done

Delete any captured output and the token file if it was temporary. Do not commit them.
