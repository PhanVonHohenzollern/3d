import { runtimeError } from '@engine/runtime/cpp/cpp';
import { braceListItems, createArray, inferArrayDimensions, isBraceList } from '@engine/runtime/helpers/arrays';
import {
  isIdentifier,
  isSymbol,
  matchingBracketEnd,
  sliceTokens,
  splitTopLevel,
  TokKind,
  tokensToExpression,
  tokensToText,
  type Token,
} from '@engine/runtime/helpers/tokens';
import { parseRuntimeType } from '@engine/runtime/helpers/typeNames';
import type { Execution } from '@engine/runtime/interpreter/execution';
import {
  isArray,
  runtimeCoerceToType,
  runtimeDeepCopy,
  runtimeDefaultValueForType,
  runtimeInteger,
  RuntimeStdVector,
  runtimeValueConstructor,
  stdVectorElementType,
  type RuntimeValue,
} from '@engine/runtime/RuntimeValue';
import { sdkTypeDefinition } from '@engine/runtime/SdkDefinitions';
import { valueTypeNamed, valueTypeOf } from '@engine/runtime/values/registry';

// Declarations and their initializers: `T a = e;`, `T a(args);`, `T a{...};`, arrays with brace
// lists and inferred dimensions, std::vector constructors and SDK value constructors.
export class DeclarationEvaluator {
  constructor(private readonly x: Execution) {}

  private initializerValue(
    tokens: readonly Token[],
    type: string,
    dims: readonly number[],
    level: number,
  ): RuntimeValue {
    if (level >= dims.length)
      return isBraceList(tokens)
        ? this.directInitializer(type, tokens)
        : runtimeCoerceToType(this.x.evaluate(tokens), type);
    const array = createArray(type, dims, level);
    if (tokens.length === 0) return array;
    if (!isBraceList(tokens)) {
      if (dims[level] > 0) array.elements[0] = this.initializerValue(tokens, type, dims, level + 1);

      return array;
    }
    const parts = braceListItems(tokens);
    if (parts.at(-1)?.length === 0) parts.pop();
    let cursor = 0;

    const fill = (target: typeof array) => {
      for (let i = 0; i < target.elements.length && cursor < parts.length; ++i) {
        const child = target.elements[i];
        if (isArray(child)) {
          if (isBraceList(parts[cursor]))
            target.elements[i] = this.initializerValue(parts[cursor++], type, child.dimensions, 0);
          else fill(child);
        } else {
          const part = parts[cursor++];
          if (part.length)
            target.elements[i] = isBraceList(part)
              ? this.directInitializer(type, part)
              : runtimeCoerceToType(this.x.evaluate(part), type);
        }
      }
    };

    fill(array);

    return array;
  }

  directInitializer(type: string, tail: readonly Token[]): RuntimeValue {
    const braces = isBraceList(tail);
    if (!braces && (tail.length < 2 || !isSymbol(tail[0], '(') || !isSymbol(tail[tail.length - 1], ')')))
      throw runtimeError('invalid direct initializer');
    const inner = sliceTokens(tail, 1, tail.length - 1);
    const args = splitTopLevel(inner, ',');
    if (braces && args.at(-1)?.length === 0) args.pop();
    if (braces && inner.length === 0) return runtimeDefaultValueForType(type);
    const elementType = stdVectorElementType(type);
    if (elementType) {
      if (inner.length === 0) return new RuntimeStdVector(elementType);
      if (braces)
        return new RuntimeStdVector(
          elementType,
          args.map((arg) =>
            runtimeDeepCopy(
              isBraceList(arg)
                ? this.directInitializer(elementType, arg)
                : runtimeCoerceToType(this.x.evaluate(arg), elementType),
            ),
          ),
        );
      const values = args.map((arg) => this.x.evaluate(arg));
      if (values.length === 1 && values[0] instanceof RuntimeStdVector) return runtimeCoerceToType(values[0], type);
      if (values.length < 1 || values.length > 2) throw runtimeError('unsupported constructor for ' + type);
      const array = createArray(elementType, [Number(runtimeInteger(values[0]))]);
      if (values.length === 2)
        array.elements = array.elements.map(() => runtimeDeepCopy(runtimeCoerceToType(values[1], elementType)));

      return new RuntimeStdVector(elementType, array.elements);
    }
    // An SDK value type: T v; T v(); T v(x, y, z); T v(other). Other argument counts fall through.
    const construct = runtimeValueConstructor(type);
    if (construct && (inner.length === 0 || args.length === 3 || valueTypeNamed(type)?.changedInPlace))
      return construct(inner.length ? args.map((arg) => this.x.evaluate(arg)) : []);
    if (args.length === 1) return runtimeCoerceToType(this.x.evaluate(args[0]), type);
    throw runtimeError('unsupported direct initializer for ' + type);
  }

