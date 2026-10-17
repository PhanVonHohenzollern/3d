import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import type { ConnectorPreview } from '@engine/geometry';
import { parseObj } from '@engine/formats/obj';
import { createWorkspace } from '@tests/pages/workspace/harness';
import { createViewport3DHandle } from '@/widgets/viewport/model/viewportHandle';
import { click, createEngine } from '@tests/renderer/helpers';

function mockLibraryFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const body = readFileSync('public/' + String(input).replace(/^\//, ''));

    return {
      ok: true,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    } as Response;
  });
}

// Internal selectors/dimensions are no longer editable rows. Exercise their
// programmatic updates here so case switching and connector synchronization
// remain covered without exposing XML-hidden inputs in the UI.
function setHiddenLibraryInput(mw: ReturnType<typeof createWorkspace>['mw'], name: string, value: string) {
  const { parameters } = mw;
  const element = mw.library.element!;
  expect(element.hiddenParameters, name).toContain(name);
  expect(
    parameters.rows.some((row) => row.texts[0] === name),
    name,
  ).toBe(false);
  const saved = parameters.savedValues();
  saved.set(name, value);
  saved.set(`${element.entry}::${name}`, value);
  parameters.loadValues(
    mw.session.discoverParameters(mw.functions.program(), () => false),
    mw.library.resolution.values,
    saved,
    element.selectors.map((s) => s.name),
    new Set(element.hiddenParameters!.flatMap((n) => [n, `${element.entry}::${n}`])),
  );
  mw.onParametersChanged();
}

