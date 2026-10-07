import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createWorkspace } from '@tests/pages/workspace/harness';

it('opens one default set and keeps manual edits independent until Reset', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const body = readFileSync('public/' + String(input).replace(/^\//, ''));

    return {
      ok: true,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    } as Response;
  });
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
