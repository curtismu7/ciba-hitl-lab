# Talk track

Seven steps, one story: your identity is kept, the agent is recorded as the actor, everything else is narrowed. The banner stays on screen, also in presenter mode.

- **1 You are signed in.** Your session holds a PingOne access token. The lab reads it server-side and uses it as the subject of the exchange. It is shown here because it is your own token; over MCP the model never receives it.
- **2 Agent gets its own identity.** The AI Agent app proves who the agent is with its own credentials. This becomes the actor in the exchange.
- **3 Token exchange (RFC 8693).** The Token Exchanger app trades your token plus the agent token for one delegated token.
- **4 Delegated token: what changed.** Your identity is kept, the agent is recorded as the actor, and the audience and scope are narrowed.
- **5 Downstream accepts the delegated token.** The downstream API only accepts a token with the right audience and an act claim.
- **6 Downstream refuses your own token.** The same call with your original token is refused: only the delegated token carries the agent.
- **7 No token reached the model.** Everything the page would hand to a model is scanned for token text. This page shows tokens because you are the signed-in user who ran the exchange; the model never receives them.

Run the refusal: the person's own token is refused at the same door that accepted the delegated token. That is proof of enforcement, not of tokens.
