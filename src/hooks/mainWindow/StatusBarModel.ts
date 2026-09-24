import type { StatusTone } from '../../types/statusBar';
import { Observable } from '../observable/Observable';

export class StatusBarModel extends Observable {
  #message = '';
  #tone: StatusTone = 'info';
  #timer: ReturnType<typeof setTimeout> | undefined;

  currentMessage(): string {
    return this.#message;
  }

  currentTone(): StatusTone {
    return this.#tone;
  }

  showMessage(message: string, timeout = 0, tone: StatusTone = 'info'): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#message = message;
    this.#tone = tone;
    if (timeout > 0) this.#timer = setTimeout(() => this.clearMessage(), timeout);
    this.changed();
  }

  clearMessage(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#message = '';
    this.#tone = 'info';
    this.changed();
  }
}
