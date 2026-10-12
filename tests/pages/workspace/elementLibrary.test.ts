import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import type { ConnectorPreview } from '@engine/geometry';
import { parseObj } from '@engine/formats/obj';
import { createWorkspace } from '@tests/pages/workspace/harness';

function mockLibraryFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const body = readFileSync('public/' + String(input).replace(/^\//, ''));

    return {
      ok: true,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    } as Response;
  });
}

it('keeps TFMN/TFMT source geometry separate from connector previews across parameter and case changes', async () => {
  vi.useFakeTimers();
  const fetchMock = mockLibraryFetch();
  const { mw, editor, parameters, links } = createWorkspace();
  let previews: readonly ConnectorPreview[] = [];
  links.previewChanged.connect((value) => (previews = value));
  try {
    mw.start();
    await mw.library.selectLibrary('CGeneral');
    mw.library.openElement(mw.library.elements.find((element) => element.name === 'Threaded female-male nipple')!.id);
    const source = editor.text;

    const edit = (name: string, value: string) => {
      const row = parameters.rows.findIndex((row) => row.texts[0] === name);
      expect(parameters.edit(row, 3), name).toBe(true);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    };

    const checkConnection = (bodyEnd: number, point: number, bodyCount: number) => {
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      const body = mw.session.scene.meshes.filter((mesh) => mesh.primitive !== 'lines');
      expect(body).toHaveLength(bodyCount);
      expect(body.every((mesh) => mesh.apiName === 'makeScrew2')).toBe(true);
      expect(Math.max(...body.flatMap((mesh) => mesh.vertices.map((p) => p.x)))).toBeCloseTo(bodyEnd);
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
    checkConnection(12.5, 32.5, 2);
    const completeScene = mw.session.scene;
    for (const link of links.definitions()) links.togglePreview(link.id);
    expect(previews).toEqual([]);
    expect(mw.session.scene).toBe(completeScene);
    const exported = parseObj(mw.exportObj());
    const exportedPart = exported.meshes
      .filter((mesh) => mesh.primitive !== 'lines')
      .flatMap((mesh) => mesh.vertices)
      .filter((vertex) => vertex.x > 12.5 + 1e-6);
    expect(exportedPart).toEqual([]);
    links.togglePreview(2);
    edit('L', '85');
    edit('C', '30');
    edit('C1', '10');
    mw.applyParameters();
    checkConnection(-2.5, 42.5, 2);

    edit('elType3d', '1');
    mw.applyParameters();
    expect(mw.library.element?.name).toBe('Threaded male-male nipple');
    expect(links.definitions().map((link) => link.connectionType)).toEqual(['14', '14']);
    checkConnection(32.5, 32.5, 3);
    expect(previews).toHaveLength(2);
    expect(previews[1].length).toBeCloseTo(25 * 0.35);
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(links.statusIsError).toBe(false);

    edit('elType3d', '0');
    mw.applyParameters();
    checkConnection(-2.5, 42.5, 2);
    expect(editor.text).toBe(source);
    parameters.resetToSource();
    mw.applyParameters();
    checkConnection(12.5, 32.5, 2);

    mw.library.openElement(mw.library.elements.find((element) => element.entry === 'makeTFMT')!.id);
    expect(links.definitions()[1]).toMatchObject({ connectionType: '13' });
    checkConnection(0, 20, 1);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});

it('opens one default set and keeps manual edits independent until Reset', async () => {
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
    const defaults = parameters.contextValues();
    const connectors = links.definitions();
    editor.type(editor.text + '\n// Keep this edit when choosing a size.', 1);
    const code = editor.text;
    edit('diam', '65');
    expect(parameters.contextValues().get('l')).toBe(defaults.get('l'));
    expect(parameters.contextValues().get('L1:get_fln_thick')).toBe(defaults.get('L1:get_fln_thick'));
    expect(mw.library.resolution.values.get('diam')).toBe('25');
    expect(mw.session.scene).toBe(originalScene);
    expect(editor.text).toBe(code);
    edit('elType', '0');
    expect(mw.library.element?.defaults.elType).toBe('0');
    expect(parameters.contextValues().get('diam')).toBe('65');
    expect(links.definitions()).toEqual(connectors);
    expect(links.statusIsError).toBe(false);
    mw.applyParameters();
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

    edit('A', '900');
    links.positionEdited(0, '123');
    const edited = links.definitions();
    for (const ftype of ['1', '2', '0']) {
      edit('ftype', ftype);
      expect(mw.library.elementId).toBe(water.id);
      expect(links.definitions()).toHaveLength(4);
      expect(parameters.contextValues().get('ftype')).toBe(ftype);
    }
    expect(parameters.contextValues().get('A')).toBe('900');
    expect(links.definitions()).toEqual(edited);
    edit('elType', '0');
    expect(links.definitions()).toHaveLength(2);
    edit('elType', '1');
    expect(mw.library.elementId).toBe(water.id);
    expect(links.definitions()).toEqual(edited);
    edit('elType', '2');
    expect(mw.library.element?.name).toBe('Floor standing fancoil');
    edit('elType', '1');
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
      edit('ftype', ftype);
      expect(mw.library.elementId).toBe(floor.id);
      expect(links.definitions().map((link) => link.name)).toEqual(names);
    }
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'system_label')?.values).toContain('4-pipe');
    mw.library.selectValue('system_label', '4-pipe');
    expect(links.definitions().map((link) => link.name)).toEqual(['C4', 'H4', 'C5', 'H5']);
    expect(parameters.contextValues().get('ftype')).toBe('2');
    mw.library.selectValue('system_label', '2-pipe');
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
    mw.library.selectValue('diam', '25');
    mw.library.selectValue('__conn', 'int. thread');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'F', technology: 'THR_STEEL', diameter: 'diam' });
    mw.library.selectValue('tech', 'welded steel');
    expect(parameters.contextValues().get('diam')).toBe('25');
    expect(parameters.contextValues().get('__conn')).toBe('');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'N', technology: 'WLD_STEEL' });
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'diam')?.values).toContain('500');
    mw.library.selectValue('tech', 'copper');
    expect(mw.library.resolution.choices.find((choice) => choice.name === 'diam')?.values).not.toContain('500');
    mw.library.selectValue('diam', '15');
    mw.library.selectValue('__conn', 'female');
    expect(parameters.contextValues().get('diam')).toBe('15');
    expect(links.definitions()[0]).toMatchObject({ connectionType: 'F', technology: 'COPPER' });
    expect(links.tableRows[0].texts[3]).toBe('(327.5, -165, -137.5)');
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
      const dimension = ['L', 'H', 'l'].find(
        (name) => initialValues.has(name) && parameters.rows.some((row) => row.texts[0] === name && !row.disabled),
      )!;
      edit(dimension, '777');
      links.positionEdited(0, '17');
      const editedConnectors = links.definitions();
      for (const element of cases.slice(1)) {
        edit('elType', element.defaults.elType);
        const variant =
          element.variants.find((variant) =>
            Object.entries(variant.selection).every(
              ([name, value]) => name === 'tech' || value === initialValues.get(name),
            ),
          ) ?? element.variants[0];
        const expected = { ...element.defaults, ...variant.defaults };
        expect(Object.fromEntries(parameters.contextValues())).toMatchObject(expected);
        expect(links.definitions()).toEqual(variant.connectors ?? element.connectors);
        mw.applyParameters();
        expect(mw.session.lastResult.diagnostics, element.name).toEqual([]);
        expect(mw.session.scene.warnings, element.name).toEqual([]);
        expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
        expect(links.statusIsError).toBe(false);
        expect(editor.text).toBe(originalCode);
      }
      edit('elType', first.defaults.elType);
      expect(parameters.contextValues().get(dimension)).toBe('777');
      expect(links.definitions()).toEqual(editedConnectors);
      parameters.resetToSource();
      expect(parameters.contextValues().get(dimension)).toBe(initialValues.get(dimension));
      expect(links.definitions()).toEqual(first.variants[0].connectors ?? first.connectors);
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
      const variant = element.variants.find(
        (variant) =>
          variant.selection.ConnType === connection &&
          variant.selection.bport === side &&
          variant.selection.dn === current.get('dn'),
      )!;
      expect(variant).toBeDefined();
      expect(Object.fromEntries(current)).toMatchObject(variant.defaults);
      expect(links.definitions()).toEqual(variant.connectors);
      mw.applyParameters();
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