it('loads FLM elements with visible connectors and no automatic mesh or Link selection', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, links } = createWorkspace();
  const engine = createEngine();
  mw.bindViewport(createViewport3DHandle(engine));
  engine.setSelectionClearedCallback(mw.exitPreviewFocus);
  const connectors = vi.spyOn(engine, 'setConnectorPreviews');
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    for (const entry of ['makeTFMT', 'makeCRWLD']) {
      mw.library.openElement(mw.library.elements.find((element) => element.entry === entry)!.id);
      expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
      expect(engine.hasApiFocus()).toBe(false);
      expect(mw.apiTrace.selectedApiCall()).toBe(-1);
      expect(mw.session.scene.meshes.every((_, index) => !engine.isMeshSelected(index))).toBe(true);
      expect(links.currentRow).toBe(-1);
      const [previews, selectedId] = connectors.mock.calls.at(-1)!;
      expect(previews.length).toBeGreaterThan(0);
      expect(selectedId).toBe(-1);
      links.selectConnector(previews[0].id);
      expect(connectors.mock.calls.at(-1)![1]).toBe(previews[0].id);
      click(engine, 790, 590);
      expect(connectors.mock.calls.at(-1)![1]).toBe(-1);
      expect(connectors.mock.calls.at(-1)![0]).toHaveLength(previews.length);
      // Loading the next element must also clear a previous explicit Link selection.
      links.selectConnector(previews[0].id);
    }
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('adds TFMT connection geometry from a valid snapshot and blocks conflicting TFMN data', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  let previews: readonly ConnectorPreview[] = [];
  links.previewChanged.connect((value) => (previews = value));
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement(mw.library.elements.find((element) => element.entry === 'makeTFMT')!.id);
    const source = editor.text;

    const checkConnection = (bodyEnd: number, point: number, bodyCount: number) => {
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      const body = mw.session.scene.meshes.filter(
        (mesh) => mesh.primitive !== 'lines' && !mesh.apiName.startsWith('connection:'),
      );
      expect(body).toHaveLength(bodyCount);
      expect(body.every((mesh) => mesh.apiName === 'makeScrew2')).toBe(true);
      expect(Math.max(...body.flatMap((mesh) => mesh.vertices.map((p) => p.x)))).toBeCloseTo(bodyEnd);
      const connection = mw.session.scene.meshes.filter((mesh) => mesh.apiName.startsWith('connection:TS2:'));
      if (bodyEnd < point) {
        expect(connection).toHaveLength(2);
        const xs = connection.flatMap((mesh) => mesh.vertices.map((vertex) => vertex.x));
        expect(Math.min(...xs)).toBeCloseTo(bodyEnd);
        expect(Math.max(...xs)).toBeCloseTo(point);
      } else expect(connection).toEqual([]);
      const right = previews.find((preview) => preview.id === 2)!;
      expect(right.point).toMatchObject({ x: point, y: 0, z: 0 });
      expect(right.direction).toMatchObject({ x: 1, y: 0, z: 0 });
      expect(right.length).toBeCloseTo(25 * 0.35);
      const overlayX = right.meshes.flatMap((mesh) => mesh.vertices.map((p) => p.x));
      expect(Math.min(...overlayX)).toBeCloseTo(point);
      expect(Math.max(...overlayX)).toBeCloseTo(point + 25 * 0.35);
      expect(links.statusIsError).toBe(false);
    };

    expect(links.definitions()[1]).toMatchObject({ connectionType: '13' });
    checkConnection(0, 20, 1);
    const completeScene = mw.session.scene;
    for (const link of links.definitions()) links.togglePreview(link.id);
    expect(previews).toEqual([]);
    expect(mw.session.scene).toBe(completeScene);
    const exported = parseObj(mw.exportObj());
    expect(Math.max(...exported.meshes.flatMap((mesh) => mesh.vertices.map((v) => v.x)))).toBeCloseTo(20);
    links.togglePreview(2);
    const blocked = mw.library.elements.find((element) => element.name === 'Threaded female-male nipple')!;
    expect(blocked.resolve().snapshot.status).toBe('conflict');
    mw.library.openElement(blocked.id);
    expect(mw.library.canOpen).toBe(false);
    expect(mw.session.scene).toBe(completeScene);
    expect(editor.text).toBe(source);
    links.selectConnector(2);
    links.positionEdited(0, '70');
    const xs = mw.session.scene.meshes
      .filter((mesh) => mesh.apiName.startsWith('connection:TS2:'))
      .flatMap((mesh) => mesh.vertices.map((vertex) => vertex.x));
    expect(Math.min(...xs)).toBeCloseTo(50);
    expect(Math.max(...xs)).toBeCloseTo(70);
    links.removeConnector();
    expect(mw.session.scene.meshes.some((mesh) => mesh.apiName.startsWith('connection:TS2:'))).toBe(false);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('builds the missing CSV inlet flange and hides internal connector queries in Parameters', async () => {
  const fetchMock = mockLibraryFetch();
  const { mw, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement(mw.library.elements.find((element) => element.name === 'Collar safety-valve')!.id);
    expect(
      parameters.rows.some((row) => row.texts[0].includes('get_ext_diam') || row.texts[0].includes('get_fln')),
    ).toBe(false);
    expect(parameters.rows.filter((row) => row.texts[0].startsWith('diam')).map((row) => row.texts[0])).toEqual([
      'diam1',
    ]);
    expect(mw.inspectorCounts.ParametersDock).toBe(parameters.rows.length);
    expect(parameters.contextValues().get('diam1')).toBe('25');
    expect(parameters.contextValues().get('diam2')).toBe('30');
    const flange = mw.session.scene.meshes.filter((mesh) => mesh.apiName.startsWith('connection:L1:'));
    expect(mw.session.scene.warnings).toEqual([]);
    expect(flange).toHaveLength(1);
    const vertices = flange[0].vertices;
    expect(Math.min(...vertices.map((p) => p.y))).toBeCloseTo(-60);
    expect(Math.max(...vertices.map((p) => p.y))).toBeCloseTo(-35);
    expect(Math.max(...vertices.map((p) => Math.hypot(p.x, p.z)))).toBeCloseTo(57.5);
    links.togglePreview(1);
    expect(mw.session.scene.meshes).toContain(flange[0]);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
  }
});

it('updates CRWLD Parameters, runtime inputs and Links together after each edit', async () => {
  const fetchMock = mockLibraryFetch();
  const { mw, parameters, links } = createWorkspace();
  let previews: readonly ConnectorPreview[] = [];
  links.previewChanged.connect((value) => (previews = value));
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement('5E09516F-C262-4449-B978-D574A94C5A1A');

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
      const values = parameters.contextValues();
      for (const name of ['l1', 'l2', 'l3', 'l4', 'l5', 'd1ext', 'd2ext', 'd3ext', 'd4ext']) {
        const row = parameters.rows.find((row) => row.texts[0] === name);
        if (name.endsWith('ext')) expect(row, name).toBeUndefined();
        else expect(row?.texts[3], name).toBe(values.get(name));
        expect(
          Number(mw.session.lastResult.parameterRequests.find((request) => request.name === name)?.currentValue),
          name,
        ).toBeCloseTo(Number(values.get(name)));
        expect(mw.library.resolution.values.get(name), name).toBe(values.get(name));
      }
      expect(previews[0].point.x).toBeCloseTo(-Number(values.get('l1')));
      expect(previews[1].point.x).toBeCloseTo(Number(values.get('l2')));
      expect(previews[2].point.y).toBeCloseTo(Number(values.get('l3')));
      expect(previews[3].point.y).toBeCloseTo(-Number(values.get('l4')));
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);

      return values;
    };

    edit('d1', '40');
    edit('d2', '40');
    edit('d3', '32');
    const values = edit('d4', '25');
    expect(Object.fromEntries(values)).toMatchObject({
      d1: '25', d2: '25', d3: '25', d4: '25',
      d1ext: '33.7', d2ext: '33.7', d3ext: '33.7', d4ext: '33.7',
    });
    edit('l2', '200');
    edit('l5', '25');
    const bounded = edit('l2', '60');
    expect(Number(bounded.get('l5'))).toBeCloseTo(60 - Math.max(3 * Number(bounded.get('d3ext')) / 4, 3 * Number(bounded.get('d4ext')) / 2));
    edit('l3', '55.5');
    expect(parameters.contextValues().get('l3')).toBe('55.5');
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
  }
});

