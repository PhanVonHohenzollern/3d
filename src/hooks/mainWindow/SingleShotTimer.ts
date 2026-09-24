export class SingleShotTimer {
  #id: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly interval: number,
    private readonly timeout: () => void,
  ) {}

  start(): void {
    this.stop();
    this.#id = setTimeout(() => {
      this.#id = undefined;
      this.timeout();
    }, this.interval);
  }

  stop(): void {
    if (this.#id !== undefined) clearTimeout(this.#id);
    this.#id = undefined;
  }
}
