// Port of runtime/ApiSemantics.{h,cpp}.
//
// Relationships refer to formal parameters in the matched overload, never to
// user variable names or the coincidental lengths of two runtime arrays.

import { apiParameterMetadataForCall } from './ApiMetadata';
import type { RuntimeApiCall } from './RuntimeTypes';
import { isArray, isDouble, isInt, runtimeInteger } from './RuntimeValue';

export type ApiAnchorBinding = 'None' | 'First' | 'Last' | 'SameIndex' | 'EveryPoint';
export type ApiArrayMeaning = 'Values' | 'Sections' | 'Endpoints' | 'ControlPoints' | 'Vertices';

export interface ApiParameterSemantics {
  role: string;
  anchorParameter: string;
  anchorBinding: ApiAnchorBinding;
  arrayMeaning: ApiArrayMeaning;
  countParameter: string;
  countOffset: number;
  fixedCount: number;
  output: boolean;
  elementRoles: string[];
}

function defaultSemantics(): ApiParameterSemantics {
  return {
    role: '', anchorParameter: '', anchorBinding: 'None', arrayMeaning: 'Values',
    countParameter: '', countOffset: 0, fixedCount: 0, output: false, elementRoles: [],
  };
}

const oneOf = (s: string, names: readonly string[]) => names.includes(s);

