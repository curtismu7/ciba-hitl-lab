// The talk track is generated from the step data, so docs/talk-track.md and the presenter view cannot drift.
import { STEPS } from './steps.js';

export const TALK_INTRO = 'Seven steps, one story: your identity is kept, the agent is recorded as the actor, everything else is narrowed. The banner stays on screen, also in presenter mode.';
export const TALK_OUTRO = 'Run the refusal: the person\'s own token is refused at the same door that accepted the delegated token. That is proof of enforcement, not of tokens.';

export const talkLines = () => Object.entries(STEPS).map(([id, s]) => ({ id, title: s.title, say: s.why }));

export function renderTalkTrackMarkdown() {
  return `# Talk track\n\n${TALK_INTRO}\n\n${talkLines().map((l) => `- **${l.id} ${l.title}.** ${l.say}`).join('\n')}\n\n${TALK_OUTRO}\n`;
}
