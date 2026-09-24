export class CppException extends Error {
  constructor(
    readonly kind: 'runtime_error' | 'invalid_argument' | 'out_of_range' | 'logic_error',
    what: string,
  ) {
    super(what);
  }
}

export function what(e: unknown): string {
  if (e instanceof Error) return e.message;

  return String(e);
}

export function vectorAt<T>(v: readonly T[], n: number): T {
  if (n < 0 || n >= v.length || !Number.isInteger(n))
    throw new CppException(
      'out_of_range',
      `vector::_M_range_check: __n (which is ${n}) >= this->size() (which is ${v.length})`,
    );

  return v[n];
}

export const isspace = (ch: string | undefined): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\f' || ch === '\r';

export const isdigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

export const isalpha = (ch: string | undefined): boolean =>
  ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));

export const isalnum = (ch: string | undefined): boolean => isalpha(ch) || isdigit(ch);

export const isxdigit = (ch: string | undefined): boolean =>
  isdigit(ch) || (ch !== undefined && ((ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')));

export const INT64_MIN = -(1n << 63n);
export const INT64_MAX = (1n << 63n) - 1n;

export function doubleToInt64(value: number): bigint {
  if (!Number.isFinite(value) || value >= 9223372036854775808 || value < -9223372036854775808) return INT64_MIN;

  return BigInt(Math.trunc(value));
}

export const wrapInt64 = (value: bigint): bigint => BigInt.asIntN(64, value);

interface ExactDecimal {
  digits: bigint;
  scale: number;
}

function exactDecimal(x: number): ExactDecimal {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(x));
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const biased = (hi >>> 20) & 0x7ff;
  let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exponent: number;
  if (biased === 0) exponent = -1074;
  else {
    mantissa |= 1n << 52n;
    exponent = biased - 1075;
  }
  if (exponent >= 0) return { digits: mantissa << BigInt(exponent), scale: 0 };

  return { digits: mantissa * 5n ** BigInt(-exponent), scale: -exponent };
}

function roundScaled(d: ExactDecimal, p: number): bigint {
  if (d.scale <= p) return d.digits * 10n ** BigInt(p - d.scale);
  const divisor = 10n ** BigInt(d.scale - p);
  let q = d.digits / divisor;
  const twice = (d.digits % divisor) * 2n;
  if (twice > divisor || (twice === divisor && (q & 1n) === 1n)) q += 1n;

  return q;
}

const isNegative = (x: number) => x < 0 || Object.is(x, -0);

function nonFinite(x: number): string {
  if (Number.isNaN(x)) return 'nan';

  return x < 0 ? '-inf' : 'inf';
}

function insertPoint(digits: string, precision: number): string {
  if (precision <= 0) return digits;
  const padded = digits.padStart(precision + 1, '0');

  return `${padded.slice(0, -precision)}.${padded.slice(-precision)}`;
}

export function formatFixed(x: number, precision = 6): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const q = roundScaled(exactDecimal(x), precision);

  return (isNegative(x) ? '-' : '') + insertPoint(q.toString(), precision);
}

function scientificParts(x: number, precision: number): { mantissa: bigint; exponent: number } {
  const d = exactDecimal(x);
  if (d.digits === 0n) return { mantissa: 0n, exponent: 0 };
  let exponent = d.digits.toString().length - 1 - d.scale;
  let mantissa = roundScaled(d, precision - exponent);
  if (mantissa >= 10n ** BigInt(precision + 1)) {
    mantissa /= 10n;
    exponent += 1;
  }

  return { mantissa, exponent };
}

function exponentSuffix(exponent: number): string {
  const magnitude = Math.abs(exponent).toString().padStart(2, '0');

  return `e${exponent < 0 ? '-' : '+'}${magnitude}`;
}

export function formatScientific(x: number, precision = 6): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const { mantissa, exponent } = scientificParts(x, precision);

  return (isNegative(x) ? '-' : '') + insertPoint(mantissa.toString(), precision) + exponentSuffix(exponent);
}

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  s = s.replace(/0+$/, '');

  return s.endsWith('.') ? s.slice(0, -1) : s;
}

