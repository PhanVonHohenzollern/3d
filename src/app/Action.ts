// Minimal port of QAction as used by MainWindow::createActions(): text,
// shortcut, checkable state and the triggered/toggled signals. The menu bar
// and the toolbar render the same Action objects, like Qt.

import { isMacPlatform, Observable } from '../ui/Observable';

/** QKeySequence subset. `control` is Qt::CTRL (the Command key on macOS). */
export interface KeySequence {
  key: string;
  control?: boolean;
  shift?: boolean;
}

const isWindowsPlatform = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent);

/** QKeySequence::Quit: Ctrl+Q (Cmd+Q on macOS); Windows has no standard binding. */
export const quitKeySequence: KeySequence | null = isWindowsPlatform ? null : { key: 'q', control: true };

export function keySequenceText(sequence: KeySequence): string {
  const key = sequence.key.length === 1 ? sequence.key.toUpperCase() : sequence.key;
  if (isMacPlatform) return `${sequence.shift ? '\u21e7' : ''}${sequence.control ? '\u2318' : ''}${key}`;
  return `${sequence.control ? 'Ctrl+' : ''}${sequence.shift ? 'Shift+' : ''}${key}`;
}

export function matchesKeySequence(sequence: KeySequence, event: KeyboardEvent): boolean {
  const control = isMacPlatform ? event.metaKey : event.ctrlKey;
  const otherControl = isMacPlatform ? event.ctrlKey : event.metaKey;
  if (event.altKey || otherControl) return false;
  if (!!sequence.control !== control || !!sequence.shift !== event.shiftKey) return false;
  return event.key.toLowerCase() === sequence.key.toLowerCase();
}

/** Text without the '&' mnemonic markers (QAction::iconText()). */
export const stripMnemonic = (text: string): string => text.replace(/&(.)/g, '$1');

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

  /** connect(action, &QAction::triggered, ...) */
  onTriggered(slot: (checked: boolean) => void): void {
    this.#triggered.push(slot);
  }
  /** connect(action, &QAction::toggled, ...) */
  onToggled(slot: (checked: boolean) => void): void {
    this.#toggled.push(slot);
  }

  /** QAction::trigger(): toggles a checkable action, then emits triggered. */
  trigger(): void {
    if (this.#checkable) this.setChecked(!this.#checked);
    for (const slot of [...this.#triggered]) slot(this.#checked);
  }

  iconText(): string {
    return stripMnemonic(this.text);
  }
}
