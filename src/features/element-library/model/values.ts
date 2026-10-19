export function sameValue(a: string | undefined, b: string | undefined): boolean {
  const normalize = (value: string | undefined) => {
    if (value === 'true') return '1';
    if (value === 'false') return '0';

    return value?.trim() && Number.isFinite(Number(value)) ? String(Number(value)) : value;
  };

  return normalize(a) === normalize(b);
}