export function formatGeneral(x: number, precision = 6): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const p = precision === 0 ? 1 : precision;
  const { exponent } = scientificParts(x, p - 1);
  if (p > exponent && exponent >= -4) return stripTrailingZeros(formatFixed(x, p - 1 - exponent));
  const s = formatScientific(x, p - 1);
  const e = s.indexOf('e');

  return stripTrailingZeros(s.slice(0, e)) + s.slice(e);
}

export const toStringDouble = (x: number): string => formatFixed(x, 6);

export function strtod(text: string, start = 0): { value: number; end: number; erange: boolean } {
  let i = start;
  while (isspace(text[i])) ++i;
  let sign = 1;
  if (text[i] === '+' || text[i] === '-') {
    if (text[i] === '-') sign = -1;
    ++i;
  }
  const rest = text.slice(i);
  const special = /^(inf(inity)?|nan(\([0-9A-Za-z_]*\))?)/i.exec(rest);
  if (special) {
    const value = special[0][0].toLowerCase() === 'i' ? Infinity : NaN;

    return { value: sign * value, end: i + special[0].length, erange: false };
  }
  const hex = /^0[xX]((?:[0-9a-fA-F]+\.?[0-9a-fA-F]*|\.[0-9a-fA-F]+))(?:[pP]([+-]?\d+))?/.exec(rest);
  if (hex && /[0-9a-fA-F]/.test(hex[1])) {
    const [intPart, fracPart = ''] = hex[1].split('.');
    let value = 0;
    for (const ch of intPart) value = value * 16 + parseInt(ch, 16);
    let scale = 1 / 16;
    for (const ch of fracPart) {
      value += parseInt(ch, 16) * scale;
      scale /= 16;
    }
    value *= 2 ** Number(hex[2] ?? 0);

    return { value: sign * value, end: i + hex[0].length, erange: !Number.isFinite(value) };
  }
  const dec = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
  if (!dec) return { value: 0, end: start, erange: false };
  const value = Number(dec[0]);
  const nonzeroDigits = /[1-9]/.test(dec[0].replace(/[eE].*$/, ''));
  const erange = !Number.isFinite(value) || (nonzeroDigits && Math.abs(value) < 2.2250738585072014e-308);

  return { value: sign * value, end: i + dec[0].length, erange };
}

export function stod(text: string): { value: number; used: number } {
  const { value, end, erange } = strtod(text);
  if (end === 0) throw new CppException('invalid_argument', 'stod');
  if (erange) throw new CppException('out_of_range', 'stod');

  return { value, used: end };
}

export function stoll(text: string): { value: bigint; used: number } {
  let i = 0;
  while (isspace(text[i])) ++i;
  const m = /^[+-]?\d+/.exec(text.slice(i));
  if (!m) throw new CppException('invalid_argument', 'stoll');
  const value = BigInt(m[0]);
  if (value < INT64_MIN || value > INT64_MAX) throw new CppException('out_of_range', 'stoll');

  return { value, used: i + m[0].length };
}

export function runtimeError(message: string): CppException {
  const limit = Error.stackTraceLimit;
  // Diagnostics are ordinary control flow (a runaway loop throws once per iteration); stack capture dominated run time.
  Error.stackTraceLimit = 0;
  try {
    return new CppException('runtime_error', message);
  } finally {
    Error.stackTraceLimit = limit;
  }
}

export function stdException(e: unknown): CppException {
  if (e instanceof CppException) return e;
  throw e;
}

export function trim(s: string): string {
  let begin = 0;
  let end = s.length;
  while (begin < end && isspace(s[begin])) ++begin;
  while (end > begin && isspace(s[end - 1])) --end;

  return s.slice(begin, end);
}

export const cppRound = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x));

export function cppPow(x: number, y: number): number {
  if (x === 1 || y === 0) return 1;
  if (x === -1 && (y === Infinity || y === -Infinity)) return 1;

  return Math.pow(x, y);
}
