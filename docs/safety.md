# Safety

- Loopback bind only unless `CIBA_BIND` is set on purpose. Docker publishes `127.0.0.1:` only.
- Host header must be a loopback name (DNS-rebinding defence); writes must be same-origin.
- Zero outbound calls in Mock mode: the netguard blocks fetch, socket, DNS and UDP to non-loopback hosts and self-tests at startup. Real mode makes exactly the configured PingOne calls.
- Every host in shipped text is reserved (`.invalid` / `.example` / `example.com`); the doctor checks this on every run.
- No key-looking strings and no literal JWTs in shipped text; scanKeys enforces it. Tokens are minted by the mock IAM at run time.
- No tenant, no credentials, no real identifiers. The Worker secret in Real mode never leaves the env and is never returned.

## What is simulated

**The whole flow in Mock mode.** The mock IAM mints HS256 fixture tokens; the mock Authorize policy is a fixed rule (write requires human-in-the-loop) pinned by tests; the mock CIBA is an in-process approval record with a single-use identifier; the gateway rewrite, the MCP server and the resource server are in-process. Nothing here is a product, and no claim is made about any product's behaviour, latency or cost.

**Real mode:** the agent identity (client credentials) and the RFC 8693 token exchange run against the configured PingOne tenant. The policy decision, the CIBA identifier flow and the MCP tool execution stay simulated app-side in Real mode too, and the banner names them.

## UNVERIFIED

The POC diagram's open questions (consent per scope, CIBA start/completed in PAZ, exact JSON-RPC error fields, header name, why the response traverses Authorize, approval once versus per time window) are carried into the app as OPEN labels on the affected steps. They are not verified against any product.
