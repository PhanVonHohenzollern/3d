import { runtimeError } from '@engine/runtime/cpp/cpp';
import type { Token } from '@engine/runtime/helpers/tokens';
import type { RuntimeValue } from '@engine/runtime/RuntimeValue';
import type { RuntimeParameterRequest } from '@engine/runtime/RuntimeTypes';
import { insulationQueries } from '@engine/runtime/intrinsics/insulationQueries';
import { lineIntersections } from '@engine/runtime/intrinsics/lineIntersections';
import { connectorQueries, flangeQueries, getVal } from '@engine/runtime/intrinsics/parameterQueries';
import { pointOperations } from '@engine/runtime/intrinsics/pointOperations';
import { assertions, primitiveMode } from '@engine/runtime/intrinsics/programControl';
import type {
  Intrinsic,
  IntrinsicContext,
  LanguageIntrinsic,
  SdkIntrinsic,
  StaticParameterDecl,
} from '@engine/runtime/intrinsics/types';

// Every SDK function the interpreter implements. Source scanning discovers parameters in this order.
const kIntrinsics: readonly Intrinsic[] = [
  { kind: 'language', names: ['SEGNUM'], expression: () => ({ value: 16n }) },
  getVal,
  connectorQueries,
  insulationQueries,
  lineIntersections,
  primitiveMode,
  assertions,
  flangeQueries,
  pointOperations,
];

const kLanguage = new Map<string, LanguageIntrinsic>();
const kSdk = new Map<string, SdkIntrinsic>();
for (const intrinsic of kIntrinsics)
  for (const name of intrinsic.names) {
    if (kLanguage.has(name) || kSdk.has(name)) throw new Error(`intrinsic registered twice: ${name}`);
    if (intrinsic.kind === 'language') kLanguage.set(name, intrinsic);
    else kSdk.set(name, intrinsic);
  }

export function languageIntrinsic(name: string): LanguageIntrinsic | undefined {
  return kLanguage.get(name);
}

export function sdkIntrinsic(name: string): SdkIntrinsic | undefined {
  return kSdk.get(name);
}

// The parameter requests a statement makes, found without running it.
export function discoverParameters(
  tokens: readonly Token[],
  declarations: ReadonlyMap<string, StaticParameterDecl>,
): RuntimeParameterRequest[] {
  return kIntrinsics.flatMap((intrinsic) =>
    intrinsic.kind === 'language' && intrinsic.discover ? intrinsic.discover(tokens, declarations) : [],
  );
}

// A state's `callFunction` outside a program run (the Link evaluator's snapshot): only the
// intrinsics that work inside expressions are available there.
export function expressionIntrinsicCaller(
  context: IntrinsicContext,
): (name: string, argGroups: readonly Token[][], line: number) => RuntimeValue {
  return (name, argGroups, line) => {
    const result = languageIntrinsic(name)?.expression?.(context, { name, argGroups, line });
    if (!result) throw runtimeError('unsupported expression function: ' + name);

    return result.value;
  };
}

export { isBaseClassCall } from '@engine/runtime/intrinsics/programControl';
export { isInsulationQuery, kInsulationQueries } from '@engine/runtime/intrinsics/insulationQueries';
export type { InsulationQuery } from '@engine/runtime/intrinsics/insulationQueries';
export { seedSdkValues } from '@engine/runtime/intrinsics/sdkValues';
export type { IntrinsicCall, IntrinsicContext, StaticParameterDecl } from '@engine/runtime/intrinsics/types';