export function apiSemanticsForCall(call: RuntimeApiCall): ApiParameterSemantics[] {
  const metadata = apiParameterMetadataForCall(call);
  const result = metadata.map(defaultSemantics);
  if (call.userFunctionCall) return result;
  const set = (name: string, role: string, anchor = '', binding: ApiAnchorBinding = 'None') => {
    for (let i = 0; i < metadata.length; ++i) if (metadata[i].name === name) {
      result[i].role = role;
      result[i].anchorParameter = anchor;
      result[i].anchorBinding = binding;
    }
  };
  const array = (name: string, meaning: ApiArrayMeaning, count = '', offset = 0, fixed = 0) => {
    for (let i = 0; i < metadata.length; ++i) if (metadata[i].name === name) {
      result[i].arrayMeaning = meaning;
      result[i].countParameter = count;
      result[i].countOffset = offset;
      result[i].fixedCount = fixed;
    }
  };
  const roles = (name: string, labels: readonly string[]) => {
    for (let i = 0; i < metadata.length; ++i) if (metadata[i].name === name) result[i].elementRoles = [...labels];
  };
  const frame = (point: string, normal: string, up: string) => {
    set(point, 'Center');
    set(normal, 'Normal', point, 'First');
    set(up, 'Up direction', point, 'First');
  };
  const name = call.name;

  // Rectangular pp. 3-5, Circular pp. 14-28: count means segments,
  // hence count+1 section frames. Scalar frames can apply at every section.
  const box = oneOf(name, ['makeBox', 'makeBoxFromPlanes']);
  const tube = oneOf(name, ['makeTube', 'makeTruncatedTube', 'makeStraightTube', 'makeUniVectorTube', 'makeElbowedTube']);
  if (box || tube) {
    const centers = box ? 'centralPoints' : oneOf(name, ['makeTube', 'makeTruncatedTube']) ? 'centers' : 'centerPoints';
    const count = box ? 'count' : 'numOfSegs';
    set(count, 'Segment count');
    set(centers, 'Section centers');
    array(centers, 'Sections', count, 1);
    for (const v of ['vectors', 'normal', 'normals', 'upVectors', 'vector']) {
      set(v, v === 'upVectors' ? 'Section up direction' : 'Section normal', centers,
        v === 'vector' ? 'EveryPoint' : 'SameIndex');
      array(v, 'Sections', count, 1);
    }
    for (const d of ['width', 'tabWidth', 'height', 'tabHeight', 'diams']) {
      set(d, oneOf(d, ['width', 'tabWidth']) ? 'Section width' : oneOf(d, ['height', 'tabHeight']) ? 'Section height' : 'Section diameter',
        centers, 'SameIndex');
      array(d, 'Sections', count, 1);
    }
    set('diam', 'Diameter at every section');
    set('sides', 'Side visibility (4 per segment)');
    set('edges', 'Edge visibility');
    set('connector', 'End connectors');
    roles('connector', ['Start connector', 'End connector']);
    set('centerTr', 'Truncation plane center');
    set('normalTr', 'Truncation plane normal', 'centerTr', 'First');
  }
  if (oneOf(name, ['makeSimpleTube', 'makeVerySimpleTube', 'makeFacettedCylinder'])) {
    set('startPoint', 'Start point'); set('endPoint', 'End point'); set('endPointD', 'End point');
    set('FDcenterPoints', 'Start / end points');
    array('FDcenterPoints', 'Endpoints', '', 0, 2);
    set('diam1', 'Start diameter'); set('diam2', 'End diameter'); set('diam', 'Diameter at both ends');
    set('upVectorD', 'Section up direction', 'startPoint', 'First');
  }
  if (oneOf(name, ['makeFlex', 'makeFlexRectR', 'makeFlexRectO', 'makeFlexRectA'])) {
    set('ctrlPnts', 'Control points');
    array('ctrlPnts', 'ControlPoints', 'numCtrlPnts');
    set('startTang', 'Start tangent', 'ctrlPnts', 'First');
    set('endTang', 'End tangent', 'ctrlPnts', 'Last');
  }

  // Explicit frame families from the current SDK headers. Only these named
  // contracts share a center/normal frame; unknown APIs stay unanchored.
  if (oneOf(name, ['makeFlatDisc', 'makeFlatRing', 'makeDisc', 'makeDonutSection', 'makeTubularBend',
    'addThinRect', 'addThinCircle', 'drawRectAsThinLines', 'addCenterArc', 'addCircularConnector',
    'addRectangularConnector', 'addEraseRect', 'addEraseCircle', 'addSymbolicFlangeRect',
    'makeKFSymbolCurved', 'makeKFSymbolFlat', 'makeRectHoles', 'makeRoundedRectHoles', 'makeAssemblyHole',
    'makeAssemblyHoles', 'makeCircleWithPlus', 'makeCircleWithMinus', 'makeCircleWithTriangle', 'makeBowTie',
    'makeHourGlass', 'makeDampers', 'makeSymbolicEllipse', 'makeSymbolicArc', 'makeSymbolicCircle', 'makeCircleSymbol',
    'makeZigZag', 'makeSymbolicRectangle', 'makeSilencerSymbol', 'makeInfinite', 'makeReversedSigma',
    'makeBowTieHatch', 'makeRectHatch', 'makeBowlWC', 'makeBowlSink', 'makeBowlBath', 'makeBowlShower']))
    frame('center', 'normal', 'upVector');
  if (oneOf(name, ['addSymbGrillRect', 'addSymbGrillCircle', 'addSymbGrillArc', 'addSymbGrillEllipse', 'makeRectFace']))
    frame('center', 'normal', 'upVect');
  if (oneOf(name, ['makePlane', 'makeDonutSection2'])) frame('cp', 'normal', 'upVector');
  if (oneOf(name, ['makeScrew', 'makeScrew2'])) frame('cp', 'vector', 'upVector');
  if (name === 'makeKRS') frame('cp', 'v', '');
  if (oneOf(name, ['makeRectSimpleGrill', 'makeCircSimpleGrill'])) frame('cpF', 'normalF', '');
  if (name === 'makeCurvedLamel') frame('pcF', 'normalF', 'upVectorF');
  if (oneOf(name, ['makeConnector', 'makeBend2', 'makeRectBend', 'makeSymetricBend', 'makeEllipticalPlane']))
    frame('centralPoint', 'vector', 'upVector');
  if (name === 'makeBend') frame('centralPoint', 'Vector', 'upVector');
  if (oneOf(name, ['makeRectGrillType1', 'makeRectGrillType2', 'makeRectGrillType3', 'makeRectGrillType4', 'makeRectGrillType5', 'makeRectGrillType6', 'makeRectGrillType7']))
    frame('centralPoint', 'vector', 'upVectorD');
  if (oneOf(name, ['makeGrillType1', 'makeGrillType2', 'makeGrillType3', 'makeGrillType4', 'makeGrillType5', 'makeGrillType6', 'makeGrillType7']))
    frame('centralPointD', 'vectorD', 'upVectorD');
  if (oneOf(name, ['makeTubeToTubeIntersection', 'makeTubeToTubeIntersection2', 'makeRectToTubeIntersection', 'makeRectToTubeTransition',
    'makeVascoStraight', 'makeVascoElbowV', 'makeVascoElbowH', 'makeVascoTransition', 'makeVascoElbowTransition', 'makeVascoVascoPlenum1', 'makeVascoVascoPlenum2'])) {
    frame('start', 'normal', 'upVector');
    set('start', 'Start section center');
  }
  if (name === 'makeEllipticalPlane') set('vector', 'Beginning tangent', 'centralPoint', 'First');
  if (name === 'makeSpheroidSection') {
    frame('centroid', 'normal', 'bVector');
    set('normal', 'A axis', 'centroid', 'First');
    set('bVector', 'B axis', 'centroid', 'First');
    roles('diams', ['A diameter', 'B diameter', 'C diameter']);
    roles('latAngles', ['Start latitude', 'End latitude']);
    roles('longAngles', ['Start longitude', 'End longitude']);
    roles('n', ['Latitude subdivisions', 'Longitude subdivisions']);
  }
  if (oneOf(name, ['makeDonutSection', 'makeTubularBend', 'addCenterArc', 'addSymbGrillArc', 'addSymbGrillEllipse', 'makeSymbolicArc', 'makeSymbolicEllipse'])) {
    for (const v of ['radVec', 'radAVec', 'radVect', 'radiusVector'])
      set(v, 'Radial direction', 'center', 'First');
    set('normal', 'Rotation axis', 'center', 'First');
    set('radius', 'Bend / arc radius'); set('sweepAngle', 'Sweep angle');
  }
  if (name === 'makeRectToTubeTransition') {
    set('start', 'Rectangular section center'); set('tubeStart', 'Tube section start');
    set('corners', 'Rectangular section corners'); array('corners', 'Vertices', '', 0, 4);
    roles('heightWidth', ['Rectangle height', 'Rectangle width']);
    roles('tubeDiams', ['Tube A diameter', 'Tube B diameter', 'Tube length']);
  }
  if (oneOf(name, ['makeTubeToTubeIntersection', 'makeRectToTubeIntersection'])) {
    roles('tubeParams', ['Main tube A diameter', 'Main tube B diameter', 'Main tube length']);
    roles('ductPosition', ['Offset along main axis', 'Offset along A axis']);
    roles('ductParams', ['Duct width', 'Duct height', 'Duct length']);
    roles('interTubePosition', ['Offset along main axis', 'Offset along A axis']);
    roles('interTubeParams', ['Branch A diameter', 'Branch B diameter', 'Branch length']);
  }
  if (oneOf(name, ['makePlane', 'makeRotatablePlane'])) {
    set('points', 'Face vertices'); array('points', 'Vertices', '', 0, 4);
    for (const p of ['p1', 'p2', 'p3', 'p4']) set(p, 'Face vertex');
  }
  if (name === 'makeRotatablePlane') {
    set('rotPoint', 'Rotation origin');
    set('rotAxisVector', 'Rotation axis', 'rotPoint', 'First');
  }
  if (oneOf(name, ['addCenterPolyLine', 'makePolygonalHatch'])) {
    set('vertices', 'Polyline vertices');
    array('vertices', 'Vertices', name === 'addCenterPolyLine' ? 'numOfLines' : 'n', name === 'addCenterPolyLine' ? 1 : 0);
  }
  if (oneOf(name, ['addThinLine', 'drawAsThinLine', 'addCenterLine', 'addEraseLine', 'addSymbGrillLine', 'makeSymbolicLine'])) {
    set('start', 'Start point'); set('end', 'End point');
  }
  if (oneOf(name, ['lineToLineInt', 'lineSegToLineSegInt'])) {
    set('line1Beg', 'Line 1 start'); set('line1End', 'Line 1 end');
    set('line2Beg', 'Line 2 start'); set('line2End', 'Line 2 end');
    set('intPoint', 'Intersection output');
  }
  for (let i = 0; i < metadata.length; ++i) {
    const p = metadata[i].name;
    if (p === 'visVector') result[i].role = 'Visibility direction';
    if (p === 'exceptionVector') result[i].role = 'Visibility exception direction';
    if ((oneOf(name, ['makeBend2']) && oneOf(p, ['outP1', 'outP2', 'outEllipse']))
      || (oneOf(name, ['lineToLineInt', 'lineSegToLineSegInt']) && p === 'intPoint')
      || (name === 'calcEAPoints' && oneOf(p, ['WD', 'dist']))) {
      result[i].output = true;
      result[i].role = 'Output (input snapshot)';
    }
  }
  return result;
}

