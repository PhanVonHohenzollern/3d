import type { FunctionEditorActions, FunctionEditorState } from '@/features/manage-functions';
import { useModelFiles } from '@/features/model-files';
import { useEffect, useMemo, useState } from 'react';
import { MainWindow } from '@/hooks/mainWindow/MainWindow';
import { useObservable } from '@/shared/lib/observable';

export function useMainWindow() {
  const [mainWindow] = useState(() => new MainWindow());
  useObservable(mainWindow);
  const files = useModelFiles({
    canExport: mainWindow.canExportObj,
    importedName: mainWindow.importedObj?.name ?? null,
    showImported: (model) => mainWindow.replacePreviewWithObj(model.scene, model.name),
    exportText: () => mainWindow.exportObj(),
  });
  const workspace = mainWindow.functions;
  const parameterFunctions = workspace.parameterFunctions;
  const functionActions = useMemo<FunctionEditorActions>(
    () => ({
      create: { add: mainWindow.addFunction, clearError: mainWindow.clearFunctionError },
      current: {
        attach: mainWindow.attachFunction,
        cancel: mainWindow.cancelFunction,
        remove: mainWindow.deleteFunction,
        save: mainWindow.saveFunction,
      },
      select: mainWindow.selectFunction,
    }),
    [mainWindow],
  );

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
      state: {
        active: workspace.active,
        names: workspace.names,
        error: workspace.error,
        unsaved: workspace.unsavedNames(),
      } satisfies FunctionEditorState,
      actions: functionActions,
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
