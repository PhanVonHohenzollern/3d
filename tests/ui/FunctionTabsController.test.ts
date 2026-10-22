import { describe, expect, it, vi } from 'vitest';
import { FunctionWorkspace } from '@/entities/source-function';
import { FunctionTabsController } from '@/features/manage-functions/model/FunctionTabsController';

function setup() {
  const workspace = new FunctionWorkspace();
  workspace.replaceFiles([
    { name: '', code: 'int main() { return 0; }' },
    { name: 'a.h', code: 'double helper(double x);' },
    { name: 'a.cpp', code: 'double helper(double x) { return x; }' },
  ]);
  const editor = { toPlainText: vi.fn(() => workspace.source()) };
  const parameters = { commitEditor: vi.fn(), forgetFunction: vi.fn() };
  const controller = new FunctionTabsController(
    workspace,
    () => editor,
    () => parameters,
  );

  return { workspace, editor, parameters, controller };
}

describe('source tab deletion', () => {
  it('deletes the requested inactive file while preserving current edits and its paired header', () => {
    const { workspace, editor, parameters, controller } = setup();
    workspace.selectFile('a.h');
    editor.toPlainText.mockReturnValue('double helper(double x); // unsaved edit');
    const removed = vi.fn();
    controller.removed.connect(removed);

    controller.remove('a.cpp');

    expect(workspace.activeFile).toBe('a.h');
    expect(workspace.source()).toBe('double helper(double x); // unsaved edit');
    expect(workspace.fileNames).toEqual(['a.h']);
    expect(workspace.mainSource).toBe('int main() { return 0; }');
    expect(parameters.forgetFunction).toHaveBeenCalledWith('helper');
    expect(removed).toHaveBeenCalledWith(['helper']);
    expect(workspace.program().source).not.toContain('return x');
  });

  it('returns to Main.cpp when deleting the active source file', () => {
    const { workspace, controller } = setup();
    workspace.selectFile('a.cpp');

    controller.remove();

    expect(workspace.activeFile).toBe('');
    expect(workspace.source()).toBe('int main() { return 0; }');
    expect(workspace.fileNames).toEqual(['a.h']);
  });

  it('protects Main.cpp and ignores stale file names without touching editor state', () => {
    const { workspace, editor, parameters, controller } = setup();
    workspace.selectFile('a.cpp');

    controller.remove('');
    controller.remove('missing.cpp');

    expect(workspace.removeFile('')).toBeNull();
    expect(workspace.fileNames).toEqual(['a.h', 'a.cpp']);
    expect(workspace.activeFile).toBe('a.cpp');
    expect(editor.toPlainText).not.toHaveBeenCalled();
    expect(parameters.commitEditor).not.toHaveBeenCalled();
  });
});
