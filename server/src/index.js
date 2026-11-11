import { installNetguard, outboundAllowlist } from './netguard.js';
import { createApp } from './app.js';
import { allPassed, runChecks } from './doctor.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';

// The outbound allowlist is exactly what Real mode calls (the PingOne auth hosts) when Real is configured
// from the shared settings file, and empty otherwise: Mock mode stays provably offline.
installNetguard({ outboundAllow: outboundAllowlist() }); // before anything else can open a socket

const checks = await runChecks();
if (!allPassed(checks)) {
  for (const c of checks.filter((x) => x.level === 'fail')) console.error(`[ciba-hitl-lab] refusing to start: ${c.id}: ${c.detail}`);
  process.exit(1);
}
const host = assertBindAllowed(bindHost(), process.env);
const port = resolvePort();
const server = createApp().listen(port, host, () => {
  console.log(`[ciba-hitl-lab] CIBA HITL lab at http://${host}:${port} (Mock mode by default; loopback; Real mode runs the owner-configured PingOne token legs. The policy decision, gateway rewrite and MCP stay SIMULATED.)`);
  console.log(`[ciba-hitl-lab] health: /api/health | catalog: /api/catalog | write: POST /api/write | approve: POST /api/approve`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
