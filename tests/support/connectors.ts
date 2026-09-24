import type { ConnectorDefinition } from '../../src/geometry/ConnectorPreview';
import type { ConnectorDirective } from './fixtures';

export function connectorDefinition(d: ConnectorDirective): ConnectorDefinition {
  return {
    id: d.id, name: d.name, pointName: d.pointName, type: d.type, orientation: d.orientation,
    diameter: d.diameter, aSize: d.aSize, bSize: d.bSize, position: [...d.position], angles: [...d.angles],
  };
}

export const isLiteral = (s: string) => s.trim() === '' || /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s.trim());

/** Mirrors GeometryRuntime::evaluateNumericExpression for numeric literals only. */
export function literalEvaluator(expression: string): number {
  const field = expression.trim();
  if (field === '') throw new Error('enter a number, variable or expression');
  return Number(field);
}
