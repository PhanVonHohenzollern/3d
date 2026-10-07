import { nativeApiSignatures } from '@engine/runtime/ApiMetadata';
import { builtinFunction } from '@engine/runtime/helpers/builtinFunctions';
import {
  functionParameters,
  functionSignature,
  parameterDefaultExpression,
  requiredParameterCount,
} from '@engine/runtime/helpers/functionSignatures';
import { parseCallArguments, splitTopLevel, TokKind, type Token } from '@engine/runtime/helpers/tokens';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import type { Execution } from '@engine/runtime/interpreter/execution';
import type { Statement, StatementVisitor } from '@engine/runtime/interpreter/Statement';
import { languageIntrinsic, sdkIntrinsic } from '@engine/runtime/intrinsics';

export class FunctionValidator implements StatementVisitor<void> {
  constructor(private readonly x: Execution) {}

  visitBlock(node: Statement): void {
    node.children.forEach((child) => child.accept(this, undefined));
  }

  visitSimple(node: Statement): void {
    this.check(node.tokens);
  }

  visitFunction(node: Statement): void {
    functionParameters(node).forEach((param) => this.check(parameterDefaultExpression(param)));
    node.body?.accept(this, undefined);
  }

  visitIf(node: Statement): void {
    this.check(node.condition);
    node.thenBranch?.accept(this, undefined);
    node.elseBranch?.accept(this, undefined);
  }

  visitFor(node: Statement): void {
    this.check(node.forInit);
    this.check(node.forCondition);
    this.check(node.forIncrement);
    node.body?.accept(this, undefined);
  }

  visitWhile(node: Statement): void {
    this.check(node.condition);
    node.body?.accept(this, undefined);
  }

  visitDo(node: Statement): void {
    this.visitWhile(node);
  }

  visitSwitch(node: Statement): void {
    this.visitWhile(node);
  }

  visitCase(node: Statement): void {
    this.visitWhile(node);
  }

  visitEmpty(): void {}

  private check(tokens: readonly Token[]): void {
    const declared = parseRuntimeType(tokens, 0);
    const declarators = new Set<Token>();
    if (declared)
      for (const part of splitTopLevel(tokens.slice(declared.end), ',')) {
        const name = part.find((token) => token.kind === TokKind.Identifier);
        if (name) declarators.add(name);
      }
    tokens.forEach((token, index) => {
      const name = token.text;
      if (
        token.kind !== TokKind.Identifier ||
        tokens[index + 1]?.text !== '(' ||
        ['.', '->', '::'].includes(tokens[index - 1]?.text) ||
        declarators.has(token) ||
        ['sizeof', 'alignof', 'decltype', 'delete'].includes(name) ||
        builtinFunction(name) ||
        this.x.state.functionMacro(name) ||
        languageIntrinsic(name) ||
        sdkIntrinsic(name)
      )
        return;
      const functions = this.x.functions.get(name);
      const native = nativeApiSignatures(name).length > 0;
      if (!functions) {
        if (!native)
          this.x.state.addDiagnostic(
            token.line,
            (/^(make|add|draw)/.test(name) ? 'unknown native geometry API: ' : 'unknown function: ') + name,
          );

        return;
      }
      const count = parseCallArguments(tokens, index + 1).length;
      const matches = functions.filter(
        (fn) => count >= requiredParameterCount(fn) && count <= functionParameters(fn).length,
      );
      if (!matches.length) this.x.state.addDiagnostic(token.line, 'no matching overload: ' + name);
      else if (!native && matches.length === 1 && !matches[0].body)
        this.x.state.addDiagnostic(token.line, 'function declared but not defined: ' + functionSignature(matches[0]));
    });
  }
}
