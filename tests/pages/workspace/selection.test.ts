import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewport3DHandle } from '@/widgets/viewport/model/viewportHandle';
import { createEngine } from '@tests/renderer/helpers';
import { createWorkspace, keyEvent, kSource } from '@tests/pages/workspace/harness';

describe('Workspace: selection sync between the editor, viewport, Variables and API Trace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['Separate', 'Unite'] as const)(
    '%s shows only input points for sub-function calls in Main and opens their editor on double-click',
    (presentation) => {
      const { mw, editor, apiTrace } = createWorkspace();
      const engine = createEngine();
      mw.bindViewport(createViewport3DHandle(engine));
      mw.start();
      if (presentation === 'Unite') engine.toggleSelectionPresentation();
      editor.type(
        `void element() {
FdPoint3d cP(1,2,3), points[2] = {cP, FdPoint3d(4,5,6)};
withPoint(cP, vz);
withoutPoint();
withPoints(points);
}
void withPoint(FdPoint3d center, FdVector3d axis=FdVector3d(0,0,1)) {
FdPoint3d internal = center + axis * 10;
leaf(internal);
makeFlatDisc(internal, axis, 4, 8);
}
void leaf(FdPoint3d point) { makeFlatDisc(point, vz, 2, 8); }
void withoutPoint() { withPoint(FdPoint3d(10,20,30), vx); }
void withPoints(FdPoint3d points[2]) { makeFlatDisc(points[0], vz, 3, 8); }`,
        1,
      );
      mw.buildPreview();
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      const geometry = mw.session.scene;
      const focus = vi.spyOn(engine, 'setApiFocusIndices');

      const select = (row: number) => apiTrace.m_tree.setCurrentItem(apiTrace.m_tree.topLevelItem(row));

      select(0);
      expect(engine.pointLabelPanel().entries()).toEqual([
        { id: '@api0:point:center', name: 'cP', value: '(1, 2, 3)' },
      ]);
      expect(engine.vectorLabelPanel().entries()).toEqual([]);
      expect(engine.vectorLabelPanel().isVisible()).toBe(false);
      expect(focus).toHaveBeenLastCalledWith(new Set([0, 1, 2, 3]), new Set([0]));
      expect(mw.session.scene).toBe(geometry);
      select(1);
      expect(engine.pointLabelPanel().entries()).toEqual([]);
      expect(engine.vectorLabelPanel().entries()).toEqual([]);
      expect(engine.pointLabelPanel().isVisible()).toBe(false);
      expect(engine.vectorLabelPanel().isVisible()).toBe(false);
      select(2);
      expect(
        engine
          .pointLabelPanel()
          .entries()
          .map((entry) => [entry.name, entry.value]),
      ).toEqual([
        ['points[0]', '(1, 2, 3)'],
        ['points[1]', '(4, 5, 6)'],
      ]);
      // A native API still exposes its own input points and vectors in Main.
      apiTrace.selectMeshApiCall(2);
      expect(engine.pointLabelPanel().entries()).toHaveLength(1);
      expect(engine.vectorLabelPanel().entries()).toHaveLength(1);
      apiTrace.clearApiFocus();
      const item = apiTrace.m_tree.topLevelItem(0);
      const event = { item, column: 1, modifiers: { shift: false, control: false }, onDecoration: false };
      apiTrace.m_tree.mousePressEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe('');
      apiTrace.m_tree.mouseDoubleClickEvent(event);
      apiTrace.m_tree.mouseReleaseEvent(event);
      expect(mw.functions.active).toBe('withPoint');
      expect(editor.text).toContain('void withPoint(');
      expect(editor.text).not.toContain('void element(');
      expect(apiTrace.historyDialog()).toBeNull();
      expect(mw.session.lastResult.diagnostics).toEqual([]);
      expect(mw.session.scene.meshes).toHaveLength(2);
      // Inside the function tab, its nested API inputs remain available for debugging.
      apiTrace.m_tree.setCurrentItem(apiTrace.m_tree.topLevelItem(0));
      expect(engine.pointLabelPanel().entries().length).toBeGreaterThan(1);
      expect(engine.vectorLabelPanel().entries().length).toBeGreaterThan(0);
      mw.dispose();
    },
  );

  it('keeps the preview line while browsing trace sources and resumes on manual navigation', () => {
    const { mw, editor, apiTrace } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    expect(mw.session.lastResult.apiCalls.map((call) => call.name)).toEqual(['makeDisc']);

    const api = apiTrace.m_tree.topLevelItem(0);
    apiTrace.m_tree.mousePressEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(mw.statusBar().currentMessage()).toBe('API #1 makeDisc | 2 point/vector input(s), 1 call(s) in focus');
    apiTrace.m_tree.mouseReleaseEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(editor.currentLine()).toBe(5);
    expect(editor.traceLines).toEqual({ lines: [5], active: 5 });
    expect(mw.selection.browsingTrace).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Source line 5 - keeping preview at line 6');

    mw.runPreview();
    expect(mw.session.currentLine).toBe(6);
    expect(apiTrace.selectedApiCall()).toBe(0);

    editor.moveTo(2);
    expect(mw.selection.browsingTrace).toBe(false);
    expect(editor.traceLines.lines).toEqual([]);
    vi.advanceTimersByTime(220);
    expect(mw.session.currentLine).toBe(2);
    mw.dispose();
  });

  it('selects variables from the viewport and navigates to their last assignment', () => {
    const { mw, log, editor, variables } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    log.length = 0;
    mw.selection.onViewportSelectionChanged(new Set(['n']));
    expect(log).toContain('setSelectedVariables({n})');
    expect(variables.selectedVariable()).toBe('n');
    expect(editor.currentLine()).toBe(4);
    expect(editor.traceLines).toEqual({ lines: [4], active: 4 });
    mw.dispose();
  });

  it('inserts a real declaration for a point created in the viewport', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    editor.type('FdPoint3d pPreview1(0, 0, 0);\n', 1);
    mw.onViewportPointCreation({ x: 1.25, y: -0.0004, z: 2.0004 });
    expect(editor.text).toBe('FdPoint3d pPreview1(0, 0, 0);\nFdPoint3d pPreview2(1.25, 0, 2);\n\n');
    expect(editor.currentLine()).toBe(3);
    expect(editor.focused).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Inserted pPreview2 from viewport: FdPoint3d pPreview2(1.25, 0, 2);');
    mw.dispose();
  });

  it('Esc exits the Link preview and clears the API focus', () => {
    const { mw, log, editor, apiTrace, links } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    links.addConnector();
    links.sizeTextChanged('diameter', 'w');
    links.testSelection();
    expect(log).toContain('setConnectorPreviews([1], 1)');
    expect(log.at(-1)).toBe('fitScene()');

    apiTrace.selectMeshApiCall(0);
    log.length = 0;
    mw.handleKeyDown(keyEvent('Escape'));
    expect(log).toContain('setConnectorPreviews([0], 1)');
    expect(log).toContain('clearApiFocus()');
    expect(apiTrace.selectedApiCall()).toBe(-1);
    expect(apiTrace.meshApiCall()).toBe(-1);
    mw.dispose();
  });
});
