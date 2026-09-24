import { CompletionContext, type CompletionResult, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { createEditorExtensions } from '../../src/hooks/codeEditor/editorExtensions';

async function complete(doc: string, explicit = false): Promise<CompletionResult | null> {
  const state = EditorState.create({ doc, extensions: createEditorExtensions(() => {}) });
  const sources = state.languageDataAt<CompletionSource>('autocomplete', doc.length);
  expect(sources).toHaveLength(1);
  return sources[0](new CompletionContext(state, doc.length, explicit));
}

describe('Code Editor local autocomplete', () => {
  it('offers SDK functions with overload signatures, types, constants and C++ keywords', async () => {
    const result = await complete('make_');
    expect(result?.from).toBe(0);
    expect(result?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'make_circle',
          type: 'function',
          info: expect.stringContaining('ads_real rad'),
        }),
        expect.objectContaining({ label: 'FdPoint3d', type: 'type' }),
        expect.objectContaining({ label: 'ARX_PI', type: 'constant' }),
        expect.objectContaining({ label: 'for', type: 'keyword' }),
      ]),
    );
    expect(result?.options.filter((option) => option.label === 'make_circle')).toHaveLength(1);
  });

  it('suggests declared variables and parameters without including initializer names or closed scopes', async () => {
    const result = await complete(`double radius = unknownName, height = 3;
void helper(double size) {
  { double hidden = 1; }
  FdPoint3d center(0, 0, 0);
  double values[3];
  const double &alias = radius;
  ra`);
    const labels = result!.options.map((option) => option.label);
    expect(labels).toEqual(expect.arrayContaining(['radius', 'height', 'size', 'center', 'values', 'alias']));
    expect(labels).not.toContain('unknownName');
    expect(labels).not.toContain('hidden');
    expect(labels).not.toContain('ra');
  });

  it.each(['// make_', '/* make_', 'const char *s = "make_', "char c = 'm", 'auto s = R"(make_'])(
    'suppresses suggestions inside comments and strings: %s',
    async (doc) => {
      expect(await complete(doc, true)).toBeNull();
    },
  );

  it('supports explicit completion on a blank line and replaces qualified names as a whole', async () => {
    expect(await complete('')).toBeNull();
    expect((await complete('', true))?.options.length).toBeGreaterThan(0);
    const result = await complete('int mode = AirDirection::ad');
    expect(result?.from).toBe(11);
    expect(result?.options).toContainEqual(expect.objectContaining({ label: 'AirDirection::adNorm' }));
  });
});
