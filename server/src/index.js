import { installNetguard } from './netguard.js';
import { createApp } from './app.js';
import { allPassed, runChecks } from './doctor.js';
import { assertBindAllowed, bindHost, resolvePort } from './safety.js';

installNetguard(); // before anything else can open a socket

const checks = await runChecks();
if (!allPassed(checks)) {
  for (const c of checks.filter((x) => x.level === 'fail')) console.error(`[ciba-hitl-hitl-lab] refusing to start: ${c.id}: ${c.detail}`);
  process.exit(1);
}
const host = assertBindAllowed(bindHost(), process.env);
const port = resolvePort();
const server = createApp().listen(port, host, () => {
  console.log(`[ciba-hitl-hitl-lab] delegation lab at http://${host}:${port} (Mock mode only; loopback; the decision model is SIMULATED, no LLM, no outbound network)`);
  console.log(`[ciba-hitl-hitl-lab] health: /api/health | catalog: /api/catalog | judge: POST /api/judge | bakeoff: POST /api/bakeoff`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
