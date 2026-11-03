# References

- OWASP Agentic AI Threats (draft): the guardrail scenario addresses prompt-injection threats (T5, §4.2.3 in AI-DEMO2's mapping). UNVERIFIED against any product.
- TypeSafe Jev / OpenRouter decisions API: the *wire shape* inspiration for "typed question, typed answer" (AI-DEMO2 `jevService.js`). This lab implements no such API and verifies nothing about the product; the simulated scorer is our own.
- RFC 8693 token exchange: the neighbouring delegation flow the guardrail protects. Covered by the gateway-claims and ID-JAG labs, not this one.
- Node.js net module: what the netguard blocks to non-loopback hosts.

Everything product-specific in this lab is verified in part only: the lab's own behaviour is tested; product claims are not.
