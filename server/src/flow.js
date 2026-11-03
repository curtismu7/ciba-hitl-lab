// The CIBA HITL flow engine, mock only in Mock mode. Real mode runs the live legs against the
// owner-configured PingOne tenant (see realPingOne.js). The 24 steps mirror the owner's
// scope-to-tool POC diagram; step names were named by the owner on 2026-11-03.
//
// The story: one login + one agent identity + ONE token exchange produce one OBO token carrying
// the full scope set. Per-tool narrowing does NOT happen in the token: the Authorize policy does
// it. A write needs HITL, so Authorize starts CIBA and denies WITH an identifier; the gateway
// rewrites the 403 into a JSON-RPC 2.0 error (so SDKs that treat raw 403s as fatal keep the
// session); the user approves; the agent replays with the identifier header; Authorize verifies
// the CIBA record and permits; the tool runs and the response is inspected on the way back.
import { fixtureSigner, createVerifier } from './jwt.js';
import { cast } from './cast.js';

const ISSUER = 'https://mock-iam.invalid';
const now = () => Math.floor(Date.now() / 1000);
export function jwtDecode(token) { try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return null; } }

export const personaOf = () => {
  const c = cast();
  return { sub: 'user.0042', name: c.personName, clientId: 'web-banking', brand: c.brand, inboundScope: 'openid profile api:read api:write api:delete' };
};
export const agentOf = () => ({ clientId: cast().agentId, ccScope: 'agent:identity' });
export const gatewayOf = () => ({ aud: 'https://ai-gateway.invalid' });
export const downstreamOf = () => ({ aud: cast().downstream, acceptedScope: 'api:read api:write api:delete' });

export const GROUPS = [
  { name: 'User login and user token', from: 1, to: 4, color: '#2f6fdb' },
  { name: 'Agent identity', from: 5, to: 6, color: '#0f8b8d' },
  { name: 'Token exchange (OBO)', from: 7, to: 7, color: '#1f7a4d' },
  { name: 'Write call reaches Authorize', from: 8, to: 10, color: '#6b7a1a' },
  { name: 'Authorize denies, starts CIBA', from: 11, to: 11, color: '#c8102e' },
  { name: 'Gateway rewrites the 403', from: 12, to: 12, color: '#d98200' },
  { name: 'User approves (CIBA)', from: 13, to: 14, color: '#b5497a' },
  { name: 'Replay and permit', from: 15, to: 17, color: '#0b6fa8' },
  { name: 'Tool runs, response returns', from: 18, to: 24, color: '#5b6b7f' },
];
export function groupOf(step) { return GROUPS.findIndex((g) => step >= g.from && step <= g.to); }

