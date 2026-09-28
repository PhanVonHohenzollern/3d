export class Signal<Args extends unknown[]> {
  readonly #slots: ((...args: Args) => void)[] = [];

  connect(slot: (...args: Args) => void): () => void {
    this.#slots.push(slot);

    return () => {
      const index = this.#slots.indexOf(slot);
      if (index >= 0) this.#slots.splice(index, 1);
    };
  }

  emit(...args: Args): void {
    for (const slot of [...this.#slots]) slot(...args);
  }
}
