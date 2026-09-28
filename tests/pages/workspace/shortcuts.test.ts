import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace, keyEvent, kSource } from '@tests/pages/workspace/harness';

describe('Workspace: keyboard shortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('H hides and Shift+H shows the selected debug items, or asks for a selection', () => {
    const { mw, editor, apiTrace, log } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    mw.handleKeyDown(keyEvent('h'));
    expect(mw.statusBar().currentMessage()).toBe(
      'Select a point/vector parameter in API Trace, Variables, or the viewport first',
    );

    vi.spyOn(apiTrace, 'selectedDebugItems').mockReturnValue(new Set(['@api0:point:center']));
    mw.handleKeyDown(keyEvent('h'));
    expect(log).toContain('setDebugItemVisible(@api0:point:center, false)');
    expect(mw.statusBar().currentMessage()).toBe('Hidden 1 selected debug item(s)');
    mw.handleKeyDown(keyEvent('h', { shift: true }));
    expect(log).toContain('setDebugItemVisible(@api0:point:center, true)');
    expect(mw.statusBar().currentMessage()).toBe('Shown 1 selected debug item(s)');
    mw.dispose();
  });

  it('dispatches action shortcuts, letting single-key shortcuts yield to text input', () => {
    const { mw, log } = createWorkspace();
    mw.start();
    vi.advanceTimersByTime(220);
    log.length = 0;
    const inInput = keyEvent('f', {}, 'input');
    mw.handleKeyDown(inInput);
    expect(log).toEqual([]);
    expect(inInput.preventDefault).not.toHaveBeenCalled();

    const inTree = keyEvent('f', {}, 'tree');
    mw.handleKeyDown(inTree);
    expect(log).toEqual(['fitDebugOverlay()']);
    expect(inTree.preventDefault).toHaveBeenCalled();

    log.length = 0;
    const run = keyEvent('r', { control: true }, 'input');
    mw.handleKeyDown(run);
    expect(run.preventDefault).toHaveBeenCalled();
    expect(log).toContain('setRuntimeResult(obj)');

    log.length = 0;
    mw.handleKeyDown(keyEvent('f', {}, 'dialog'));
    expect(log).toEqual([]);
    mw.dispose();
  });
});
