import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
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
    expect(mw.library.element?.defaults.elType).toBe('7');
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