it('removes unchecked CRWLD insulation and retains its thickness through library parameter changes', async () => {
  const fetchMock = mockLibraryFetch();
  const { mw, parameters } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement('5E09516F-C262-4449-B978-D574A94C5A1A');

    const insulation = () =>
      mw.session.scene.meshes.filter((mesh) => mesh.color.r === Math.fround(139 / 255) && mesh.color.g === 0);

    const size = () => parameters.rows.find((row) => row.texts[0] === 'size')!;

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    expect(parameters.rows.some((row) => /^d[1-4](ext|int)$/.test(row.texts[0]))).toBe(false);
    expect(insulation()).toHaveLength(0);
    parameters.setInsulationEnabled('getExtInsSize', true);
    edit('size', '25');
    expect(insulation().length).toBeGreaterThan(0);
    edit('d1', '40');
    expect(parameters.isInsulationEnabled('getExtInsSize')).toBe(true);
    expect(size().texts[3]).toBe('25');
    parameters.setInsulationEnabled('getExtInsSize', false);
    expect(insulation()).toHaveLength(0);
    expect(size().texts[3]).toBe('25');
    edit('d3', '32');
    expect(insulation()).toHaveLength(0);
    expect(parameters.overrides().has('getExtInsSize')).toBe(false);
    expect(size().texts[3]).toBe('25');
    parameters.setInsulationEnabled('getExtInsSize', true);
    expect(insulation().length).toBeGreaterThan(0);
    expect(mw.session.runtime.evaluateNumericExpression('size')).toBe(25);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    parameters.resetToSource();
    expect(insulation()).toHaveLength(0);
    expect(parameters.isInsulationEnabled('getExtInsSize')).toBe(false);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
  }
});

