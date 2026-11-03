# Talk track

Twenty-four steps, one story: one login, one token exchange, one approval. The token never narrows per tool - the Authorize policy does - and a write only runs after a human says yes. The banner stays on screen, also in presenter mode.

- **1 User initiates login.** Everything after this hangs off one login session. The user logs in once, not once per tool.
- **2 Authorize request.** This is the only scope consent in the flow: the user consents once, up front, not per tool call. (Open: Does the user see a consent screen for each scope, or is consent implied for this client?)
- **3 User authenticates.** This proves who the human is. Password, MFA and similar steps are whatever policy requires.
- **4 User token.** The audience is the API gateway, not the AI gateway. The exchange in step 7 changes the audience. The token already carries all three scopes.
- **5 Agent authenticates.** The agent gets an identity separate from the user. That separation lets the OBO token say "this user, acting through this agent".
- **6 Agent token.** It proves who the agent is, but names no user. It is never used on its own to call tools: it becomes the actor token in step 7.
- **7 Token exchange: actor + user token.** This is the only token exchange in the whole flow. The OBO token carries the FULL scope set; the token does not narrow per tool. Authorize does that. (Open: The exchange changes the audience from the API gateway to the AI gateway. The TE policy must allow that.)
- **8 Write request.** The agent, not the application, decides which tool to call.
- **9 Write tool call.** The gateway sits in front of the MCP Server and intercepts the call before it reaches the tool.
- **10 Policy decision request.** The decision is made on who the user and agent are and which tool is called, not on token scopes alone. Authorize can plug into any gateway.
- **11 403 with identifier.** The identifier ties the later replay (step 15) to this approval. Because Authorize starts the CIBA request, it holds the audit record. (Open: Paul has CIBA both started and completed in PAZ. The application prompt (steps 13-14) is one option; which one do we use?)
- **12 JSON-RPC 2.0 error with identifier.** SDKs that treat a raw 403 as fatal would kill the session. A JSON-RPC error looks like an ordinary tool error, so the session survives. (Open: Exact error fields are not defined yet.)
- **13 Prompt for CIBA acceptance.** The agent never calls CIBA endpoints itself. It only relays the request to the application. This is the one custom behaviour the customer AI team writes. (Open: CIBA uses a magic link, so the approval channel is flexible. The application is only one option.)
- **14 Accept / Yes.** This is the human-in-the-loop moment. Approval is recorded against the CIBA request, not trusted from the agent word.
- **15 Replay tool call, header has identifier.** This is how the approval context gets back to Authorize across the gateway. The agent only echoes the identifier. (Open: The header name is a placeholder.)
- **16 Policy decision request.** Same inputs as step 10, plus the identifier.
- **17 Permit.** The agent is not asked to prove the approval: Authorize verifies it. A denied or expired request is denied again.
- **18 Tool request with OBO token.** The MCP Server sees the user in sub and the agent in act, so downstream audit shows both.
- **19 MCP Server executes the write.** The write only happens after a human approved it.
- **20 Resource Server result returns to MCP Server.** The result is data, not a token: nothing here widens what the agent can do next.
- **21 Response inspected at Authorize.** Probably response inspection or audit. The policy engine sees both directions of the call. (Open: The POC diagram does not say why. Confirm with CJ.)
- **22 Authorized response reaches the Gateway.** The gateway relays it to the caller.
- **23 Gateway returns the result to the Agent.** The agent sees an ordinary tool result.
- **24 Agent shows the result in the Application.** One login, one exchange, one approval: the write happened under the user identity with the agent recorded. (Open: Does the NEXT write need approval again, or does one approval cover a time window? A policy choice in Authorize.)

Replay the write with the identifier: Authorize verifies the CIBA record, not the agent word. That is proof of enforcement, not of promises.