  private arrayDimensions(declarator: readonly Token[], start: number): { dims: number[]; end: number } {
    const dims: number[] = [];
    let p = start;
    while (p < declarator.length && isSymbol(declarator[p], '[')) {
      const begin = p + 1;
      p = matchingBracketEnd(declarator, begin).end;
      const dimTokens = sliceTokens(declarator, begin, p);
      let n = 0;
      if (dimTokens.length !== 0) {
        const extent = runtimeInteger(this.x.evaluate(dimTokens));
        n = Number(extent > 0n ? extent : 0n);
      }
      dims.push(n);
      if (p < declarator.length && isSymbol(declarator[p], ']')) ++p;
    }

    return { dims, end: p };
  }

  declare(tokens: readonly Token[], line: number, userVariables = true): void {
    const parsed = parseRuntimeType(tokens, 0);
    if (!parsed) throw runtimeError('not a declaration');
    const alias = sdkTypeDefinition(parsed.type);
    const type = alias ? alias.baseType : parsed.type;
    for (const decl of splitTopLevel(sliceTokens(tokens, parsed.end, tokens.length), ',')) {
      if (decl.length === 0) continue;
      let p = 0;
      const parenthesizedPointer = decl[0]?.text === '(' && decl[1]?.text === '*';
      if (parenthesizedPointer) ++p;
      while (p < decl.length && (isSymbol(decl[p], '&') || isSymbol(decl[p], '*'))) ++p;
      if (p >= decl.length || decl[p].kind !== TokKind.Identifier)
        throw runtimeError('expected variable name in declaration');
      const name = decl[p++].text;
      if (parenthesizedPointer && decl[p]?.text === ')') ++p;
      const { dims, end } = this.arrayDimensions(decl, p);
      if (alias && alias.arrayExtent) dims.push(alias.arrayExtent);
      const tail = sliceTokens(decl, end, decl.length);
      const assigned = tail.length !== 0 && isSymbol(tail[0], '=');
      const initializer = assigned ? sliceTokens(tail, 1, tail.length) : tail;
      if (dims.length !== 0 && assigned) inferArrayDimensions(initializer, dims, 0);
      let value: RuntimeValue = dims.length === 0 ? runtimeDefaultValueForType(type) : createArray(type, dims);
      if (assigned) {
        if (initializer.length > 0 && isIdentifier(initializer[0], 'new')) value = this.x.evaluate(initializer);
        else if (dims.length !== 0) value = this.initializerValue(initializer, type, dims, 0);
        else
          value = isBraceList(initializer)
            ? this.directInitializer(type, initializer)
            : runtimeCoerceToType(this.x.evaluateAssignment(initializer), type);
      } else if (tail.length !== 0) {
        if (!isSymbol(tail[0], '(') && !isBraceList(tail))
          throw runtimeError('unsupported declaration tail near ' + tokensToText(tail));
        if (dims.length !== 0) throw runtimeError('array direct initialization is not supported');
        value = this.directInitializer(type, tail);
      }
      this.x.state.setVariable(
        name,
        runtimeDeepCopy(value),
        userVariables,
        line,
        'declare',
        tokensToExpression(initializer),
      );
      // getFaceForInit returns a C++ reference. Keep the same face instance for
      // reference declarations, while ordinary bowl assignments remain copies.
      if (decl.slice(0, p).some((token) => token.text === '&') && valueTypeOf(value)?.changedInPlace)
        this.x.state.bindValue(name, value);
    }
  }
}
