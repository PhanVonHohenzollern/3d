import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { allNativeApiSignatures } from '../../core/runtime/ApiMetadata';
import { kSdkConstants, kSdkTypes } from '../../core/runtime/SdkDefinitions';

const keywords = `alignas alignof asm auto bool break case catch char char8_t char16_t char32_t class
const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete
do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long
mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast requires
return short signed sizeof static static_assert static_cast struct switch template this thread_local throw
true try typedef typeid typename union unsigned using virtual void volatile wchar_t while`.split(/\s+/);

const options = new Map<string, Completion>(keywords.map((label) => [label, { label, type: 'keyword' }]));
for (const type of kSdkTypes) {
  options.set(type.name, {
    label: type.name,
    type: 'type',
    detail: type.baseType + (type.arrayExtent ? `[${type.arrayExtent}]` : ''),
  });
}
for (const label of ['FdPoint3d', 'FdVector3d', 'AcGePoint3d', 'AcGeVector3d']) {
  options.set(label, { label, type: 'type' });
}
for (const constant of kSdkConstants) {
  options.set(constant.name, { label: constant.name, type: 'constant', detail: String(constant.value) });
}
const signatures = new Map<string, string[]>();
for (const signature of allNativeApiSignatures()) {
  const parameters = signature.parameters.map(
    (parameter) => `${parameter.type} ${parameter.name}${parameter.defaultValue ? ` = ${parameter.defaultValue}` : ''}`,
  );
  const overload = `${signature.returnType} ${signature.name}(${parameters.join(', ')})`;
  const overloads = signatures.get(signature.name) ?? [];
  if (!overloads.includes(overload)) overloads.push(overload);
  signatures.set(signature.name, overloads);
}
for (const [label, overloads] of signatures) {
  options.set(label, {
    label,
    type: 'function',
    detail: overloads.length > 1 ? `${overloads.length} overloads` : overloads[0],
    info: overloads.join('\n\n'),
  });
}

export function codeCompletions(context: CompletionContext): CompletionResult | null {
  const tree = ensureSyntaxTree(context.state, context.pos, 25) ?? syntaxTree(context.state);
  for (let node = tree.resolveInner(context.pos, -1); node;) {
    if (/Comment|String|CharLiteral/.test(node.name)) return null;
    if (!node.parent) break;
    node = node.parent;
  }
  const word = context.matchBefore(/[\w:]+/);
  if (!word && !context.explicit) return null;
  const candidates = new Map(options);
  tree.iterate({
    to: context.pos,
    enter(ref) {
      if (ref.name !== 'Identifier' || ref.to >= context.pos) return;
      let declarator = ref.node;
      // Follow only the declared name, never identifiers inside an initializer or array size.
      while (declarator.parent?.name.endsWith('Declarator')) {
        if (declarator.parent.firstChild?.from !== declarator.from) return;
        declarator = declarator.parent;
      }
      const declaration = declarator.parent;
      if (!declaration || !['Declaration', 'ParameterDeclaration', 'FunctionDefinition'].includes(declaration.name))
        return;
      for (let scope = declaration.parent; scope; scope = scope.parent) {
        if (['CompoundStatement', 'FunctionDefinition', 'ForStatement'].includes(scope.name) && scope.to < context.pos)
          return;
      }
      const label = context.state.sliceDoc(ref.from, ref.to);
      candidates.set(label, {
        label,
        type: declarator.name === 'FunctionDeclarator' ? 'function' : 'variable',
        detail: 'Local declaration',
        boost: 5,
      });
    },
  });
  return { from: word?.from ?? context.pos, options: [...candidates.values()], validFor: /^[\w:]*$/ };
}