// The 24 steps: label (owner-named), what happens, why it matters, open questions.
export const STEPS = [
  { label: 'User initiates login', what: 'The user opens the application in a browser and starts logging in. Nothing agent-specific has happened yet.', why: 'Everything after this hangs off one login session. The user logs in once, not once per tool.' },
  { label: 'Authorize request', what: 'The application sends an OIDC authorization request to IAM Core for the client agentClient, asking for all three scopes at once.', why: 'This is the only scope consent in the flow: the user consents once, up front, not per tool call.', open: 'Does the user see a consent screen for each scope, or is consent implied for this client?' },
  { label: 'User authenticates', what: 'The user authenticates with IAM Core. The arrow is two-way because the browser is redirected to IAM Core and returned afterwards.', why: 'This proves who the human is. Password, MFA and similar steps are whatever policy requires.' },
  { label: 'User token', what: 'IAM Core returns a user token to the application.', why: 'The audience is the API gateway, not the AI gateway. The exchange in step 7 changes the audience. The token already carries all three scopes.', token: { aud: 'https://api-gateway.example', sub: 'user', scopes: 'api:read, api:write, api:delete' } },
  { label: 'Agent authenticates', what: 'The agent authenticates to IAM Core as itself, using its own non-human identity.', why: 'The agent gets an identity separate from the user. That separation lets the OBO token say "this user, acting through this agent".' },
  { label: 'Agent token', what: 'IAM Core returns an agent token.', why: 'It proves who the agent is, but names no user. It is never used on its own to call tools: it becomes the actor token in step 7.', token: { sub: 'agentID', aud: ['https://ai-gateway.example'] } },
  { label: 'Token exchange: actor + user token', what: 'Token exchange with the actor token (agent) and the user token (subject). The result is the OBO token. Two-way: the agent sends the request and gets the new token back.', why: 'This is the only token exchange in the whole flow. The OBO token carries the FULL scope set; the token does not narrow per tool. Authorize does that.', token: { sub: 'user', aud: ['https://ai-gateway.example'], act: { sub: 'agentID' }, scopes: 'api:read, api:write, api:delete' }, open: 'The exchange changes the audience from the API gateway to the AI gateway. The TE policy must allow that.' },
  { label: 'Write request', what: 'The application asks the agent to do something that needs a write, for example "update this record".', why: 'The agent, not the application, decides which tool to call.' },
  { label: 'Write tool call', what: 'The agent calls the write tool through the MCP Gateway, carrying the OBO token.', why: 'The gateway sits in front of the MCP Server and intercepts the call before it reaches the tool.' },
  { label: 'Policy decision request', what: 'The gateway asks Authorize for a decision. The inputs are the user (sub), the agent (act), the tool and the action.', why: 'The decision is made on who the user and agent are and which tool is called, not on token scopes alone. Authorize can plug into any gateway.', },
  { label: '403 with identifier', what: 'Policy says write requires HITL. Authorize triggers CIBA and returns DENY with an identifier, as an HTTP 403.', why: 'The identifier ties the later replay (step 15) to this approval. Because Authorize starts the CIBA request, it holds the audit record.', open: 'Paul has CIBA both started and completed in PAZ. The application prompt (steps 13-14) is one option; which one do we use?' },
  { label: 'JSON-RPC 2.0 error with identifier', what: 'The gateway rewrites the 403 into a JSON-RPC 2.0 error that carries the identifier, and returns it to the agent.', why: 'SDKs that treat a raw 403 as fatal would kill the session. A JSON-RPC error looks like an ordinary tool error, so the session survives.', rpc: { jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'Approval required', data: { identifier: '<ciba request id>' } } }, open: 'Exact error fields are not defined yet.' },
  { label: 'Prompt for CIBA acceptance', what: 'The agent sees the identifier and asks the application to prompt the user for CIBA acceptance.', why: 'The agent never calls CIBA endpoints itself. It only relays the request to the application. This is the one custom behaviour the customer AI team writes.', open: 'CIBA uses a magic link, so the approval channel is flexible. The application is only one option.' },
  { label: 'Accept / Yes', what: 'The user accepts. The application tells the agent "yes".', why: 'This is the human-in-the-loop moment. Approval is recorded against the CIBA request, not trusted from the agent word.' },
  { label: 'Replay tool call, header has identifier', what: 'The agent replays the same tool call with the same OBO token, adding a header that contains the identifier.', why: 'This is how the approval context gets back to Authorize across the gateway. The agent only echoes the identifier.', open: 'The header name is a placeholder.' },
  { label: 'Policy decision request', what: 'The gateway sends Authorize a second policy decision request, now including the identifier header.', why: 'Same inputs as step 10, plus the identifier.' },
  { label: 'Permit', what: 'Authorize detects the header and checks the CIBA call. The human approved it, so Authorize returns PERMIT.', why: 'The agent is not asked to prove the approval: Authorize verifies it. A denied or expired request is denied again.' },
  { label: 'Tool request with OBO token', what: 'The gateway forwards the tool request to the MCP Server with the OBO token.', why: 'The MCP Server sees the user in sub and the agent in act, so downstream audit shows both.' },
  { label: 'MCP Server executes the write', what: 'The MCP Server calls the Resource Server to do the actual work.', why: 'The write only happens after a human approved it.' },
  { label: 'Resource Server result returns to MCP Server', what: 'The Resource Server returns its result to the MCP Server.', why: 'The result is data, not a token: nothing here widens what the agent can do next.' },
  { label: 'Response inspected at Authorize', what: 'As drawn, the MCP Server response goes to Authorize on its way back, not straight to the gateway.', why: 'Probably response inspection or audit. The policy engine sees both directions of the call.', open: 'The POC diagram does not say why. Confirm with CJ.' },
  { label: 'Authorized response reaches the Gateway', what: 'Authorize passes the response to the gateway.', why: 'The gateway relays it to the caller.' },
  { label: 'Gateway returns the result to the Agent', what: 'The gateway returns the response to the agent.', why: 'The agent sees an ordinary tool result.' },
  { label: 'Agent shows the result in the Application', what: 'The agent returns the result to the application, and the user sees it. Done.', why: 'One login, one exchange, one approval: the write happened under the user identity with the agent recorded.', open: 'Does the NEXT write need approval again, or does one approval cover a time window? A policy choice in Authorize.' },
];

