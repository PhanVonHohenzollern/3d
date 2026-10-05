import { functionSignature } from '@engine/runtime/helpers/functionSignatures';
import type { Statement } from '@engine/runtime/interpreter/Statement';
import type { RuntimeExecutionOptions } from '@engine/runtime/RuntimeTypes';

export const debugPause = Symbol('debug pause');

export class FunctionDebug {
  paused = false;
  depth = -1;
  apiIndex = -1;
  #occurrence = 0;

  constructor(private readonly target: RuntimeExecutionOptions['debugCall']) {}

  enter(fn: Statement, index: number, depth: number): boolean {
    if (!this.target || this.depth >= 0 || functionSignature(fn) !== this.target.signature) return false;
    if (this.#occurrence++ !== this.target.occurrence) return false;
    this.depth = depth;
    this.apiIndex = index;

    return true;
  }

  allows(line: number, depth: number, maxLine: number): boolean {
    if (!this.target) return depth > 0 || line <= maxLine;
    if (depth === this.depth && line > (this.target.line ?? Infinity)) this.pause();

    return true;
  }

  keepScope(endLine: number, depth: number, maxLine: number): boolean {
    return (
      this.paused ||
      (this.target
        ? depth === this.depth && endLine > (this.target.line ?? Infinity)
        : depth === 0 && endLine > maxLine)
    );
  }

  pause(): never {
    this.paused = true;
    throw debugPause;
  }
}
