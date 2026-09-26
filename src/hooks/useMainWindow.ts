import { useModelFiles } from './useModelFiles';
import { useEffect, useState } from 'react';
import { MainWindow } from './mainWindow/MainWindow';
import { useObservable } from './useObservable';

export function useMainWindow() {
  const [mainWindow] = useState(() => new MainWindow());
  useObservable(mainWindow);
  const files = useModelFiles(mainWindow);
  const workspace = mainWindow.functions;
  const parameterFunctions = workspace.parameterFunctions;

  useEffect(() => {
    document.title = 'Geometry Preview';

    const onKeyDown = (event: KeyboardEvent) => mainWindow.handleKeyDown(event);

    window.addEventListener('keydown', onKeyDown);
    mainWindow.start();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      mainWindow.dispose();
    };
  }, [mainWindow]);

  return {
    functions: {
      active: workspace.active,
      names: workspace.names,
      error: workspace.error,
      unsaved: [...workspace.drafts.keys()].filter((name) => workspace.source(name) !== workspace.savedSource(name)),
      add: mainWindow.addFunction,
      select: mainWindow.selectFunction,
      save: mainWindow.saveFunction,
      cancel: mainWindow.cancelFunction,
      attach: mainWindow.attachFunction,
      remove: mainWindow.deleteFunction,
    },
    subParameters: {
      enabled: mainWindow.canEditSubParameters,
      functions: parameterFunctions.map((fn) => ({
        ...fn,
        inputs: fn.inputs.map((input) => ({
          ...input,
          values: workspace.inputValues(fn.name, input.name, input.initial),
        })),
      })),
      active: parameterFunctions.some((fn) => fn.name === workspace.inputTab)
        ? workspace.inputTab
        : (parameterFunctions[0]?.name ?? ''),
      select: mainWindow.selectFunctionInputs,
      change: mainWindow.setFunctionInput,
      apply: mainWindow.applyFunctionInputs,
    },
    files,
    importedObj: mainWindow.importedObj,
    returnToCodePreview: mainWindow.returnToCodePreview,
    previewMode: mainWindow.previewMode,
    buildPreview: mainWindow.buildPreview,
    debugPreview: mainWindow.debugPreview,
    debugBlocked: mainWindow.debugBlocked,
    menus: mainWindow.menus,
    toolbarItems: mainWindow.toolbarItems,
    inspectorCounts: mainWindow.inspectorCounts,
    raisedDock: mainWindow.raisedDock(),
    raiseDock: mainWindow.raiseDock,
    editor: {
      ref: mainWindow.bindEditor,
      executionFeedback: mainWindow.executionFeedback,
      previewStatus: mainWindow.previewStatus,
      onTextChanged: mainWindow.onEditorTextChanged,
      onCursorPositionChanged: mainWindow.onEditorCursorPositionChanged,
      onSourceActivated: mainWindow.onApiTraceSourceActivated,
    },
    viewport: {
      ref: mainWindow.bindViewport,
      onSelectionChanged: mainWindow.onViewportSelectionChanged,
      onPointCreation: mainWindow.onViewportPointCreation,
      onMeshSelection: mainWindow.onViewportMeshSelection,
      onConnectorSelection: mainWindow.onViewportConnectorSelection,
    },
    variables: { ref: mainWindow.bindVariables, onSelectionChanged: mainWindow.onVariableSelectionChanged },
    parameters: {
      ref: mainWindow.bindParameters,
      onChanged: mainWindow.onParametersChanged,
      onApply: mainWindow.applyParameters,
    },
    apiTrace: {
      ref: mainWindow.bindApiTrace,
      onSelectionChanged: mainWindow.onApiTraceSelectionChanged,
      onFunctionActivated: mainWindow.onApiTraceFunctionActivated,
      onSourceActivated: mainWindow.onApiTraceSourceActivated,
      onHistorySourceActivated: mainWindow.onApiTraceHistorySourceActivated,
    },
    links: {
      ref: mainWindow.bindLinks,
      expressionEvaluator: mainWindow.linkExpressionEvaluator,
      onPreviewChanged: mainWindow.onLinkPreviewChanged,
    },
  };
}
