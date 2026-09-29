import { runtimeError } from '@engine/runtime/cpp/cpp';
import { createArray } from '@engine/runtime/helpers/arrays';
import { builtinFunction } from '@engine/runtime/helpers/builtinFunctions';
import type { RuntimeFunctionMacro } from '@engine/runtime/helpers/macros';
import { isMutatingMethod } from '@engine/runtime/helpers/mutatingMethods';
import type { Token } from '@engine/runtime/helpers/tokens';
import { callMethod, indexValue, memberValue } from '@engine/runtime/helpers/valueMethods';
import {
  addValues,
  compareValues,
  divValues,
  equalValues,
  modValues,
  mulValues,
  negateValue,
  subValues,
} from '@engine/runtime/helpers/valueOperations';
import type { EvalContext } from '@engine/runtime/interpreter/evalContext';
import { parseExpression, type Expr, type PostfixStep } from '@engine/runtime/interpreter/expressions';
import { Lexer } from '@engine/runtime/interpreter/Lexer';
import { runtimeCoerceToType, runtimeInteger, runtimeTruthy, type RuntimeValue } from '@engine/runtime/RuntimeValue';
import { valueTypeOf } from '@engine/runtime/values/registry';
import { isVectorEnd } from '@engine/runtime/values/stdVector';

// Evaluates an expression in `context`. Nothing here changes state itself: calls and mutating
// methods go through the context.
export function evaluateExpression(tokens: readonly Token[], context: EvalContext): RuntimeValue {
  const tree = parseExpression(tokens);

  return tree ? new Evaluator(context).evaluate(tree) : undefined;
}

const kMacroTrees = new WeakMap<RuntimeFunctionMacro, readonly Token[]>();

class Evaluator {
  constructor(private readonly context: EvalContext) {}

  // `enabled` is false in a branch that does not run (the right side of a false `&&`): nothing is
  // evaluated there, but a syntax error in it still counts.
  evaluate(expr: Expr, enabled = true): RuntimeValue {
    if (!enabled) {
      if (expr.failure !== undefined) throw runtimeError(expr.failure);

      return 0n;
    }
    switch (expr.kind) {
      case 'literal':
        return expr.value;
      case 'constant':
        return expr.make();
      case 'error':
        throw runtimeError(expr.message);
      case 'name':
      case 'scoped':
      case 'postfix':
        return this.postfix(expr);
      case 'call':
        return this.call(expr.name, expr.argGroups, expr.line);
      case 'unary':
        return this.unary(expr.op, this.evaluate(expr.operand));
      case 'update':
        if (!this.context.updateValue) throw runtimeError('increment/decrement requires an execution context');

        return this.context.updateValue(this.updateTarget(expr.operand), expr.op, expr.prefix, expr.line);
      case 'cast':
        return runtimeCoerceToType(this.evaluate(expr.operand), expr.type);
      case 'binary':
        return binary(expr.op, this.evaluate(expr.left), this.evaluate(expr.right));
      case 'logical': {
        const left = runtimeTruthy(this.evaluate(expr.left));
        const right = this.evaluate(expr.right, expr.op === '&&' ? left : !left);

        return expr.op === '&&' ? left && runtimeTruthy(right) : left || runtimeTruthy(right);
      }
      case 'conditional': {
        const condition = runtimeTruthy(this.evaluate(expr.condition));
        const yes = this.evaluate(expr.yes, condition);
        const no = this.evaluate(expr.no, !condition);

        return condition ? yes : no;
      }
      case 'sequence': {
        let value: RuntimeValue;
        for (const item of expr.items) value = this.evaluate(item);

        return value;
      }
      case 'new': {
        const dims = expr.dims.map((dim) => Number(runtimeInteger(this.evaluate(dim))));

        return createArray(expr.type, dims);
      }
    }
  }

  private unary(op: string, value: RuntimeValue): RuntimeValue {
    if (op === '!') return !runtimeTruthy(value);
    if (op === '-') return negateValue(value);

    return ~runtimeInteger(value);
  }

  private updateTarget(expr: Expr): Token[] {
    if (expr.kind === 'name') return [expr.token];
    if (expr.kind === 'sequence' && expr.items.length === 1) return this.updateTarget(expr.items[0]);
    if (expr.kind === 'postfix') {
      const target = this.updateTarget(expr.base);
      for (const step of expr.steps) {
        if (step.kind === 'index')
          target.push(...Lexer.scanExpression(`[${runtimeInteger(this.evaluate(step.index))}]`));
        else if (step.kind === 'member') target.push(...step.source);
        else throw runtimeError('increment/decrement requires an assignable value');
      }

      return target;
    }
    throw runtimeError('increment/decrement requires an assignable value');
  }

