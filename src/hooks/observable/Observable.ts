export class Observable {
  #version = 0;
  #notifyScheduled = false;
  readonly #listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly version = (): number => this.#version;

  protected changed(): void {
    ++this.#version;
    if (this.#notifyScheduled) return;
    this.#notifyScheduled = true;
    queueMicrotask(() => {
      this.#notifyScheduled = false;
      for (const listener of [...this.#listeners]) listener();
    });
  }
}
