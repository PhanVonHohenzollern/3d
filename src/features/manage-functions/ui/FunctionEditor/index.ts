import { FunctionEditorActions } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorActions';
import { FunctionEditorAddDialog } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorAddDialog';
import { FunctionEditorError } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorError';
import { FunctionEditorProvider } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorProvider';
import { FunctionEditorTabs } from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorTabs';

export const FunctionEditor = {
  Actions: FunctionEditorActions,
  AddDialog: FunctionEditorAddDialog,
  Error: FunctionEditorError,
  Provider: FunctionEditorProvider,
  Tabs: FunctionEditorTabs,
};

export type {
  FunctionEditorActions,
  FunctionEditorState,
} from '@/features/manage-functions/ui/FunctionEditor/FunctionEditorContext';