  // A value followed by [index], .member and .method(args) steps. A path that starts at a variable
  // is a reference: mutating methods on it change the stored value.
  private postfix(expr: Expr): RuntimeValue {
    let base: Expr = expr;
    let steps: readonly PostfixStep[] = [];
    if (expr.kind === 'postfix') ({ base, steps } = expr);
    let value: RuntimeValue;
    let reference: Token[] | undefined;
    if (base.kind === 'name') {
      value = this.context.lookupValue(base.name);
      reference = [base.token];
    } else if (base.kind === 'scoped') value = this.context.lookupValue(base.name);
    else value = this.evaluate(base);
    for (const step of steps) {
      if (step.kind === 'index') {
        const index = runtimeInteger(this.evaluate(step.index));
        value = indexValue(value, index);
        if (reference) reference = [...reference, ...Lexer.scanExpression(`[${index}]`)];
      } else if (step.kind === 'member') {
        value = memberValue(value, step.name);
        if (reference) reference = [...reference, ...step.source];
      } else {
        const elementReference = isVectorEnd(value, step.name);
        const args = step.args.map((arg) => this.evaluate(arg));
        if (
          reference &&
          this.context.mutateValue &&
          (isMutatingMethod(step.name) || valueTypeOf(value)?.changedInPlace)
        )
          value = this.context.mutateValue(reference, step.name, args, step.line);
        else value = callMethod(value, step.name, args);
        if (elementReference && reference) reference = [...reference, ...step.source];
        else if (!isMutatingMethod(step.name) || step.name === 'push_back') reference = undefined;
        if (step.name === 'push_back') value = undefined;
      }
    }

    return value;
  }

  // Built-in functions and macros run here; other calls go to the context (SDK and program
  // functions), with their arguments as written.
  private call(name: string, argGroups: readonly Token[][], line: number): RuntimeValue {
    const builtin = builtinFunction(name);
    const macro = builtin ? undefined : this.context.functionMacro(name);
    if (builtin || macro) {
      const args = argGroups.map((group) => {
        const tree = parseExpression(group);
        if (!tree) throw runtimeError("expected expression near ')'");

        return this.evaluate(tree);
      });
      if (builtin) return builtin(args);

      return this.expandMacro(name, macro!, args);
    }
    if (this.context.callFunction) return this.context.callFunction(name, argGroups, line);
    throw runtimeError('unsupported expression function: ' + name);
  }

  private expandMacro(name: string, macro: RuntimeFunctionMacro, args: readonly RuntimeValue[]): RuntimeValue {
    if (args.length !== macro.parameters.length)
      throw runtimeError(`macro ${name} expects ${macro.parameters.length} argument(s)`);
    const bindings = new Map(macro.parameters.map((parameter, i) => [parameter, args[i]]));
    let tokens = kMacroTrees.get(macro);
    if (!tokens) {
      tokens = Lexer.scanExpression(macro.expression);
      kMacroTrees.set(macro, tokens);
    }
    const expansion = tokens;

    return this.context.withBindings(bindings, () => evaluateExpression(expansion, this.context));
  }
}

function binary(op: string, left: RuntimeValue, right: RuntimeValue): RuntimeValue {
  switch (op) {
    case '|':
      return runtimeInteger(left) | runtimeInteger(right);
    case '^':
      return runtimeInteger(left) ^ runtimeInteger(right);
    case '&':
      return runtimeInteger(left) & runtimeInteger(right);
    case '==':
      return equalValues(left, right);
    case '!=':
      return !equalValues(left, right);
    case '<<':
    case '>>': {
      const shift = runtimeInteger(right);
      if (shift < 0n || shift >= 64n) throw runtimeError('shift count must be between 0 and 63');

      return op === '<<' ? runtimeInteger(left) << shift : runtimeInteger(left) >> shift;
    }
    case '+':
      return addValues(left, right);
    case '-':
      return subValues(left, right);
    case '*':
      return mulValues(left, right);
    case '/':
      return divValues(left, right);
    case '%':
      return modValues(left, right);
    default:
      return compareValues(op, left, right);
  }
}
