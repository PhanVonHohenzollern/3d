import { vi } from 'vitest';
import { WorkspaceModel } from '@/pages/workspace';
import type { CodeEditorHandle } from '@/widgets/code-editor';
import type { Viewport3DHandle } from '@/widgets/viewport';

export class FakeEditor implements CodeEditorHandle {
  text = '';
  cursor = 0;
  traceLines: { lines: number[]; active: number } = { lines: [], active: -1 };
  focused = false;
  onTextChanged: () => void = () => {};
  onCursorPositionChanged: () => void = () => {};

  #lineStart(line: number): number {
    let position = 0;
    for (let i = 1; i < line; ++i) position = this.text.indexOf('\n', position) + 1;

    return position;
  }

  #setCursor(position: number): void {
    const moved = position !== this.cursor;
    this.cursor = position;
    if (moved) this.onCursorPositionChanged();
  }

  type(text: string, cursorLine: number): void {
    this.text = text;
    this.onTextChanged();
    this.#setCursor(this.#lineStart(cursorLine));
  }

  moveTo(line: number): void {
    this.#setCursor(this.#lineStart(line));
  }

  toPlainText() {
    return this.text;
  }

  clear() {
    this.text = '';
    this.cursor = 0;
    this.onTextChanged();
    this.onCursorPositionChanged();
  }

  setSource(source: string) {
    this.type(source, 1);
  }

  currentLine() {
    return this.text.slice(0, this.cursor).split('\n').length;
  }

  blockCount() {
    return this.text.split('\n').length;
  }

  setTraceSourceLines(lines: ReadonlySet<number>, activeLine = -1) {
    this.traceLines = { lines: [...lines].sort((a, b) => a - b), active: activeLine };
  }

  setTextCursorToLine(line: number) {
    this.#setCursor(this.#lineStart(line));
  }

  centerCursor() {}

  cursorBlockText() {
    return this.text.split('\n')[this.currentLine() - 1];
  }

  insertAtCursorBlockEnd(text: string) {
    const start = this.#lineStart(this.currentLine());
    const end = start + this.cursorBlockText().length;
    this.text = this.text.slice(0, end) + text + this.text.slice(end);
    this.onTextChanged();
    this.#setCursor(end + text.length);
  }

  setFocus() {
    this.focused = true;
  }
}

export function fakeViewport(log: string[]): Viewport3DHandle {
  let apiFocus = false;

  const record =
    (name: string) =>
    (...args: unknown[]) => {
      const printable = args.map((a) =>
        a instanceof Set
          ? `{${[...a].join(',')}}`
          : Array.isArray(a)
            ? `[${a.length}]`
            : typeof a === 'object'
              ? 'obj'
              : String(a),
      );
      log.push(`${name}(${printable.join(', ')})`);
    };

  return {
    setRuntimeResult: record('setRuntimeResult'),
    setShowPoints: record('setShowPoints'),
    setShowVectors: record('setShowVectors'),
    setShowLabels: record('setShowLabels'),
    setDebugItemVisible: record('setDebugItemVisible'),
    hideAllDebugItems: record('hideAllDebugItems'),
    showAllDebugItems: record('showAllDebugItems'),
    setSelectedVariable: record('setSelectedVariable'),
    setSelectedVariables: record('setSelectedVariables'),
    selectedDebugItems: () => new Set<string>(),
    fitDebugOverlay: record('fitDebugOverlay'),
    setGeometryScene: record('setGeometryScene'),
    setShowGeometry: record('setShowGeometry'),
    setGeometryWireframe: record('setGeometryWireframe'),
    setSelectedApiCall: record('setSelectedApiCall'),
    selectedMeshIndex: () => -1,
    isMeshSelected: () => false,
    hasApiFocus: () => apiFocus,
    hasMeshFocus: () => false,
    setApiFocusIndices: (indices) => {
      apiFocus = true;
      record('setApiFocusIndices')(indices);
    },
    clearApiFocus: () => {
      apiFocus = false;
      record('clearApiFocus')();
    },
    fitScene: record('fitScene'),
    setConnectorPreviews: record('setConnectorPreviews'),
  };
}

export function createWorkspace() {
  const mw = new WorkspaceModel();
  const log: string[] = [];
  const editor = new FakeEditor();
  mw.bindEditor(editor);
  mw.bindViewport(fakeViewport(log));
  editor.onTextChanged = mw.onEditorTextChanged;
  editor.onCursorPositionChanged = mw.onEditorCursorPositionChanged;
  const { variables, parameters, apiTrace, links } = mw;

  return { mw, log, editor, variables, parameters, apiTrace, links };
}

export const kSource = [
  'double w = 2;',
  'get_val("Width", w);',
  'FdPoint3d p0(1, 2, 3);',
  'FdVector3d n(0, 0, 1);',
  'makeDisc(p0, n, w, 1, 8, false);',
  'double after = 1;',
].join('\n');

const isMac = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '');

export function keyEvent(
  key: string,
  modifiers: { control?: boolean; shift?: boolean } = {},
  target: 'input' | 'tree' | 'dialog' = 'tree',
) {
  const matches: Record<string, string> = { input: 'input', tree: '.tree-view', dialog: '[data-floating-window]' };

  return {
    key,
    shiftKey: !!modifiers.shift,
    ctrlKey: !isMac && !!modifiers.control,
    metaKey: isMac && !!modifiers.control,
    altKey: false,
    target: { closest: (selectors: string) => (selectors.includes(matches[target]) ? {} : null) },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}
