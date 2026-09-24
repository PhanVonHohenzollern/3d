import { Observable } from '../observable/Observable';

export class StatusBarModel extends Observable {
  #message = '';
  #timer: ReturnType<typeof setTimeout> | undefined;

  currentMessage(): string {
    return this.#message;
  }

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
