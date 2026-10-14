import { expect, it } from 'vitest';
import {
  buildConnectionGeometry,
  buildConnectorPreview,
  defaultConnectorDefinition,
  connectorOrientations,
} from '@engine/geometry';
import { FdPoint3d } from '@engine/runtime';
import {
  evaluateLibraryExpression,
  resolvePipeConnections,
  pipeConnectionParameters,
} from '@/features/element-library';
import CGeneral from '@/features/element-library/data/CGeneral';

function link(technology = 'THR_STEEL', connectionType = 'M', length = '20') {
  return {
    ...defaultConnectorDefinition(),
    id: 1,
    name: 'Port',
    diameter: '25',
    technology,
    connectionType,
    physical: { draw: true, length },
  };
}

it('uses XML Male/Female dimensions and enforces the technology representation', () => {
  const values = new Map<string, string>();

  const resolve = (tech: string, type: string) => resolvePipeConnections([link(tech, type)], values)[0];

  expect(resolve('THR_STEEL', 'M')).toMatchObject({ type: 'male', internalDiameter: 27.9, externalDiameter: 33.7 });
  expect(resolve('THR_STEEL', '14')).toMatchObject({ type: 'female', externalDiameter: 39.7 });
  expect(resolve('THR_STEEL', 'N').type).toBe('male');
  expect(resolve('FLN_STEEL', 'F')).toMatchObject({ type: 'flanged', flangeSize: 115, flangeThickness: 16 });
  expect(resolve('WLD_STEEL', 'F')).toMatchObject({
    type: 'neutral',
    flangeSize: 0,
    flangeThickness: 0,
    externalDiameter: 33.7,
  });
  expect(resolve('Plastik klejony', 'F')).toMatchObject({ type: 'female', externalDiameter: 30 });
  const parameters = pipeConnectionParameters([resolve('FLN_STEEL', 'N')]);
  expect(parameters.get('Port:get_fln_diam')).toBe('115');
  expect(parameters.get('Port:get_fln_size')).toBe('16');
  expect(parameters.get('Port:get_fln_thick')).toBe('16');
  expect(resolvePipeConnections([{ ...link(), diameter: '25.5' }], values)).toEqual([]);
});

it.each(connectorOrientations)(
  'builds behind the %s connection plane while the overlay stays in front',
  (orientation) => {
    const definition = {
      ...link(),
      orientation,
      position: ['12', '-3', '15'] as [string, string, string],
      angles: ['17', '29', '-40'] as [string, string, string],
    };
    const connections = resolvePipeConnections([definition], new Map());
    const overlay = buildConnectorPreview(definition, Number);
    const scene = buildConnectionGeometry(connections, Number);
    expect(scene.warnings).toEqual([]);
    expect(scene.meshes).toHaveLength(2);
    const depths = scene.meshes.flatMap((mesh) =>
      mesh.vertices.map((v) => new FdPoint3d(v.x, v.y, v.z).sub(overlay.point).dotProduct(overlay.direction)),
    );
    expect(Math.min(...depths)).toBeCloseTo(-20);
    expect(Math.max(...depths)).toBeCloseTo(0);
    expect(overlay.length).toBe(25 * 0.35);
    expect(scene.meshes.every((mesh) => mesh.apiIndex === -1)).toBe(true);
  },
);

it.each(['0', '40'])('builds the original flange profile for length %s and supports insulation', (length) => {
  const definition = link('FLN_STEEL', 'N', length);
  const connections = resolvePipeConnections([definition], new Map());
  const scene = buildConnectionGeometry(connections, Number);
  expect(scene.warnings).toEqual([]);
  expect(scene.meshes).toHaveLength(1);
  const vertices = scene.meshes[0].vertices;
  expect(Math.max(...vertices.map((v) => Math.hypot(v.y, v.z)))).toBeCloseTo(57.5);
  expect(Math.min(...vertices.map((v) => v.x))).toBeCloseTo(0);
  expect(Math.max(...vertices.map((v) => v.x))).toBeCloseTo(Number(length) || 16);
  const rim = vertices.filter((v) => Math.abs(v.x) < 1e-6);
  expect(Math.min(...rim.map((v) => Math.hypot(v.y, v.z)))).toBeCloseTo(length === '0' ? 29.7 / 2 : 0);
  const insulated = buildConnectionGeometry(connections, Number, 10);
  expect(insulated.warnings).toEqual([]);
  expect(insulated.meshes).toHaveLength(2);
  expect(Math.max(...insulated.meshes[1].vertices.map((v) => v.x))).toBeCloseTo(Number(length) + 26);
});

it('respects explicit runtime visibility and leaves zero-length non-flanged connections undrawn', () => {
  for (const definition of [
    { ...link('FLN_STEEL'), physical: { draw: false, length: '20' } },
    link('THR_STEEL', 'M', '0'),
  ]) {
    expect(buildConnectionGeometry(resolvePipeConnections([definition], new Map()), Number).meshes).toEqual([]);
    expect(buildConnectorPreview(definition, Number).meshes.length).toBeGreaterThan(0);
  }
});

it('keeps the selected XML size row for formula-derived adapters without rounding manual input', () => {
  const element = CGeneral.elements.find((element) => element.name === 'Copper-steel female-int.thr. adapter')!;
  const initial = element.resolve!();
  expect(initial.values.get('d2')).toBe('26.4');
  const connection = resolvePipeConnections(initial.connectors, initial.values).find(
    (c) => c.definition.name === 'TS1',
  )!;
  expect(connection.externalDiameter).toBe(39.7);
  const manual = element.resolve!(new Map(initial.values).set('d2', '26.5'), ['d2']);
  expect(manual.values.get('d2')).toBe('26.5');
  expect(manual.values.get('TS1:get_ext_diam')).toBe('0');
  expect(resolvePipeConnections(manual.connectors, manual.values).some((c) => c.definition.name === 'TS1')).toBe(false);
});

it('resolves flange sizes independently of an undefined FLENGTH expression', () => {
  const definition = link('FLN_STEEL', 'N', 'l');
  const connections = resolvePipeConnections([definition], new Map());
  expect(connections[0]).toMatchObject({ length: 0, flangeSize: 115, flangeThickness: 16 });
  expect(buildConnectionGeometry(connections, Number).meshes).toHaveLength(1);
});

it('rebuilds conditional CHIL connections across technology and size choices', () => {
  const element = CGeneral.elements.find((element) => element.name === 'Air cooled chiller')!;
  let state = element.resolve!();
  for (const tech of state.options.get('tech')!) {
    state = element.resolve!(new Map(state.values).set('tech', tech), ['tech']);
    for (const diameter of state.options.get('diam')!) {
      const resolved = element.resolve!(new Map(state.values).set('diam', diameter), ['diam']);
      const connections = resolvePipeConnections(resolved.connectors, resolved.values);
      expect(connections, `${tech}/${diameter}`).toHaveLength(resolved.connectors.length);
      expect(
        buildConnectionGeometry(connections, (expression) => evaluateLibraryExpression(expression, resolved.values))
          .warnings,
      ).toEqual([]);
    }
  }
});
