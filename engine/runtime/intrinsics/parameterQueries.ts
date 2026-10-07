import { runtimeError, trim } from '@engine/runtime/cpp/cpp';
import { parameterDisplayText, parameterTextToValue, parameterType } from '@engine/runtime/helpers/parameters';
import { readLValue, writeLValue } from '@engine/runtime/helpers/lvalues';
import {
  balancedEnd,
  isIdentifier,
  isSymbol,
  sliceTokens,
  splitTopLevel,
  TokKind,
  tokensToExpression,
  type Token,
} from '@engine/runtime/helpers/tokens';
import type { RuntimeParameterRequest } from '@engine/runtime/RuntimeTypes';
import { isString, runtimeTypeName, runtimeValueToCompactString } from '@engine/runtime/RuntimeValue';
import { recordChange } from '@engine/runtime/interpreter/changes';
import type { LanguageIntrinsic, SdkIntrinsic, StaticParameterDecl } from '@engine/runtime/intrinsics/types';

// get_val("Name", variable): the Parameters panel's value for "Name", or the variable's own value.
export const getVal: LanguageIntrinsic = {
  kind: 'language',
  names: ['get_val'],
  readsParameters: true,
  statement({ state, evaluate, resolveLValue }, { argGroups, line }) {
    if (argGroups.length !== 2) throw runtimeError('get_val requires parameter name and destination');
    const name = evaluate(argGroups[0]);
    if (!isString(name)) throw runtimeError('get_val parameter name must be a string');
    const dest = resolveLValue(argGroups[1]);
    const before = readLValue(dest) ?? (state.pointerType(dest.path) === 'char*' ? '' : undefined);

    const configured = state.parameter(`${state.functionName}::${name}`) ?? state.parameter(name);
    if (configured !== undefined)
      recordChange(state, dest, { line, operation: 'get_val', expression: name, onlyIfChanged: true }, (current) =>
        parameterTextToValue(configured, current ?? before),
      );

    state.recordParameterRequest({
      ...(state.functionName ? { functionName: state.functionName } : {}),
      name,
      type: parameterType(before),
      defaultValue: parameterDisplayText(before),
      currentValue: parameterDisplayText(readLValue(dest) ?? before),
      sourceFunction: 'get_val',
      variableName: dest.path,
      line,
    });

    return 'done';
  },
  discover: discoverGetVal,
};

function discoverGetVal(
  tokens: readonly Token[],
  declarations: ReadonlyMap<string, StaticParameterDecl>,
): RuntimeParameterRequest[] {
  const out: RuntimeParameterRequest[] = [];

  for (let i = 0; i + 1 < tokens.length; ++i) {
    if (!isIdentifier(tokens[i], 'get_val') || !isSymbol(tokens[i + 1], '(')) continue;

    const close = balancedEnd(tokens, i + 1);
    if (close >= tokens.length) continue;

    const args = splitTopLevel(sliceTokens(tokens, i + 2, close), ',');
    if (args.length !== 2 || args[0].length !== 1 || args[0][0].kind !== TokKind.String) continue;

    const req: RuntimeParameterRequest = {
      name: args[0][0].text,
      type: '',
      defaultValue: '',
      currentValue: '',
      sourceFunction: 'get_val',
      variableName: trim(tokensToExpression(args[1])),
      line: tokens[i].line,
    };

    let baseVariable = '';
    for (const t of args[1]) {
      if (t.kind === TokKind.Identifier) {
        baseVariable = t.text;
        break;
      }
    }
    const decl = declarations.get(baseVariable);
    if (decl !== undefined) {
      req.type = decl.type;
      req.defaultValue = decl.defaultValue;
    } else {
      req.type = 'unknown';
      req.defaultValue = '0';
    }
    req.currentValue = req.defaultValue;

    const duplicate = out.find((existing) => existing.name === req.name && existing.variableName === req.variableName);
    if (duplicate === undefined) out.push(req);
  }

  return out;
}

// get_fln_size("Link", variable) and its relatives: a connector property the Link panel supplies,
// keyed "Link:query".
export const connectorQueries: LanguageIntrinsic = {
  kind: 'language',
  names: ['get_fln_size', 'get_fln_thick', 'get_fln_diam', 'get_ldist', 'get_ext_diam'],
  readsParameters: true,
  discover(tokens) {
    const requests: RuntimeParameterRequest[] = [];
    for (let i = 0; i + 2 < tokens.length; ++i) {
      const name = tokens[i].text;
      const query = kFlangeQueries[name] ?? (connectorQueries.names.includes(name) ? name : undefined);
      if (!query || !isSymbol(tokens[i + 1], '(') || tokens[i + 2].kind !== TokKind.String) continue;
      const key = `${tokens[i + 2].text}:${query}`;
      if (requests.some((request) => request.name === key)) continue;
      requests.push({
        functionName: '',
        name: key,
        type: 'double',
        defaultValue: '0',
        currentValue: '0',
        sourceFunction: query,
        variableName: '',
        line: tokens[i].line,
      });
    }

    return requests;
  },
  statement({ state, evaluate, resolveLValue }, { name, argGroups, line }) {
    if (argGroups.length < 2) return 'done';
    const id = evaluate(argGroups[0]);
    const dest = resolveLValue(argGroups[1]);
    const current = readLValue(dest);
    const key = (isString(id) ? id : '') + ':' + name;
    const request: RuntimeParameterRequest = {
      name: key,
      type: runtimeTypeName(current),
      defaultValue: runtimeValueToCompactString(current),
      currentValue: runtimeValueToCompactString(current),
      sourceFunction: name,
      variableName: dest.path,
      line,
    };
    state.recordParameterRequest(request);
    const configured = state.parameter(key);
    if (configured !== undefined) writeLValue(dest, parameterTextToValue(configured, current));

    return 'done';
  },
};

const kFlangeQueries: Readonly<Record<string, string>> = {
  GetFlgSize: 'get_fln_size',
  GetFlgThick: 'get_fln_thick',
  GetFlgDiam: 'get_fln_diam',
};

// GetFlgSize("Link") and friends: the same connector properties, returned as a value.
export const flangeQueries: SdkIntrinsic = {
  kind: 'sdk',
  names: Object.keys(kFlangeQueries),
  value({ state }, { name, line }, args) {
    if (args.length !== 1 || !isString(args[0])) throw runtimeError(name + ' requires a link identifier');
    const query = kFlangeQueries[name];
    const key = args[0] + ':' + query;
    const value = parameterTextToValue(state.parameter(key) ?? '0', 0.0);
    state.recordParameterRequest({
      name: key,
      type: 'double',
      defaultValue: '0',
      currentValue: runtimeValueToCompactString(value),
      sourceFunction: query,
      variableName: '',
      line,
    });

    return value;
  },
};
