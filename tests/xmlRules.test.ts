import { expect, it } from 'vitest';
import { libraries } from '@/features/element-library/config/libraries';
import { readFileSync } from 'node:fs';
import { decodeLibraryAsset, prepareElementSource } from '@/features/element-library/model/sourceLibrary';
import { FunctionWorkspace } from '@/entities/source-function';
import { GeometryRuntime } from '@engine/runtime';
import { PreviewGeometryEngine, buildConnectorPreview, buildConnectionGeometry } from '@engine/geometry';
import { resolvePipeConnections } from '@/features/element-library/model/pipeTechnologies';
import { evaluateLibraryExpression } from '@/features/element-library/model/expressions';
import { ParameterPanelModel } from '@/features/edit-parameters';

it.each(libraries)(
  'resolves $name current rows, geometry and conditional connectors without variants',
  async (asset) => {
    const library = await asset.load();
    const sources = asset.sources.map((source) => ({
      name: source.name,
      code: decodeLibraryAsset(readFileSync(`public/${source.path}`)),
    }));
    const failures: string[] = [];
    const programs = new Map<string, ReturnType<FunctionWorkspace['program']>>();
    for (const element of library.elements) {
      if (element.error) continue;
      const resolved = element.resolve!();
      expect(resolved.snapshot).toBeDefined();
      if (resolved.snapshot.status !== 'valid') {
        expect(resolved.errors?.length, element.id).toBeGreaterThan(0);
        continue;
      }
      let program = programs.get(element.entry);
      if (!program) {
        const workspace = new FunctionWorkspace();
        workspace.replaceFiles(prepareElementSource(sources, element.entry));
        program = workspace.program();
        programs.set(element.entry, program);
      }
      const runtime = new GeometryRuntime();
      const panel = new ParameterPanelModel();
      panel.loadValues(
        runtime.discoverParameters(program.source, program.options),
        resolved.values,
        resolved.values,
        element.selectors.map((selector) => selector.name),
      );
      for (const selector of element.selectors)
        expect(
          panel.rows.some((row) => row.texts[0] === selector.name),
          `${element.id}/${selector.name}`,
        ).toBe(true);
      runtime.setParameters(panel.overrides());
      const result = runtime.executeUpToLine(program.source, 100000, true, program.options);
      const scene = new PreviewGeometryEngine().build(result);
      if (result.diagnostics.length || scene.warnings.length)
        failures.push(
          `${element.id} ${element.entry}: ${JSON.stringify([result.diagnostics, scene.warnings, Object.fromEntries(resolved.values)])}`,
        );
      panel.updateRuntimeResult(result);
      const context = new Map([...resolved.values, ...panel.contextValues()]);
      const connections = resolvePipeConnections(resolved.connectors, context);
      const drawable = resolved.connectors.filter((link) => {
        if (!link.physical || !link.technology || link.physical.draw === false) return false;
        if (link.technology === 'FLN_STEEL') return true;
        try {
          return evaluateLibraryExpression(link.physical.length, context) > 0;
        } catch {
          return false;
        }
      });
      for (const definition of drawable)
        if (!connections.some((connection) => connection.definition === definition))
          failures.push(`${element.symbol}/${definition.name}: unresolved physical connection`);
      const physical = buildConnectionGeometry(connections, (expression) =>
        evaluateLibraryExpression(expression, context),
      );
      failures.push(...physical.warnings.map((warning) => `${element.symbol}: ${warning}`));
      for (const link of resolved.connectors) {
        if (link.connectionType?.startsWith('%') || link.technology?.startsWith('%'))
          failures.push(`${element.id} unresolved ${link.connectionType} / ${link.technology}`);
        try {
          buildConnectorPreview(link, (expression) => evaluateLibraryExpression(expression, context));
        } catch (error) {
          failures.push(`${element.id} ${link.name}: ${error}`);
        }
      }
    }
    expect(failures).toEqual([]);
  },
  60000,
);

