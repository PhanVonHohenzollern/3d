// QStatusBar with temporary messages: showMessage(message, timeoutMs) keeps a
// message until the timeout elapses (0 = until the next message).

import { Observable, useObservable } from '../ui/Observable';

export class StatusBarModel extends Observable {
  #message = '';
  #timer: ReturnType<typeof setTimeout> | undefined;

  currentMessage(): string { return this.#message; }

  showMessage(message: string, timeout = 0): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#message = message;
    if (timeout > 0) this.#timer = setTimeout(() => this.clearMessage(), timeout);
    this.changed();
  }

  clearMessage(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#message = '';
    this.changed();
  }
}

export function StatusBar({ model }: { model: StatusBarModel }) {
  useObservable(model);
  return <div className="statusbar">{model.currentMessage()}</div>;
}
