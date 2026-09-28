export class Signal<Args extends unknown[]> {
  readonly #slots: ((...args: Args) => void)[] = [];

  connect(slot: (...args: Args) => void): void {
    this.#slots.push(slot);
  }

  emit(...args: Args): void {
    for (const slot of [...this.#slots]) slot(...args);
  }
}
