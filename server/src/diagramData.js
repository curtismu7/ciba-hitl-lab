// The CIBA HITL diagram is diagram-studio/1 DATA (server/diagrams/*.json), loaded by name and
// checked with the studio's own validator copy. Nothing here builds nodes or edges by hand.
import fs from 'node:fs';
import { validateDiagram } from './diagramStudioValidate.js';
import { fillDeep, unfilled, cast } from './cast.js';

const DIR = new URL('../diagrams/', import.meta.url);
export const DIAGRAM_NAMES = ['ciba-hitl'];

export function loadDiagram(name) {
  const doc = JSON.parse(fs.readFileSync(new URL(`${name}.json`, DIR), 'utf8'));
  const problems = validateDiagram(doc);
  if (problems.length) throw new Error(`diagram ${name} is not valid diagram-studio/1: ${problems.join('; ')}`);
  const tokens = JSON.stringify(doc).match(/\{\{(\w+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? [];
  const unknown = [...new Set(tokens)].filter((k) => unfilled(`{{${k}}}`).length);
  if (unknown.length) throw new Error(`diagram ${name} uses tokens the cast does not define: ${unknown.join(', ')}`);
  return doc;
}
const DOCS = Object.fromEntries(DIAGRAM_NAMES.map((n) => [n, loadDiagram(n)]));
export const rawDiagram = (name = 'ciba-hitl') => DOCS[name];

export function buildDiagram(name = 'ciba-hitl') {
  const d = fillDeep(DOCS[name] || DOCS['ciba-hitl'], cast());
  return {
    title: d.title,
    intro: d.lede,
    groups: d.groups,
    nodes: d.nodes.map((n) => ({ id: n.id, label: n.label, kind: n.group, x: n.x, y: n.y })),
    edges: d.edges.map((e) => ({ from: e.source, to: e.target, dashed: !!e.dashed })),
    steps: d.steps.map((s, i) => {
      const e = d.edges[s.edges[0]];
      return { from: e.source, to: e.target, dashed: !!e.dashed, label: s.title, what: s.what, why: s.why ?? null };
    }),
  };
}
