import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceActions, type WorkspaceCommands } from '@/widgets/workspace-header';

function commands(): WorkspaceCommands {
  return {
    exit: vi.fn(),
    runPreview: vi.fn(),
    setShowGeometry: vi.fn(),
    setGeometryWireframe: vi.fn(),
    fitScene: vi.fn(),
    setShowPoints: vi.fn(),
    setShowVectors: vi.fn(),
    setShowLabels: vi.fn(),
    fitDebugOverlay: vi.fn(),
    setSelectedDebugItemsVisible: vi.fn(),
  };
}

describe('createWorkspaceActions', () => {
  it('lays out the toolbar and the keyboard shortcuts', () => {
    const actions = createWorkspaceActions(commands());
    const texts = actions.toolbarItems.map((item) => (item === 'separator' ? '|' : item.text));
    expect(texts).toEqual([
      'Show &Geometry',
      'Geometry &Wireframe',
      'Fit &Scene',
      '|',
      'Show &Points',
      'Show &Vectors',
      'Show &Labels',
      '|',
      'Hide Selected',
      'Show Selected',
    ]);
    expect(actions.shortcutActions.map((action) => action.text)).toEqual([
      'E&xit',
      '&Run Preview',
      '&Fit Debug',
      'Hide Selected',
      'Show Selected',
    ]);
    expect(actions.showGeometry.isChecked()).toBe(true);
  });

  it('forwards each action to its command', () => {
    const target = commands();
    const actions = createWorkspaceActions(target);
    const byText = new Map(
      [...actions.toolbarItems, ...actions.shortcutActions]
        .filter((item) => item !== 'separator')
        .map((action) => [action.text, action]),
    );

    byText.get('Geometry &Wireframe')!.trigger();
    expect(target.setGeometryWireframe).toHaveBeenCalledWith(true);
    byText.get('Show &Points')!.trigger();
    expect(target.setShowPoints).toHaveBeenCalledWith(false);
    byText.get('Hide Selected')!.trigger();
    expect(target.setSelectedDebugItemsVisible).toHaveBeenCalledWith(false);
    byText.get('Show Selected')!.trigger();
    expect(target.setSelectedDebugItemsVisible).toHaveBeenCalledWith(true);
    byText.get('&Run Preview')!.trigger();
    expect(target.runPreview).toHaveBeenCalledOnce();
    byText.get('&Fit Debug')!.trigger();
    expect(target.fitDebugOverlay).toHaveBeenCalledOnce();
  });
});
