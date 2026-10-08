import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { buildConnectorPreview, PreviewGeometryEngine } from '@engine/geometry';
import { FunctionWorkspace } from '@/entities/source-function';
import { prepareElementSource, evaluateLibraryExpression } from '@/features/element-library';
import { decodeLibraryAsset } from '@/features/element-library/model/sourceLibrary';
import { libraries } from '@/features/element-library/config/libraries';
import { ParameterPanelModel } from '@/features/edit-parameters';
import { dot, DVec3, length } from '@engine/math';

it.each([
  [45, 0],
  [75, 0],
  [90, 0],
  [105, 0],
  [45, 20],
  [75, 20],
])('aligns makeRTTHR branch, cap and center line (alfa=%s, insulation=%s)', (alfa, insulation) => {
  const sources = ['h', 'cpp'].map((extension) => ({
    name: `CGeneral.${extension}`,
    code: decodeLibraryAsset(readFileSync(`public/demo/code/CGeneral/CGeneral.${extension}`)),
  }));
  const workspace = new FunctionWorkspace();
  workspace.replaceFiles(prepareElementSource(sources, 'makeRTTHR'));
  const program = workspace.program();
  const runtime = new GeometryRuntime();
  const parameters = new Map([['alfa', String(alfa)]]);
  if (insulation) parameters.set('getExtInsSize', String(insulation));
  runtime.setParameters(parameters);
  const result = runtime.executeUpToLine(program.source, 100000, true, program.options);
  expect(result.diagnostics).toEqual([]);
  const scene = new PreviewGeometryEngine().build(result);
  expect(scene.warnings).toEqual([]);

  const angle = (alfa * Math.PI) / 180;
  const axis = new DVec3(Math.cos(angle), Math.sin(angle), 0);
  const end = axis.mul(100);
  const branches = scene.meshes.filter((mesh) => mesh.apiName === 'makeTubeToTubeIntersection2.branch');
  const caps = scene.meshes.filter((mesh) => mesh.apiName === 'makeUniVectorTube');
  expect(branches).toHaveLength(insulation ? 3 : 2);
  expect(caps).toHaveLength(insulation ? 6 : 3);
  for (const [i, branch] of branches.entries()) {
    const cap = caps[i < 2 ? 2 : 5].vertices.map((v) => new DVec3(v.x, v.y, v.z));
    expect(cap.every((p) => Math.abs(dot(p.sub(end), axis)) < 0.0001)).toBe(true);
    const rim = branch.vertices
      .map((v) => new DVec3(v.x, v.y, v.z))
      .filter((p) => Math.abs(dot(p.sub(end), axis)) < 0.0001);
    expect(rim.length).toBeGreaterThanOrEqual(40);
    for (const point of rim) expect(Math.min(...cap.map((p) => length(p.sub(point))))).toBeLessThan(0.0001);
  }
  const centerLines = scene.meshes.filter((mesh) => mesh.apiName === 'addCenterLine');
  expect(centerLines).toHaveLength(2);
  const branchLine = centerLines[1].vertices.map((v) => new DVec3(v.x, v.y, v.z));
  expect(branchLine.every((p) => length(p.sub(axis.mul(dot(p, axis)))) < 0.0001)).toBe(true);
  expect(length(branchLine[0])).toBeLessThan(0.0001);
  expect(length(branchLine.at(-1)!.sub(end))).toBeLessThan(0.0001);
});

it.each([
  ['CGeneral', 'CGeneral'],
  ['GRUNDFOS', 'GRUNDFOS'],
  ['BELIMO', 'CBELIMO'],
])(
  'audits %s defaults, runtime execution and connectors',
  async (name, stem) => {
    const library = await libraries.find((library) => library.name === name)!.load();
    const sources = ['h', 'cpp'].map((extension) => ({
      name: `${stem}.${extension}`,
      code: decodeLibraryAsset(readFileSync(`public/demo/code/${name}/${stem}.${extension}`)),
    }));
    const programs = new Map<string, ReturnType<FunctionWorkspace['program']>>();
    for (const element of library.elements) {
      if (element.error) continue;
      for (const variant of element.variants) {
        expect(
          Object.values({ ...element.defaults, ...variant.defaults }).some((value) =>
            /^(NaN|[+-]?Infinity)$/.test(value),
          ),
          element.id,
        ).toBe(false);
      }
      let program = programs.get(element.entry);
      if (!program) {
        const workspace = new FunctionWorkspace();
        workspace.replaceFiles(prepareElementSource(sources, element.entry));
        program = workspace.program();
        programs.set(element.entry, program);
      }
      const variant = element.variants[0];
      const values = new Map(Object.entries({ ...element.defaults, ...variant.selection, ...variant.defaults }));
      const runtime = new GeometryRuntime();
      const panel = new ParameterPanelModel();
      const definitions = runtime.discoverParameters(program.source, program.options);
      panel.loadValues(definitions, values);
      panel.setDefinitions(definitions);
      expect(Object.fromEntries(panel.overrides()), element.id).toMatchObject(Object.fromEntries(values));
      runtime.setParameters(panel.overrides());
      const result = runtime.executeUpToLine(program.source, 100000, true, program.options);
      expect(result.diagnostics, element.id).toEqual([]);
      const scene = new PreviewGeometryEngine().build(result);
      expect(scene.warnings, element.id).toEqual([]);
      // This XML record supplies ft, but makeFPA reads L. Keep L as a manual
      // parameter; do not invent a length or claim this incomplete sample is ready.
      if (element.id === 'D5DF65BB-6890-4C51-A0F8-E1997AFF0D1B') {
        expect(values.has('L')).toBe(false);
        expect(panel.rows.some((row) => row.texts[0] === 'L')).toBe(true);
      } else expect(scene.meshes.length, element.id).toBeGreaterThan(0);
      panel.updateRuntimeResult(result);
      const context = new Map([...values, ...panel.contextValues()]);
      for (const connector of variant.connectors ?? element.connectors) {
        expect(
          () => buildConnectorPreview(connector, (expression) => evaluateLibraryExpression(expression, context)),
          element.id,
        ).not.toThrow();
      }
    }
  },
  60000,
);
