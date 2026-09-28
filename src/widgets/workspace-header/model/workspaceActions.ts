import { Action } from '@/shared/lib/action';
import { quitKeySequence } from '@/shared/lib/qt';
import type { ActionListItem } from '@/widgets/workspace-header/model/types';

export interface WorkspaceCommands {
  exit(): void;
  runPreview(): void;
  setShowGeometry(show: boolean): void;
  setGeometryWireframe(wireframe: boolean): void;
  fitScene(): void;
  setShowPoints(show: boolean): void;
  setShowVectors(show: boolean): void;
  setShowLabels(show: boolean): void;
  fitDebugOverlay(): void;
  setSelectedDebugItemsVisible(visible: boolean): void;
}

export interface WorkspaceActions {
  toolbarItems: ActionListItem[];
  shortcutActions: Action[];
  showGeometry: Action;
}

function checkable(text: string, checked: boolean): Action {
  const action = new Action(text);
  action.setCheckable(true);
  action.setChecked(checked);

  return action;
}

// The workspace's toolbar and keyboard actions. The page supplies what each one does.
export function createWorkspaceActions(commands: WorkspaceCommands): WorkspaceActions {
  const exitAction = new Action('E&xit');
  exitAction.setShortcut(quitKeySequence);
  const runAction = new Action('&Run Preview');
  runAction.setShortcut({ key: 'r', control: true });
  const showGeometryAction = checkable('Show &Geometry', true);
  const wireframeAction = checkable('Geometry &Wireframe', false);
  const fitSceneAction = new Action('Fit &Scene');
  const showPointsAction = checkable('Show &Points', true);
  const showVectorsAction = checkable('Show &Vectors', true);
  const showLabelsAction = checkable('Show &Labels', true);
  const fitAction = new Action('&Fit Debug');
  fitAction.setShortcut({ key: 'f' });
  const hideSelectedAction = new Action('Hide Selected');
  hideSelectedAction.setShortcut({ key: 'h' });
  const showSelectedAction = new Action('Show Selected');
  showSelectedAction.setShortcut({ key: 'h', shift: true });

  exitAction.onTriggered(() => commands.exit());
  runAction.onTriggered(() => commands.runPreview());
  showGeometryAction.onToggled((checked) => commands.setShowGeometry(checked));
  wireframeAction.onToggled((checked) => commands.setGeometryWireframe(checked));
  fitSceneAction.onTriggered(() => commands.fitScene());
  showPointsAction.onToggled((checked) => commands.setShowPoints(checked));
  showVectorsAction.onToggled((checked) => commands.setShowVectors(checked));
  showLabelsAction.onToggled((checked) => commands.setShowLabels(checked));
  fitAction.onTriggered(() => commands.fitDebugOverlay());
  hideSelectedAction.onTriggered(() => commands.setSelectedDebugItemsVisible(false));
  showSelectedAction.onTriggered(() => commands.setSelectedDebugItemsVisible(true));

  return {
    toolbarItems: [
      showGeometryAction,
      wireframeAction,
      fitSceneAction,
      'separator',
      showPointsAction,
      showVectorsAction,
      showLabelsAction,
      'separator',
      hideSelectedAction,
      showSelectedAction,
    ],
    shortcutActions: [exitAction, runAction, fitAction, hideSelectedAction, showSelectedAction],
    showGeometry: showGeometryAction,
  };
}