it('preserves values and connectors while a manually entered selector has no matching preset', async () => {
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
    const row = parameters.rows.findIndex((row) => row.texts[0] === 'elType');
    parameters.edit(row, 3);
    parameters.editorTextEdited('999');
    parameters.commitEditor();
    expect(parameters.contextValues().get('elType')).toBe('999');
    expect(parameters.contextValues()).toEqual(new Map([...values, ['elType', '999']]));
    expect(links.definitions()).toEqual(connectors);
    expect(showMessage).not.toHaveBeenCalled();
    parameters.resetToSource();
    expect(parameters.contextValues()).toEqual(values);
    expect(links.definitions()).toEqual(element.connectors);
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
      const row = parameters.rows.findIndex((row) => row.texts[0] === 'elType3d');
      expect(parameters.edit(row, 3)).toBe(true);
      parameters.editorTextEdited(element.defaults.elType3d);
      parameters.commitEditor();
      expect(parameters.contextValues().get('elType')).toBe('1');
      expect(Object.fromEntries(parameters.contextValues())).toMatchObject(element.defaults);
      expect(links.definitions()).toEqual(element.connectors);
      mw.applyParameters();
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.warnings).toEqual([]);
      expect(mw.session.scene.meshes.filter((mesh) => mesh.apiName === 'makeSpheroidSection')).toHaveLength(2);
      expect(links.statusIsError).toBe(false);
    }
    for (const value of ['0', '1']) {
      const row = parameters.rows.findIndex((row) => row.texts[0] === 'elType');
      parameters.edit(row, 3);
      parameters.editorTextEdited(value);
      parameters.commitEditor();
    }
    expect(parameters.contextValues().get('elType3d')).toBe(tanks[0].defaults.elType3d);
    expect(links.definitions()).toEqual(tanks[0].connectors);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});
