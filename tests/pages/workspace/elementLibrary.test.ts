import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createWorkspace } from '@tests/pages/workspace/harness';

it('keeps the editor, Parameters, FLM selection and connectors synchronized without rebuilding on edits', async () => {
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
    expect(parameters.dataSets.length).toBeGreaterThan(100);
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
    expect(mw.session.scene).toBe(originalScene);
    expect(editor.text).toBe(code);
    edit('elType', '0');
    expect(mw.library.element?.defaults.elType).toBe('0');
    expect(parameters.contextValues().get('diam')).toBe('65');
    expect(links.definitions()).toEqual(mw.library.element?.connectors);
    expect(links.statusIsError).toBe(false);
    mw.applyParameters();
    expect(mw.session.lastResult.diagnostics).toEqual([]);
    expect(mw.session.scene.warnings).toEqual([]);
    expect(mw.session.scene.meshes.length).toBeGreaterThan(0);
    expect(editor.text).toBe(code);
    parameters.resetToSource();
    expect(mw.library.elementId).toBe(element.id);
    expect(parameters.contextValues().get('diam')).toBe('25');
    expect(parameters.dataSets.length).toBeGreaterThan(100);
  } finally {
    mw.dispose();
    fetchMock.mockRestore();
    vi.useRealTimers();
  }
});
