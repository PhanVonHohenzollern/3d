// GL_LINES for WebGL2, drawn as screen-space quads.
//
// The C++ viewport draws lines with glLineWidth(1 / 1.4 / 2 / 3 / 4) under a
// 4x-multisampled OpenGL 3.3 core context. Native WebGL lines are unusable for
// that on two counts:
//  - the line width is clamped to 1 on virtually every platform, which would
//    make the selection outlines (3 px) and the selected-vector highlight
//    (4 px) indistinguishable from ordinary lines;
//  - Chrome's ANGLE drops a GL_LINES segment entirely when one vertex lies
//    behind the eye (clip w < 0) instead of clipping it. The world axes span
//    the whole scene, so at the default camera the X and Y axes vanished.
// Every line is therefore drawn as a quad with the same endpoints, colors,
// depth and width. As with glLineWidth, the width is in framebuffer (device)
// pixels and lines have no caps (a multisampled GL line is exactly such a
// rectangle). Segments are clipped to the view volume in the vertex shader,
// as the rasterizer does for lines on desktop OpenGL.

import { kVertexFloats } from './VertexArray';

/** Per quad vertex: endpoint A (xyz), endpoint B (xyz), color (rgb), corner (t, side). */
export const kLineQuadFloats = 11;
export const kLineQuadBytes = kLineQuadFloats * 4;
/** Two triangles per line segment. */
export const kLineQuadVerticesPerSegment = 6;

const kCorners: readonly (readonly [number, number])[] = [[0, -1], [0, 1], [1, -1], [1, -1], [0, 1], [1, 1]];

/**
 * Expands the GL_LINES vertex pairs src[first .. first + count) (interleaved
 * Viewport3D vertices) into quad vertices, 3 per source vertex.
 */
export function expandLineQuads(src: Float32Array, first: number, count: number): Float32Array {
  const segments = Math.floor(count / 2);
  const out = new Float32Array(segments * kLineQuadVerticesPerSegment * kLineQuadFloats);
  let o = 0;
  for (let s = 0; s < segments; ++s) {
    const a = (first + s * 2) * kVertexFloats;
    const b = a + kVertexFloats;
    for (const [t, side] of kCorners) {
      const c = t === 0 ? a : b;
      out[o++] = src[a]; out[o++] = src[a + 1]; out[o++] = src[a + 2];
      out[o++] = src[b]; out[o++] = src[b + 1]; out[o++] = src[b + 2];
      out[o++] = src[c + 3]; out[o++] = src[c + 4]; out[o++] = src[c + 5];
      out[o++] = t; out[o++] = side;
    }
  }
  return out;
}

export const kWideLineVertexShader = `#version 300 es
layout(location = 0) in vec3 aPositionA;
layout(location = 1) in vec3 aPositionB;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec2 aCorner;

uniform mat4 uMvp;
uniform vec2 uViewport;
uniform float uLineWidth;

out vec3 vColor;

// Liang-Barsky step against one clip plane; d0/d1 are the endpoint distances (inside >= 0).
bool clipPlane(float d0, float d1, inout float t0, inout float t1)
{
    if (d0 < 0.0 && d1 < 0.0) return false;
    if (d0 < 0.0) t0 = max(t0, d0 / (d0 - d1));
    else if (d1 < 0.0) t1 = min(t1, d0 / (d0 - d1));
    return t0 <= t1;
}

void main()
{
    vColor = aColor;
    vec4 a = uMvp * vec4(aPositionA, 1.0);
    vec4 b = uMvp * vec4(aPositionB, 1.0);

    // Clip the segment to the view volume before the perspective divide:
    // near and far exactly, the sides with a margin so lines still run past
    // the viewport edges. The rasterizer then never has to clip; ANGLE
    // mis-rasterized quads whose vertices lay far outside the viewport.
    const float margin = 1.05;
    float t0 = 0.0;
    float t1 = 1.0;
    bool visible = clipPlane(a.w + a.z, b.w + b.z, t0, t1)
        && clipPlane(a.w - a.z, b.w - b.z, t0, t1)
        && clipPlane(margin * a.w + a.x, margin * b.w + b.x, t0, t1)
        && clipPlane(margin * a.w - a.x, margin * b.w - b.x, t0, t1)
        && clipPlane(margin * a.w + a.y, margin * b.w + b.y, t0, t1)
        && clipPlane(margin * a.w - a.y, margin * b.w - b.y, t0, t1);
    if (!visible) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    vec4 ca = mix(a, b, t0);
    vec4 cb = mix(a, b, t1);

    vec2 halfViewport = 0.5 * uViewport;
    vec2 sa = ca.xy / ca.w * halfViewport;
    vec2 sb = cb.xy / cb.w * halfViewport;
    vec2 direction = sb - sa;
    float len = length(direction);
    direction = len > 1e-6 ? direction / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    vec4 position = aCorner.x < 0.5 ? ca : cb;
    position.xy += normal * (aCorner.y * 0.5 * uLineWidth) / halfViewport * position.w;
    gl_Position = position;
}
`;

export const kWideLineFragmentShader = `#version 300 es
precision highp float;
in vec3 vColor;

uniform bool uUseOverrideColor;
uniform vec3 uOverrideColor;

out vec4 fragColor;

void main()
{
    fragColor = vec4(uUseOverrideColor ? uOverrideColor : vColor, 1.0);
}
`;

/** QOpenGLShaderProgram::addShaderFromSourceCode + link; logs failures like Qt does. */
export function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      console.warn('Viewport3D: shader compilation failed:', gl.getShaderInfoLog(shader));
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (!gl.isContextLost()) console.warn('Viewport3D: shader program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
