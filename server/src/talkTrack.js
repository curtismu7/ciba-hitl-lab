// The talk track is generated from the step data, so docs/talk-track.md and the presenter view cannot drift.
import { STEPS } from './flow.js';

export const TALK_INTRO = 'Twenty-four steps, one story: one login, one token exchange, one approval. The token never narrows per tool - the Authorize policy does - and a write only runs after a human says yes. The banner stays on screen, also in presenter mode.';
export const TALK_OUTRO = 'Replay the write with the identifier: Authorize verifies the CIBA record, not the agent word. That is proof of enforcement, not of promises.';

export const talkLines = () => STEPS.map((s, i) => ({ id: String(i + 1), title: s.label, say: s.why, open: s.open ?? null }));

export function renderTalkTrackMarkdown() {
  return `# Talk track\n\n${TALK_INTRO}\n\n${talkLines().map((l) => `- **${l.id} ${l.title}.** ${l.say}${l.open ? ` (Open: ${l.open})` : ''}`).join('\n')}\n\n${TALK_OUTRO}\n`;
}
