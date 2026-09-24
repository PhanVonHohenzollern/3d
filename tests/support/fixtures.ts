import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const fixturesRoot = path.join(webRoot, 'tests', 'fixtures');

export interface ConnectorDirective {
  type: 'Circular' | 'Rectangular';
  orientation: 'XPositive' | 'XNegative' | 'YPositive' | 'YNegative' | 'ZPositive' | 'ZNegative';
  diameter: string;
  aSize: string;
  bSize: string;
  position: [string, string, string];
  angles: [string, string, string];
  name: string;
  pointName: string;
  id: number;
}

export interface Fixture {
  name: string;
  file: string;
  code: string;
  lines: number[];
  parameters: Map<string, string>;
  evals: string[];
  connectors: ConnectorDirective[];
}

const trimmed = (s: string) => s.replace(/^[ \t\r]+|[ \t\r]+$/g, '');

function parseConnector(spec: string, id: number): ConnectorDirective {
  const f = spec.split('|');
  if (f.length < 7) throw new Error(`bad //@connector directive: ${spec}`);
  const orientations = ['XPositive', 'XNegative', 'YPositive', 'YNegative', 'ZPositive', 'ZNegative'] as const;
  const position = f[5].split(',');
  const angles = f[6].split(',');

  const triple = (parts: string[]): [string, string, string] =>
    [0, 1, 2].map((i) => (i < parts.length ? trimmed(parts[i]) : '0')) as [string, string, string];

  return {
    id,
    type: trimmed(f[0]) === 'Rectangular' ? 'Rectangular' : 'Circular',
    orientation: orientations.find((o) => o === trimmed(f[1])) ?? 'XPositive',
    diameter: trimmed(f[2]),
    aSize: trimmed(f[3]),
    bSize: trimmed(f[4]),
    position: triple(position),
    angles: triple(angles),
    name: f.length > 7 ? trimmed(f[7]) : '',
    pointName: f.length > 8 ? trimmed(f[8]) : '',
  };
}

export function parseFixture(file: string): Fixture {
  const code = fs.readFileSync(file, 'utf8');
  const lines: number[] = [];
  const parameters = new Map<string, string>();
  const evals: string[] = [];
  const connectors: ConnectorDirective[] = [];
  const textLines = code.split('\n');
  if (textLines.length && textLines[textLines.length - 1] === '') textLines.pop();
  for (const line of textLines) {
    const at = line.indexOf('//@');
    if (at < 0) continue;
    const directive = trimmed(line.slice(at + 3));
    const space = directive.indexOf(' ');
    const key = space < 0 ? directive : directive.slice(0, space);
    const rest = space < 0 ? '' : trimmed(directive.slice(space + 1));
    if (key === 'line') lines.push(parseInt(rest, 10));
    else if (key === 'param') {
      const eq = rest.indexOf('=');
      parameters.set(eq < 0 ? rest : rest.slice(0, eq), eq < 0 ? '' : rest.slice(eq + 1));
    } else if (key === 'eval') evals.push(rest);
    else if (key === 'connector') connectors.push(parseConnector(rest, connectors.length + 1));
  }
  if (!lines.length) lines.push(textLines.length);

  return {
    name: path.relative(fixturesRoot, file).split(path.sep).join('/'),
    file,
    code,
    lines,
    parameters,
    evals,
    connectors,
  };
}

export function listFixtures(...subdirs: string[]): Fixture[] {
  const roots = subdirs.length ? subdirs.map((d) => path.join(fixturesRoot, d)) : [fixturesRoot];
  const files: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.cpp')) files.push(full);
    }
  };

  roots.forEach(walk);
  const filter = process.env.FIXTURE;

  return files
    .sort()
    .map(parseFixture)
    .filter((f) => !filter || f.name.includes(filter));
}
