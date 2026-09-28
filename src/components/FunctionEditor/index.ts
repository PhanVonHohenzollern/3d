import { FunctionEditorActions } from '@/components/FunctionEditor/FunctionEditorActions';
import { FunctionEditorAddDialog } from '@/components/FunctionEditor/FunctionEditorAddDialog';
import { FunctionEditorError } from '@/components/FunctionEditor/FunctionEditorError';
import { FunctionEditorProvider } from '@/components/FunctionEditor/FunctionEditorProvider';
import { FunctionEditorTabs } from '@/components/FunctionEditor/FunctionEditorTabs';

export const FunctionEditor = {
  Actions: FunctionEditorActions,
  AddDialog: FunctionEditorAddDialog,
  Error: FunctionEditorError,
  Provider: FunctionEditorProvider,
  Tabs: FunctionEditorTabs,
};

export type { FunctionEditorActions, FunctionEditorState } from '@/components/FunctionEditor/FunctionEditorContext';