export function apiUsedElementCount(call: RuntimeApiCall, s: ApiParameterSemantics, available: number): number {
  if (s.fixedCount > 0) return Math.min(available, s.fixedCount);
  if (s.countParameter === '') return available;
  const metadata = apiParameterMetadataForCall(call);
  for (let i = 0; i < Math.min(metadata.length, call.arguments.length); ++i) {
    if (metadata[i].name !== s.countParameter) continue;
    const argument = call.arguments[i];
    if (!isDouble(argument) && !isInt(argument)) return available;
    const count = runtimeInteger(argument);
    if (count < 0n) return 0;
    return Math.min(available, Number(count) + s.countOffset);
  }
  return available;
}

export function apiParameterRole(call: RuntimeApiCall, parameter: number, indices: readonly number[] = []): string {
  const semantics = apiSemanticsForCall(call);
  if (parameter >= semantics.length) return '';
  const s = semantics[parameter];
  if (indices.length === 0) return s.role;
  const index = indices[0];
  if (index < s.elementRoles.length) return s.elementRoles[index];
  const argument = parameter < call.arguments.length ? call.arguments[parameter] : undefined;
  const a = isArray(argument) ? argument : null;
  const count = a ? apiUsedElementCount(call, s, a.elements.length) : 0;
  if (a && index >= count) return 'Unused by this call';
  if (s.arrayMeaning === 'Endpoints') return index === 0 ? 'Start point' : 'End point';
  let position = '';
  if (s.arrayMeaning === 'Sections')
    position = count === 1 ? 'Only section' : index === 0 ? 'Start' : index + 1 === count ? 'End' : `Section ${index}`;
  else if (s.arrayMeaning === 'ControlPoints')
    position = index === 0 ? 'Start control point' : index + 1 === count ? 'End control point' : `Control point ${index}`;
  else if (s.arrayMeaning === 'Vertices') position = `Vertex ${index}`;
  if (indices.length === 2 && s.role === 'Section diameter')
    return position + (indices[1] === 0 ? ': A diameter (up direction)' : ': B diameter');
  return position === '' ? s.role : position + (s.role === '' ? '' : `: ${s.role}`);
}