export function createFlow({ signer = fixtureSigner, verifier = createVerifier() } = {}) {
  const state = { runs: [], approvals: {}, nextId: 1, agentClientEnabled: true };
  const b64uJson = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const decode = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')); } catch { return null; } };

  return {
    state,
    reset() { state.runs = []; state.approvals = {}; state.nextId = 1; state.agentClientEnabled = true; },
    disableAgentClient() { state.agentClientEnabled = false; },

    // Steps 1-8: sign-in, agent identity, exchange. Steps 9-12: first write -> 403 + JSON-RPC error.
    // approve(identifier) records the CIBA acceptance. A replay WITH the identifier header and a recorded
    // approval reaches PERMIT and runs the tool (steps 15-24). Without the approval the replay denies again.
    async writeCall({ identifierHeader } = {}) {
      const PERSONA = personaOf(), AGENT = agentOf(), GW = gatewayOf(), DOWN = downstreamOf();
      if (!state.agentClientEnabled) {
        return { ok: false, failedStep: 5, error: 'the agent client is disabled; step 5 (agent authentication) is refused with invalid_client' };
      }
      const iat = now();
      // steps 1-4: user token (aud = API gateway, full scopes)
      const userClaims = { iss: ISSUER, sub: PERSONA.sub, aud: DOWN.aud, client_id: PERSONA.clientId, scope: PERSONA.inboundScope, iat, exp: iat + 600 };
      const userToken = await signer(userClaims, 'user');
      // steps 5-6: agent token (the actor)
      const agentClaims = { iss: ISSUER, sub: AGENT.clientId, aud: GW.aud, client_id: AGENT.clientId, scope: AGENT.ccScope, iat, exp: iat + 300 };
      const agentToken = await signer(agentClaims, 'agent');
      // step 7: the single exchange -> OBO token: sub kept, act added, aud -> AI gateway, FULL scopes kept
      const oboClaims = {
        iss: ISSUER, sub: PERSONA.sub, aud: GW.aud, client_id: 'token-exchanger',
        scope: 'api:read api:write api:delete', iat, exp: iat + 300,
        act: { sub: AGENT.clientId, iss: ISSUER },
      };
      const oboToken = await signer(oboClaims, 'obo');

      // step 10: policy decision on the write
      const decision = { tool: 'update_record', action: 'write', sub: oboClaims.sub, act: oboClaims.act.sub };
      const replayed = typeof identifierHeader === 'string' && identifierHeader.length > 0 && identifierHeader.length <= 200;
      const approved = replayed && state.approvals[identifierHeader] === 'approved' && state.approvals[`${identifierHeader}:used`] === undefined;
      if (approved) state.approvals[`${identifierHeader}:used`] = 'used'; // single use

      if (!approved) {
        // step 11: DENY with identifier; Authorize starts CIBA and holds the audit record
        const identifier = `ciba-${state.nextId++}`;
        state.approvals[identifier] = 'pending';
        // steps 12: the gateway rewrite - raw 403 becomes a JSON-RPC 2.0 error carrying the identifier
        const rpcError = { jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'Approval required', data: { identifier } } };
        return {
          ok: true, outcome: 'hitl_required', identifier, rpcError,
          obo: { token: oboToken, claims: oboClaims },
          user: { token: userToken, claims: userClaims },
          agent: { token: agentToken, claims: agentClaims },
          decision: { ...decision, result: 'DENY', reason: 'write requires human-in-the-loop: CIBA started' },
          stepsCovered: replayed ? 'a replay without a recorded approval denies again (expired or forged identifier)' : 'steps 1-12',
        };
      }
      // step 17: PERMIT -> tool runs (18-20), response inspected (21-22), returned (23-24)
      const v = verifier(oboToken, { aud: GW.aud, requireAct: true, maxScope: 'api:read api:write api:delete' });
      return {
        ok: true, outcome: 'permit', identifier: identifierHeader,
        obo: { token: oboToken, claims: oboClaims },
        user: { token: userToken, claims: userClaims },
        agent: { token: agentToken, claims: agentClaims },
        decision: { ...decision, result: 'PERMIT', reason: 'CIBA approval verified for this identifier (single use)' },
        mcp: { status: v.ok ? 200 : 401, why: v.why, result: { record: 'id-9012', status: 'updated', by: oboClaims.act.sub, for: oboClaims.sub } },
        stepsCovered: 'steps 15-24: replay with identifier -> PERMIT -> tool ran -> response inspected -> result returned',
      };
    },

    // Step 14: the user accepts in the application; the CIBA record moves to approved.
    approve(identifier) {
      if (typeof identifier !== 'string' || !state.approvals[identifier]) return false;
      state.approvals[identifier] = 'approved';
      return true;
    },
    denyCiba(identifier) {
      if (typeof identifier !== 'string' || !state.approvals[identifier]) return false;
      state.approvals[identifier] = 'denied';
      return true;
    },
  };
}
