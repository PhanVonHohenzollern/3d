import {
  emptyApiCall,
  emptyRuntimeResult,
  resolveApiSignature,
  RuntimeArray,
  what,
  type RuntimeValue,
} from '@engine/runtime';
import {
  connectorFrame,
  type ConnectorDefinition,
  type ConnectorExpressionEvaluator,
} from '@engine/geometry/ConnectorPreview';
import { PreviewGeometryEngine, type PreviewGeometryScene } from '@engine/geometry/PreviewGeometryEngine';

export interface PipeConnection {
  definition: ConnectorDefinition;
  type: 'neutral' | 'male' | 'female' | 'flanged';
  length: number;
  internalDiameter: number;
  externalDiameter: number;
  flangeSize: number;
  flangeThickness: number;
}

// FcCoolLink::Draw3d: build physical geometry behind the connection plane.
// The cyan Link overlay keeps its own dimensions, selection and visibility.
export function buildConnectionGeometry(
  connections: readonly PipeConnection[],
  evaluate: ConnectorExpressionEvaluator,
  externalInsulation?: number,
): PreviewGeometryScene {
  const scene: PreviewGeometryScene = { meshes: [], warnings: [] };
  for (const connection of connections) {
    const {
      definition,
      type,
      length,
      internalDiameter,
      externalDiameter: diameter,
      flangeSize,
      flangeThickness,
    } = connection;
    if (!definition.physical || definition.physical.draw === false) continue;
    if (type !== 'flanged' && length <= 0) continue;
    try {
      const { point: center, direction: normal } = connectorFrame(definition, evaluate);
      const runtime = emptyRuntimeResult();

      const call = (name: string, args: RuntimeValue[]) => {
        const api = emptyApiCall();
        api.name = name;
        api.arguments = args;
        api.signature = resolveApiSignature(api);
        runtime.apiCalls.push(api);
      };

      const tube = (offsets: number[], diameters: number[]) => {
        call('makeUniVectorTube', [
          new RuntimeArray(
            'FdPoint3d',
            [offsets.length],
            offsets.map((offset) => center.sub(normal.mul(offset))),
          ),
          normal,
          new RuntimeArray('double', [diameters.length], diameters),
          5n,
          BigInt(offsets.length - 1),
          true,
        ]);
      };

      if (type === 'flanged') {
        if (length === 0)
          tube([flangeThickness, flangeThickness, 0, 0], [diameter, flangeSize, flangeSize, internalDiameter]);
        else tube([length, flangeThickness, flangeThickness, 0, 0], [diameter, diameter, flangeSize, flangeSize, 0]);
        if (externalInsulation !== undefined && externalInsulation > 0) {
          call('setPrimitiveMode', [2n]);
          const start = length + flangeThickness + externalInsulation;
          tube(
            [start, start, 0, 0],
            [
              diameter + 2 * externalInsulation,
              flangeSize + 2 * externalInsulation,
              flangeSize + 2 * externalInsulation,
              flangeSize,
            ],
          );
          call('setPrimitiveMode', [0n]);
        }
      } else {
        call('makeSimpleTube', [center, center.sub(normal.mul(length)), diameter, diameter, 5n]);
        call('makeFlatDisc', [center, normal, diameter, 5n]);
      }
      const built = new PreviewGeometryEngine().build(runtime);
      for (const mesh of built.meshes) {
        mesh.apiIndex = -1;
        mesh.apiName = `connection:${definition.name}:${mesh.apiName}`;
      }
      scene.meshes.push(...built.meshes);
      scene.warnings.push(...built.warnings.map((warning) => `${definition.name}: ${warning}`));
    } catch (error) {
      scene.warnings.push(`${definition.name}: ${what(error)}`);
    }
  }

  return scene;
}