it('updates dependent XML sizes and keeps source edits until Reset', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    const element = mw.library.elements.find(
      (element) => element.entry === 'make2WayValve' && element.defaults.elType === '7',
    )!;
    mw.library.openElement(element.id);
    expect(editor.text).not.toMatch(/#define (vx|vy|vz|SEGNUM|RCFlange)|const int (cpx|concpx)/);
    expect(parameters.dataSets).toEqual([]);
    expect(parameters.tabs.some((tab) => tab.label === 'Element')).toBe(false);
    expect(mw.session.lastResult.diagnostics).toEqual([]);

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3)).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    const originalScene = mw.session.scene;
    editor.type(editor.text + '\n// Keep this edit when choosing a size.', 1);
    const code = editor.text;
    edit('diam', '65');
    expect(parameters.contextValues().get('l')).toBe('180');
    expect(parameters.contextValues().get('L1:get_fln_thick')).toBe('20');
    expect(mw.library.resolution.values.get('diam')).toBe('65');
    expect(mw.session.scene).not.toBe(originalScene);
    expect(editor.text).toBe(code);
    setHiddenLibraryInput(mw, 'elType', '0');
    expect(mw.library.element?.defaults.elType).toBe('0');
    expect(parameters.contextValues().get('diam')).toBe('65');
    expect(links.definitions().every((link) => link.technology === 'THR_STEEL' && link.connectionType === 'F')).toBe(
      true,
    );
    expect(parameters.contextValues().get('L1:get_fln_thick')).toBe('0');
    expect(parameters.contextValues().get('L1:get_fln_diam')).toBe('0');
    expect(links.statusIsError).toBe(false);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.warnings).toEqual([]);
    expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
    expect(editor.text).toBe(code);
    parameters.resetToSource();
    expect(mw.library.elementId).toBe(element.id);
    expect(parameters.contextValues().get('diam')).toBe('25');
    expect(parameters.contextValues().get('elType')).toBe('7');
    expect(parameters.dataSets).toEqual([]);

    const simple = mw.library.elements.find((element) => element.entry === 'makeFMRTHR')!;
    mw.library.openElement(simple.id);
    expect(mw.functions.fileNames).toEqual([]);
    expect(parameters.tabs.map((tab) => tab.label)).toEqual(['makeFMRTHR']);
    expect(parameters.rows.some((row) => row.texts[0] === 'tech')).toBe(false);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('updates CHIL helper selectors and keeps the selected element across shared cases', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    const water = mw.library.elements.find((element) => element.name === 'Water cooled chiller')!;
    mw.library.openElement(water.id);
    const source = editor.text;

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    const nextA = water.resolve().options.get('A')!.find((value) => value !== water.resolve().values.get('A'))!;
    edit('A', nextA);
    links.positionEdited(0, '123');
    const edited = links.definitions();
    for (const ftype of ['1', '2', '0']) {
      setHiddenLibraryInput(mw, 'ftype', ftype);
      expect(mw.library.elementId).toBe(water.id);
      expect(links.definitions()).toHaveLength(4);
      expect(parameters.contextValues().get('ftype')).toBe(ftype);
    }
    expect(parameters.contextValues().get('A')).toBe(nextA);
    expect(links.definitions()).toEqual(edited);
    setHiddenLibraryInput(mw, 'elType', '0');
    expect(links.definitions()).toHaveLength(2);
    setHiddenLibraryInput(mw, 'elType', '1');
    expect(mw.library.elementId).toBe(water.id);
    expect(links.definitions()).toEqual(edited);
    setHiddenLibraryInput(mw, 'elType', '2');
    expect(mw.library.element?.name).toBe('Floor standing fancoil');
    setHiddenLibraryInput(mw, 'elType', '1');
    expect(mw.library.elementId).toBe(water.id);
    expect(links.definitions()).toEqual(edited);
    expect(editor.text).toBe(source);

    const floor = mw.library.elements.find((element) => element.name === 'Floor standing fancoil')!;
    mw.library.openElement(floor.id);
    for (const [ftype, names] of [
      ['1', ['C2', 'H2']],
      ['2', ['C3', 'H3']],
      ['0', ['C1', 'H1']],
    ] as const) {
      setHiddenLibraryInput(mw, 'ftype', ftype);
      expect(mw.library.elementId).toBe(floor.id);
      expect(links.definitions().map((link) => link.name)).toEqual(names);
    }
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'system_label')?.values).toContain('4-pipe');
    expect(parameters.valueOptions('system_label')).toContain('4-pipe');
    edit('system_label', '4-pipe');
    expect(links.definitions().map((link) => link.name)).toEqual(['C4', 'H4', 'C5', 'H5']);
    expect(parameters.contextValues().get('ftype')).toBe('2');
    edit('system_label', '2-pipe');
    expect(links.definitions().map((link) => link.name)).toEqual(['C3', 'H3']);
    expect(links.statusIsError).toBe(false);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('matches CHIL diameter and connection technology together without changing the source', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement(mw.library.elements.find((element) => element.name === 'Air cooled chiller')!.id);
    const source = editor.text;

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    for (const selector of mw.library.element!.selectors)
      expect(
        parameters.rows.some((row) => row.texts[0] === selector.name),
        selector.name,
      ).toBe(true);
    edit('diam', '25');
    edit('__conn', 'int. thread');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'F', technology: 'THR_STEEL', diameter: 'diam' });
    edit('tech', 'welded steel');
    expect(parameters.contextValues().get('diam')).toBe('25');
    expect(parameters.contextValues().get('__conn')).toBe('');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'N', technology: 'WLD_STEEL' });
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'diam')?.values).toContain('500');
    edit('tech', 'copper');
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'diam')?.values).not.toContain('500');
    edit('diam', '15');
    edit('__conn', 'female');
    expect(parameters.contextValues().get('diam')).toBe('15');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'F', technology: 'COPPER' });
    expect(links.tableRows[0].texts[3]).toBe('(327.5, -165, -137.5)');
    const committedScene = mw.session.scene;
    edit('diam', '16.5');
    expect(parameters.contextValues().get('diam')).toBe('15');
    expect(parameters.rows.find((row) => row.texts[0] === 'diam')?.texts[3]).toBe('15');
    expect(mw.session.scene).toBe(committedScene);
    expect(links.statusIsError).toBe(false);
    expect(editor.text).toBe(source);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it.each(['make2WayValve', 'makeSV', 'makeMF', 'makeTANK'])(
  'switches XML defaults and connectors for every %s case and restores edits',
  async (entry) => {
    vi.useFakeTimers();
    const fetchMock = mockLibraryFetch();
    const { mw, editor, parameters, links } = createWorkspace();
    try {
      mw.start();
      await mw.library.selectLibrary('CGeneral');
      const family = mw.library.elements.filter((element) => element.entry === entry && !element.error);
      const cases = [...new Map(family.map((element) => [element.defaults.elType, element])).values()];
      const first = cases[0];
      mw.library.openElement(first.id);
      const originalCode = editor.text;

      const edit = (name: string, value: string) => {
        const row = parameters.rows.findIndex((row) => row.texts[0] === name);
        expect(parameters.edit(row, 3), name).toBe(true);
        parameters.editorTextEdited(value);
        parameters.commitEditor();
      };

      const initialValues = parameters.contextValues();
      const dimension = ['L', 'H', 'l'].find((name) => initialValues.has(name))!;
      if (first.hiddenParameters?.includes(dimension)) setHiddenLibraryInput(mw, dimension, '777');
      else edit(dimension, '777');
      const acceptedDimension = parameters.contextValues().get(dimension);
      links.positionEdited(0, '17');
      const editedConnectors = links.definitions();
      for (const element of cases.slice(1)) {
        setHiddenLibraryInput(mw, 'elType', element.defaults.elType);
        expect(mw.library.elementId, element.name).toBe(element.id);
        const expected = element.resolve(parameters.contextValues(), []);
        expect(expected.snapshot.status, element.name).toBe('valid');
        expect(Object.fromEntries(parameters.contextValues())).toMatchObject(Object.fromEntries(expected.values));
        expect(links.definitions()).toEqual(expected.connectors);
        expect(mw.session.lastResult.diagnostics, element.name).toEqual([]);
        expect(mw.session.scene.warnings, element.name).toEqual([]);
        expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
        expect(links.statusIsError).toBe(false);
        expect(editor.text).toBe(originalCode);
      }
      setHiddenLibraryInput(mw, 'elType', first.defaults.elType);
      expect(parameters.contextValues().get(dimension)).toBe(acceptedDimension);
      expect(links.definitions()).toEqual(editedConnectors);
      parameters.resetToSource();
      expect(parameters.contextValues().get(dimension)).toBe(initialValues.get(dimension));
      expect(links.definitions()).toEqual(first.resolve!().connectors);
    } finally {
      mw.dispose();
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  },
);

it('loads connector defaults when changing MIXIT connection type and port orientation', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('GRUNDFOS');
    const element = mw.library.elements.find((element) => element.entry === 'makeMIXIT')!;
    mw.library.openElement(element.id);
    const source = editor.text;

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    const initial = parameters.contextValues();
    for (const [connection, side] of [
      ['Flanged', 'Right'],
      ['Threaded', 'Left'],
    ]) {
      edit('ConnType', connection);
      edit('bport', side);
      const current = parameters.contextValues();
      const expected = element.resolve(current, ['ConnType', 'bport', 'dn']);
      expect(expected.snapshot.status).toBe('valid');
      expect(current.get('ConnType')).toBe(connection);
      expect(current.get('bport')).toBe(side);
      expect(Object.fromEntries(current)).toMatchObject(Object.fromEntries(expected.values));
      expect(links.definitions()).toEqual(expected.connectors);
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      expect(links.statusIsError).toBe(false);
      expect(editor.text).toBe(source);
    }
    expect(parameters.contextValues().get('L1')).toBe(initial.get('L1'));
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('rejects an internal selector outside its constraints and preserves the committed state', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    const element = mw.library.elements.find((element) => element.entry === 'makeSV')!;
    mw.library.openElement(element.id);
    const values = parameters.contextValues();
    const connectors = links.definitions();
    const showMessage = vi.spyOn(mw.statusBar(), 'showMessage');
    setHiddenLibraryInput(mw, 'elType', '999');
    expect(parameters.contextValues()).toEqual(values);
    expect(links.definitions()).toEqual(connectors);
    expect(showMessage.mock.calls.some(([, , kind]) => kind === 'warning' || kind === 'error')).toBe(true);
    parameters.resetToSource();
    expect(parameters.contextValues()).toEqual(values);
    expect(links.definitions()).toEqual(element.resolve!().connectors);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('loads all nested TANK shapes with their own connector count and dimensions', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, parameters, links } = createWorkspace();
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    const tanks = mw.library.elements.filter(
      (element) => element.entry === 'makeTANK' && element.defaults.elType === '1',
    );
    mw.library.openElement(tanks[0].id);
    for (const element of [...tanks.slice(1), tanks[0]]) {
      setHiddenLibraryInput(mw, 'elType3d', element.defaults.elType3d);
      expect(parameters.contextValues().get('elType')).toBe('1');
      expect(Object.fromEntries(parameters.contextValues())).toMatchObject(element.defaults);
      expect(links.definitions()).toEqual(element.resolve!().connectors);
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      expect(mw.session.scene.meshes.filter((mesh) => mesh.apiName === 'makeSpheroidSection')).toHaveLength(2);
      expect(links.statusIsError).toBe(false);
    }
    for (const value of ['0', '1']) {
      setHiddenLibraryInput(mw, 'elType', value);
    }
    expect(parameters.contextValues().get('elType3d')).toBe(tanks[0].defaults.elType3d);
    expect(links.definitions()).toEqual(tanks[0].resolve!().connectors);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});
