import type { FunctionWorkspace } from '@/entities/source-function';
import { Signal } from '@/shared/lib/observable';

type EditorText = { toPlainText(): string };
type ParameterEditing = { commitEditor(): void; forgetFunction(name: string): void };

export class FunctionTabsController {
  readonly editorSwitched = new Signal<[]>();
  readonly stateChanged = new Signal<[]>();
  readonly inputsChanged = new Signal<[]>();
  readonly removed = new Signal<[names: string[]]>();

  constructor(
    readonly workspace: FunctionWorkspace,
    readonly editor: () => EditorText,
    readonly parameters: () => ParameterEditing,
  ) {}

  get canEditInputs(): boolean {
    return this.workspace.parameterFunctions.length > 0;
  }

  #saveEditor(): void {
    this.parameters().commitEditor();
    this.workspace.edit(this.editor().toPlainText());
  }

  add(name: string, header: boolean): boolean {
    this.#saveEditor();
    if (!this.workspace.addFiles(name, header)) {
      this.stateChanged.emit();

      return false;
    }
    this.editorSwitched.emit();

    return true;
  }

  clearError(): void {
    this.workspace.clearError();
    this.stateChanged.emit();
  }

  selectFile(name: string): void {
    this.#saveEditor();
    this.workspace.selectFile(name);
    this.editorSwitched.emit();
  }

  remove(): void {
    this.#saveEditor();
    const names = this.workspace.functions.filter((fn) => fn.file === this.workspace.activeFile).map((fn) => fn.name);
    if (!this.workspace.removeFile()) return;
    for (const name of names) this.parameters().forgetFunction(name);
    this.removed.emit(names);
    this.editorSwitched.emit();
  }

  setInput(name: string, parameter: string, initial: string[], index: number, value: string): void {
    this.workspace.setInput(name, parameter, initial, index, value);
    this.inputsChanged.emit();
  }

  resetInputs(name: string): void {
    this.workspace.resetInputs(name);
    this.inputsChanged.emit();
  }

  selectInputs(name: string): void {
    this.workspace.selectInputTab(name);
    this.stateChanged.emit();
  }
}
