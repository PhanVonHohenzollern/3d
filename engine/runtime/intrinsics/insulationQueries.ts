import { stdException, stod, stoll, trim } from '@engine/runtime/cpp/cpp';
import { isIdentifier, isSymbol, TokKind, type Token } from '@engine/runtime/helpers/tokens';
import type { RuntimeParameterRequest } from '@engine/runtime/RuntimeTypes';
import { isDouble, isInt } from '@engine/runtime/RuntimeValue';
import type { LanguageIntrinsic, StaticParameterDecl } from '@engine/runtime/intrinsics/types';

// SDK insulation queries: `if (getExtInsSize(size))` is true only when the user enabled that
// insulation, and then writes its thickness into `size`.
export const kInsulationQueries = ['getExtInsSize', 'getIntInsSize'] as const;

export type InsulationQuery = (typeof kInsulationQueries)[number];

export function isInsulationQuery(name: string | undefined): name is InsulationQuery {
  return kInsulationQueries.some((query) => query === name);
}

export const insulationQueries: LanguageIntrinsic = {
  kind: 'language',
  names: kInsulationQueries,
  expression({ state }, { name, argGroups, line }) {
    const [target] = argGroups;
    if (argGroups.length !== 1 || target.length !== 1 || target[0].kind !== TokKind.Identifier) return null;
    const destName = target[0].text;
    const configured = state.m_parameters.get(name);
    if (configured === undefined) return { value: false };
    const before = state.lookupValue(destName);
    let next = before;
    try {
      if (isDouble(before)) next = stod(trim(configured)).value;
      else if (isInt(before)) next = stoll(trim(configured)).value;
    } catch (e) {
      stdException(e);

      return { value: false };
    }
    state.setVariable(destName, next, true, line, name, configured);

    return { value: true };
  },
  discover: discoverInsulation,
};

// Insulation is an optional numeric query: the UI supplies its value only when enabled.
// One request per query per statement; the scanner removes repeats across statements.
function discoverInsulation(
  tokens: readonly Token[],
  declarations: ReadonlyMap<string, StaticParameterDecl>,
): RuntimeParameterRequest[] {
  const out: RuntimeParameterRequest[] = [];
  for (const query of kInsulationQueries)
    for (let i = 0; i + 3 < tokens.length; ++i) {
      if (
        !isIdentifier(tokens[i], query) ||
        !isSymbol(tokens[i + 1], '(') ||
        tokens[i + 2].kind !== TokKind.Identifier ||
        !isSymbol(tokens[i + 3], ')')
      )
        continue;
      if (['.', '->', '::'].includes(tokens[i - 1]?.text)) continue;
      const variableName = tokens[i + 2].text;
      const defaultValue = declarations.get(variableName)?.defaultValue ?? '0';
      out.push({
        name: query,
        type: 'double',
        defaultValue,
        currentValue: defaultValue,
        sourceFunction: query,
        variableName,
        line: tokens[i].line,
      });
      break;
    }

  return out;
}
