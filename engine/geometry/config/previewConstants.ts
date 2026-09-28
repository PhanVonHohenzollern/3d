// Sizes and limits of the preview, in model units. The SDK draws symbols as lines; the preview turns
// them into thin meshes, and caps how finely it samples so a bad argument cannot freeze the page.

// Half the width of a symbol stroke ribbon.
export const kStrokeHalfWidth = 0.35;

// Zigzag lines: one tooth per this many units, this far off the line, at most this many teeth.
export const kZigzagStep = 5;
export const kZigzagAmplitude = 2;
export const kMaxZigzagTeeth = 512;

// Dashed lines: one dash per this many units, drawn for this fraction of it.
export const kDashLength = 12;
export const kDashFill = 0.65;
export const kMaxDashes = 2048;

// Planar arcs are sampled per radian; 3D symbolic arcs once every few degrees.
export const kArcSegmentsPerRadian = 24;
export const kMinArcSegments = 8;
export const kMaxArcSegments = 2048;
export const kSymbolArcStepDegrees = 3;

// The longest point list or segment count an adapter builds, and the finest ring or grid.
export const kMaxListLength = 4096;
export const kMaxRingSegments = 256;
