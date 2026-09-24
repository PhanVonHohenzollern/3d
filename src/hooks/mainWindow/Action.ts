import { stripMnemonic } from '../../helpers/keyboard';
import type { KeySequence } from '../../types/qt';
import { Observable } from '../observable/Observable';

export class Action extends Observable {
  #shortcut: KeySequence | null = null;
  #checkable = false;
  #checked = false;
  readonly #triggered: ((checked: boolean) => void)[] = [];
  readonly #toggled: ((checked: boolean) => void)[] = [];

  constructor(readonly text: string) {
    super();
  }

  setShortcut(shortcut: KeySequence | null): void {
    this.#shortcut = shortcut;
    this.changed();
  }

  shortcut(): KeySequence | null {
    return this.#shortcut;
  }

  setCheckable(checkable: boolean): void {
    this.#checkable = checkable;
    this.changed();
  }

  isCheckable(): boolean {
    return this.#checkable;
  }

  isChecked(): boolean {
    return this.#checked;
  }

  setChecked(checked: boolean): void {
    if (this.#checked === checked) return;
    this.#checked = checked;
    if (!this.#checkable) return;
    this.changed();
    for (const slot of [...this.#toggled]) slot(checked);
  }

  onTriggered(slot: (checked: boolean) => void): void {
    this.#triggered.push(slot);
  }

  onToggled(slot: (checked: boolean) => void): void {
    this.#toggled.push(slot);
  }

  trigger(): void {
    if (this.#checkable) this.setChecked(!this.#checked);
    for (const slot of [...this.#triggered]) slot(this.#checked);
  }

  iconText(): string {
    return stripMnemonic(this.text);
  }
}
