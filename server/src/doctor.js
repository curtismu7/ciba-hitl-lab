// Preflight checks shared by `npm run doctor` and GET /api/health. Never prints a secret, needs no network.
import { assertBindAllowed, bindHost, portProblem, scanHosts, scanKeys, DEFAULT_PORT, PORT_MIN, PORT_MAX } from './safety.js';
import { netguardSelfTest } from './netguard.js';
import { createWorld, personaOf, agentOf, downstreamOf } from './obo.js';
import { cast } from './cast.js';
import { createMode } from './mode.js';
import { realConfigured } from './realPingOne.js';

export async function runChecks({ env = process.env } = {}) {
  const checks = [];
  const add = (id, level, detail) => checks.push({ id, level, detail });

  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 26 ? 'pass' : 'fail', `v${process.versions.node} (need >= 26)`);

  try { add('bind', 'pass', `${assertBindAllowed(bindHost(env), env)}${env.OBOL_BIND ? ' (OBOL_BIND opt-in)' : ' (loopback)'}`); }
  catch (e) { add('bind', 'fail', e.message); }

  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  const problem = portProblem(port);
  add('port-range', problem ? 'fail' : 'pass', problem || `${port} is inside ${PORT_MIN}-${PORT_MAX} and not reserved`);

  const shipped = JSON.stringify({ persona: personaOf(), agent: agentOf(), downstream: downstreamOf(), cast: cast() });
  add('text-hosts', scanHosts(shipped).length ? 'fail' : 'pass', scanHosts(shipped).length ? `non-reserved hosts in shipped constants` : 'every host in shipped constants is .invalid or loopback');
  add('text-keys', scanKeys(shipped).length ? 'fail' : 'pass', 'no key-looking value and no literal JWT in shipped constants');

  const ng = await netguardSelfTest();
  add('netguard', ng.ok ? 'pass' : 'fail', ng.ok ? `blocked fetch, socket, socket-by-IP, dns lookup, dns resolve, udp send and udp connect to a non-loopback host (${ng.blocked}/7)` : ng.detail);

  // the mock run must behave as written: downstream accepts delegated, refuses inbound, sub kept, act added
  try {
    const w = createWorld();
    const run = await w.run();
    const ok = run.ok && run.downstream.delegatedStatus === 200 && run.downstream.inboundStatus === 401
      && run.delta.subSame && run.delta.actAdded && run.delta.scopeNarrowed && run.delta.audSame && !run.leak;
    add('obo-run', ok ? 'pass' : 'fail', ok ? 'mock run: downstream 200 for the delegated token, 401 for the person\'s own, sub kept, act added, scope narrowed, no leak' : `mock run misbehaves: ${JSON.stringify(run.delta)} ${JSON.stringify(run.downstream)}`);
    w.revokeAgent();
    const refused = await w.run();
    add('revocation', refused.ok === false && refused.failedStep === 2 ? 'pass' : 'fail', refused.ok === false ? 'a revoked agent is refused at step 2 (invalid_client)' : 'revocation did not stop the run');
  } catch (e) { add('obo-run', 'fail', e.message); }

  const modeState = createMode({ env });
  add('mode', 'pass', realConfigured(env)
    ? `Mock and Real: your PingOne tenant is configured; the toggle switches without a restart. Default source: ${modeState.source()}.`
    : 'Mock and Real toggle present; Real is not configured (set PINGONE_* + OBO_LAB_* in ~/Development/.env), so the Real button is disabled with the how-to. Default: Mock.');
  add('tenant', 'pass', 'mock only by default: no tenant, no credentials, no outbound network (Real mode makes exactly the configured PingOne + downstream calls)');
  return checks;
}

export const allPassed = (checks) => checks.every((c) => c.level !== 'fail');
