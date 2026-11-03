// Preflight checks shared by `npm run doctor` and GET /api/health. Never prints a secret, needs no network.
import { assertBindAllowed, bindHost, portProblem, scanHosts, scanKeys, DEFAULT_PORT, PORT_MIN, PORT_MAX } from './safety.js';
import { netguardSelfTest } from './netguard.js';
import { createFlow, personaOf, agentOf, downstreamOf, STEPS } from './flow.js';
import { cast } from './cast.js';
import { createMode } from './mode.js';
import { realConfigured } from './realPingOne.js';

export async function runChecks({ env = process.env } = {}) {
  const checks = [];
  const add = (id, level, detail) => checks.push({ id, level, detail });

  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 26 ? 'pass' : 'fail', `v${process.versions.node} (need >= 26)`);

  try { add('bind', 'pass', `${assertBindAllowed(bindHost(env), env)}${env.CIBA_BIND ? ' (CIBA_BIND opt-in)' : ' (loopback)'}`); }
  catch (e) { add('bind', 'fail', e.message); }

  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  const problem = portProblem(port);
  add('port-range', problem ? 'fail' : 'pass', problem || `${port} is inside ${PORT_MIN}-${PORT_MAX} and not reserved`);

  const shipped = JSON.stringify({ persona: personaOf(), agent: agentOf(), downstream: downstreamOf(), cast: cast(), steps: STEPS });
  add('text-hosts', scanHosts(shipped).length ? 'fail' : 'pass', scanHosts(shipped).length ? 'non-reserved hosts in shipped constants' : 'every host in shipped constants is .invalid or loopback');
  add('text-keys', scanKeys(shipped).length ? 'fail' : 'pass', 'no key-looking value and no literal JWT in shipped constants');

  const ng = await netguardSelfTest();
  add('netguard', ng.ok ? 'pass' : 'fail', ng.ok ? `blocked fetch, socket, socket-by-IP, dns lookup, dns resolve, udp send and udp connect to a non-loopback host (${ng.blocked}/7)` : ng.detail);

  // The mock write cycle must behave as written: first call denies with an identifier + JSON-RPC error,
  // approval + replay permits and runs the tool, a replay with a used identifier denies again.
  try {
    const f = createFlow();
    const first = await f.writeCall();
    const okFirst = first.outcome === 'hitl_required' && typeof first.identifier === 'string'
      && first.rpcError.error.data.identifier === first.identifier && first.decision.result === 'DENY';
    const approved = f.approve(first.identifier);
    const second = await f.writeCall({ identifierHeader: first.identifier });
    const okSecond = approved && second.outcome === 'permit' && second.mcp.status === 200 && second.obo.claims.sub === first.obo.claims.sub && Boolean(second.obo.claims.act);
    const third = await f.writeCall({ identifierHeader: first.identifier });
    add('write-cycle', okFirst && okSecond && third.outcome === 'hitl_required' ? 'pass' : 'fail',
      okFirst && okSecond ? 'mock cycle: write -> DENY + identifier + JSON-RPC error, approve -> replay PERMITs and the tool runs (sub kept, act added), a replay with the used identifier denies again' : `mock write cycle misbehaves: ${first.outcome}/${second.outcome}/${third.outcome}`);
    // 24 steps, owner-named, all labelled
    add('steps', STEPS.length === 24 && STEPS.every((s) => s.label && s.what && s.why) ? 'pass' : 'fail', `${STEPS.length} steps, every one with an owner-approved label, what and why`);
  } catch (e) { add('write-cycle', 'fail', e.message); }

  const modeState = createMode({ env });
  add('mode', 'pass', realConfigured(env)
    ? `Mock and Real: your PingOne tenant is configured; the toggle switches without a restart. Default source: ${modeState.source()}.`
    : 'Mock and Real toggle present; Real is not configured (set PINGONE_* + CIBA_LAB_* in ~/Development/.env), so the Real button is disabled with the how-to. Default: Mock.');
  add('tenant', 'pass', 'mock only by default: no tenant, no credentials, no outbound network (Real mode makes exactly the configured PingOne calls; policy, gateway rewrite and MCP stay simulated)');
  return checks;
}

export const allPassed = (checks) => checks.every((c) => c.level !== 'fail');
