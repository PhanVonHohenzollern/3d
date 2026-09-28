import type { FunctionWorkspace } from '@/entities/source-function';
import { Signal } from '@/shared/lib/observable';

type EditorText = { toPlainText(): string };

type ParameterEditing = { commitEditor(): void; forgetFunction(name: string): void };

// The user's actions on function tabs. It edits the workspace and reports what happened; the page
// reacts (switching the editor, resetting the preview, cleaning up Build state, status messages).
export class FunctionTabsController {
  readonly editorSwitched = new Signal<[]>();
  readonly stateChanged = new Signal<[]>();
  readonly draftCancelled = new Signal<[name: string]>();
  readonly functionDeleted = new Signal<[name: string]>();
  readonly inputsChanged = new Signal<[]>();
  readonly applyRequested = new Signal<[]>();
  readonly statusMessage = new Signal<[text: string]>();

  constructor(
    readonly workspace: FunctionWorkspace,
    readonly editor: () => EditorText,
    readonly parameters: () => ParameterEditing,
  ) {}

  get canEditInputs(): boolean {
    return !!this.workspace.active && this.workspace.parameterFunctions.length > 0;
  }

  add(name: string): boolean {
    this.parameters().commitEditor();
    this.workspace.edit(this.editor().toPlainText());
    if (!this.workspace.add(name)) {
      this.stateChanged.emit();

      return false;
    }
    this.editorSwitched.emit();

    return true;
  }

  // The Add Function dialog shows its own error; this keeps it from outliving the dialog.
  clearError(): void {
    if (!this.workspace.error) return;
    this.workspace.clearError();
    this.stateChanged.emit();
  }

  select(name: string): void {
    if (name === this.workspace.active || (name && !this.workspace.names.includes(name))) return;
    this.parameters().commitEditor();
    this.workspace.edit(this.editor().toPlainText());
    this.workspace.select(name);
    this.editorSwitched.emit();
  }

  save(): void {
    this.workspace.edit(this.editor().toPlainText());
    if (this.workspace.save()) this.editorSwitched.emit();
    this.stateChanged.emit();
  }

  cancel(): void {
    const name = this.workspace.active;
    this.workspace.cancel();
    this.draftCancelled.emit(name);
    this.editorSwitched.emit();
  }

  attach(): void {
    this.workspace.edit(this.editor().toPlainText());
    if (this.workspace.attach()) this.statusMessage.emit('Function attached to the main code.');
    this.stateChanged.emit();
  }

  remove(): void {
    if (!this.workspace.active) return;
    this.parameters().commitEditor();
    const name = this.workspace.removeActive();
    if (!name) return;
    this.functionDeleted.emit(name);
    this.parameters().forgetFunction(name);
    this.editorSwitched.emit();
    this.statusMessage.emit(`Function ${name} deleted.`);
  }

  setInput(name: string, parameter: string, initial: string[], index: number, value: string): void {
    if (!this.canEditInputs) return;
    this.workspace.setInput(name, parameter, initial, index, value);
    this.inputsChanged.emit();
  }

  selectInputs(name: string): void {
    if (!this.canEditInputs) return;
    this.workspace.selectInputTab(name);
    this.stateChanged.emit();
  }

  applyInputs(name: string): void {
    if (!this.canEditInputs || !this.workspace.parameterFunctions.some((fn) => fn.name === name)) return;
    this.select(name);
    this.applyRequested.emit();
  }
}
