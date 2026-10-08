import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GeometryRuntime } from '@engine/runtime';
import { buildConnectorPreview, PreviewGeometryEngine } from '@engine/geometry';
import { FunctionWorkspace } from '@/entities/source-function';
import { prepareElementSource, evaluateLibraryExpression } from '@/features/element-library';
import { decodeLibraryAsset } from '@/features/element-library/model/sourceLibrary';
import { libraries } from '@/features/element-library/config/libraries';
import { ParameterPanelModel } from '@/features/edit-parameters';

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
