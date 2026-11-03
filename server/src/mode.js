// Mock / Real. Rule 19: runtime server-side mode, POST /api/mode with exactly {source}, GET /api/info
// returns {source, realAvailable, realReason}. Default: Real if configured, else Mock.
// Real = your own PingOne tenant (see realPingOne.js); configured from ~/Development/.env. The owner
// sets the credentials and supplies the subject token; agents never sign a person in.
import { loadSharedEnv } from './env.js';
import { realConfigured, NO_REAL } from './realPingOne.js';

export const MODES = ['mock', 'real'];

export function createMode({ env = process.env, forceMock = false } = {}) {
  const canReal = !forceMock && realConfigured(env);
  const state = { source: canReal ? 'real' : 'mock' };
  return {
    info: () => ({ source: state.source, realAvailable: canReal, realReason: canReal ? null : NO_REAL }),
    source: () => state.source,
    set: (source) => { state.source = source; },
  };
}
export { loadSharedEnv };
