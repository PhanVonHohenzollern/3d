import type { FunctionEditorActions, FunctionEditorState } from '@/features/manage-functions';
import { useModelFiles } from '@/features/model-files';
import { useEffect, useMemo, useState } from 'react';
import { WorkspaceModel } from '@/pages/workspace/model/WorkspaceModel';
import { useObservable } from '@/shared/lib/observable';

export function useWorkspace() {
  const [model] = useState(() => new WorkspaceModel());
  useObservable(model);
  const files = useModelFiles({
    canExport: model.canExportObj,
    importedName: model.importedObj?.name ?? null,
    showImported: (imported) => model.replacePreviewWithObj(imported.scene, imported.name),
    exportText: () => model.exportObj(),
  });
  const functions = model.functions;
  const parameterFunctions = functions.parameterFunctions;
  const functionActions = useMemo<FunctionEditorActions>(
    () => ({
      create: { add: model.addFunction, clearError: model.clearFunctionError },
      current: {
        attach: model.attachFunction,
        cancel: model.cancelFunction,
        remove: model.deleteFunction,
        save: model.saveFunction,
      },
      select: model.selectFunction,
    }),
    [model],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => model.handleKeyDown(event);

    window.addEventListener('keydown', onKeyDown);
    model.start();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      model.dispose();
    };
  }, [model]);

  return {
    functions: {
      state: {
        active: functions.active,
        names: functions.names,
        error: functions.error,
        unsaved: functions.unsavedNames(),
      } satisfies FunctionEditorState,
      actions: functionActions,
    },
    subParameters: {
      enabled: model.canEditSubParameters,
      functions: parameterFunctions.map((fn) => ({
        ...fn,
        inputs: fn.inputs.map((input) => ({
          ...input,
          values: functions.inputValues(fn.name, input.name, input.initial),
        })),
      })),
      active: parameterFunctions.some((fn) => fn.name === functions.inputTab)
        ? functions.inputTab
        : (parameterFunctions[0]?.name ?? ''),
      select: model.selectFunctionInputs,
      change: model.setFunctionInput,
      apply: model.applyFunctionInputs,
    },
    files,
    importedObj: model.importedObj,
    returnToCodePreview: model.returnToCodePreview,
    previewMode: model.session.mode,
    buildPreview: model.buildPreview,
    debugPreview: model.debugPreview,
    debugBlocked: model.session.debugBlocked,
    toolbarItems: model.toolbarItems,
    inspectorCounts: model.inspectorCounts,
    raisedDock: model.raisedDock(),
    raiseDock: model.raiseDock,
    editor: {
      ref: model.bindEditor,
      executionFeedback: model.session.feedback,
      previewStatus: model.session.previewStatus,
      onTextChanged: model.onEditorTextChanged,
      onCursorPositionChanged: model.onEditorCursorPositionChanged,
      onSourceActivated: model.selection.onApiTraceSourceActivated,
    },
    viewport: {
      ref: model.bindViewport,
      onSelectionChanged: model.selection.onViewportSelectionChanged,
      onPointCreation: model.onViewportPointCreation,
      onMeshSelection: model.selection.onViewportMeshSelection,
      onConnectorSelection: model.onViewportConnectorSelection,
    },
    variables: { model: model.variables },
    parameters: { model: model.parameters, onApply: model.applyParameters },
    apiTrace: { model: model.apiTrace },
    links: { model: model.links },
  };
}
