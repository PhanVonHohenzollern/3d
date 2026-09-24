import type { GpuVertexLayout } from '../../types/viewportEngine';
import { QMatrix4x4 } from '../../utils/Matrix4x4';
import { QVector3D } from '../../utils/Vector3D';
import { createProgram } from './glProgram';
import { expandLineQuads, kLineQuadBytes, kLineQuadVerticesPerVertex } from './lineQuads';
import { kFragmentShader, kLineQuadFragmentShader, kLineQuadVertexShader, kVertexShader } from './shaders';
import { kVertexBytes, kVertexFloats, type VertexArray } from './VertexArray';

type BoolUniform = 'uUseOverrideColor' | 'uLightingEnabled';

interface MainProgram {
  program: WebGLProgram;
  uMvp: WebGLUniformLocation | null;
  uNormalMatrix: WebGLUniformLocation | null;
  uUseOverrideColor: WebGLUniformLocation | null;
  uOverrideColor: WebGLUniformLocation | null;
  uLightingEnabled: WebGLUniformLocation | null;
}

interface LineProgram {
  program: WebGLProgram;
  uMvp: WebGLUniformLocation | null;
  uViewport: WebGLUniformLocation | null;
  uLineWidth: WebGLUniformLocation | null;
  uUseOverrideColor: WebGLUniformLocation | null;
  uOverrideColor: WebGLUniformLocation | null;
}

interface QuadStream {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
}

const kEmptyLayout: GpuVertexLayout = {
  axesVertexCount: 0,
  geometryWireVertexStart: 0,
  geometryWireVertexCount: 0,
  vectorVertexStart: 0,
  connectorVertexStart: 0,
  connectorLineStart: 0,
  connectorLineCount: 0,
};

export class ViewportRenderer {
  private m_gl: WebGL2RenderingContext | null = null;
  private m_program: MainProgram | null = null;
  private m_vertexBuffer: WebGLBuffer | null = null;
  private m_vao: WebGLVertexArrayObject | null = null;
  private m_lineProgram: LineProgram | null = null;
  private m_wireQuads: QuadStream | null = null;
  private m_dynamicQuads: QuadStream | null = null;

  private m_layout: GpuVertexLayout = kEmptyLayout;
  private m_uploaded = { geometryVersion: -1, staticStart: -1, staticEnd: -1, capacity: 0 };
  private m_wireQuadVersion = -1;
  private m_dynamicQuadAxesVertices = 0;
  private m_dynamicQuadVectorVertices = 0;

  private m_mvp = new QMatrix4x4();
  private m_normalMatrix: Float32Array = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  private m_uniformUseOverrideColor = false;
  private m_uniformOverrideColor = new QVector3D();
  private m_uniformLightingEnabled = false;
  private m_lineWidth = 1;

  initialize(gl: WebGL2RenderingContext): boolean {
    this.release(false);
    this.m_gl = gl;

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.075, 0.078, 0.085, 1.0);

    const program = createProgram(gl, kVertexShader, kFragmentShader);
    const lineProgram = createProgram(gl, kLineQuadVertexShader, kLineQuadFragmentShader);
    if (!program) return false;
    this.m_program = {
      program,
      uMvp: gl.getUniformLocation(program, 'uMvp'),
      uNormalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
      uUseOverrideColor: gl.getUniformLocation(program, 'uUseOverrideColor'),
      uOverrideColor: gl.getUniformLocation(program, 'uOverrideColor'),
      uLightingEnabled: gl.getUniformLocation(program, 'uLightingEnabled'),
    };
    if (lineProgram) {
      this.m_lineProgram = {
        program: lineProgram,
        uMvp: gl.getUniformLocation(lineProgram, 'uMvp'),
        uViewport: gl.getUniformLocation(lineProgram, 'uViewport'),
        uLineWidth: gl.getUniformLocation(lineProgram, 'uLineWidth'),
        uUseOverrideColor: gl.getUniformLocation(lineProgram, 'uUseOverrideColor'),
        uOverrideColor: gl.getUniformLocation(lineProgram, 'uOverrideColor'),
      };
    }

    this.m_vao = gl.createVertexArray();
    gl.bindVertexArray(this.m_vao);
    this.m_vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_vertexBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, kVertexBytes, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, kVertexBytes, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, kVertexBytes, 6 * 4);
    gl.bindVertexArray(null);

    if (this.m_lineProgram) {
      this.m_wireQuads = this.createQuadStream(gl);
      this.m_dynamicQuads = this.createQuadStream(gl);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return true;
  }

  release(deleteObjects: boolean): void {
    const gl = this.m_gl;
    if (gl && deleteObjects) {
      if (this.m_vao) gl.deleteVertexArray(this.m_vao);
      if (this.m_vertexBuffer) gl.deleteBuffer(this.m_vertexBuffer);
      if (this.m_program) gl.deleteProgram(this.m_program.program);
      if (this.m_lineProgram) gl.deleteProgram(this.m_lineProgram.program);
      for (const stream of [this.m_wireQuads, this.m_dynamicQuads]) {
        if (!stream) continue;
        gl.deleteVertexArray(stream.vao);
        gl.deleteBuffer(stream.buffer);
      }
    }
    this.m_vao = null;
    this.m_vertexBuffer = null;
    this.m_program = null;
    this.m_lineProgram = null;
    this.m_wireQuads = null;
    this.m_dynamicQuads = null;
    this.m_uploaded = { geometryVersion: -1, staticStart: -1, staticEnd: -1, capacity: 0 };
    this.m_wireQuadVersion = -1;
  }

  isReady(): boolean {
    return this.m_gl !== null && this.m_program !== null && !this.m_gl.isContextLost();
  }

  uploadVertexData(vertices: VertexArray, layout: GpuVertexLayout, geometryVersion: number): boolean {
    const gl = this.m_gl;
    if (!gl || !this.m_program || !this.m_vertexBuffer) return false;

    this.m_layout = { ...layout };
    const data = vertices.data();
    const size = vertices.size();
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.m_vertexBuffer);
    const staticStart = layout.axesVertexCount;
    const staticEnd = layout.vectorVertexStart;
    const uploaded = this.m_uploaded;
    if (
      uploaded.geometryVersion === geometryVersion &&
      uploaded.staticStart === staticStart &&
      uploaded.staticEnd === staticEnd &&
      size <= uploaded.capacity
    ) {
      if (staticStart > 0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, staticStart * kVertexFloats);
      if (size > staticEnd)
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          staticEnd * kVertexBytes,
          data,
          staticEnd * kVertexFloats,
          (size - staticEnd) * kVertexFloats,
        );
    } else {
      const capacity = size + 4096;
      gl.bufferData(gl.ARRAY_BUFFER, capacity * kVertexBytes, gl.DYNAMIC_DRAW);
      if (size > 0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      this.m_uploaded = { geometryVersion, staticStart, staticEnd, capacity };
    }

    if (this.m_wireQuads && this.m_wireQuadVersion !== geometryVersion) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.m_wireQuads.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        expandLineQuads(data, layout.geometryWireVertexStart, layout.geometryWireVertexCount),
        gl.STATIC_DRAW,
      );
      this.m_wireQuadVersion = geometryVersion;
    }
    if (this.m_dynamicQuads) {
      this.m_dynamicQuadAxesVertices = layout.axesVertexCount;
      this.m_dynamicQuadVectorVertices = layout.connectorVertexStart - layout.vectorVertexStart;
      const axes = expandLineQuads(data, 0, this.m_dynamicQuadAxesVertices);
      const vectors = expandLineQuads(data, layout.vectorVertexStart, this.m_dynamicQuadVectorVertices);
      const connectorLines = expandLineQuads(data, layout.connectorLineStart, layout.connectorLineCount);
      const quads = new Float32Array(axes.length + vectors.length + connectorLines.length);
      quads.set(axes);
      quads.set(vectors, axes.length);
      quads.set(connectorLines, axes.length + vectors.length);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.m_dynamicQuads.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, quads, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return true;
  }

  beginFrame(): boolean {
    const gl = this.m_gl;
    if (!gl || !this.isReady()) return false;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    return true;
  }

  endFrame(): void {
    const gl = this.m_gl;
    if (!gl) return;
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  setMatrices(mvp: QMatrix4x4, normalMatrix: Float32Array): void {
    this.m_mvp = mvp;
    this.m_normalMatrix = normalMatrix;
  }

  setDepthTest(enabled: boolean): void {
    const gl = this.m_gl;
    if (!gl) return;
    if (enabled) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
  }

  setDepthMask(enabled: boolean): void {
    this.m_gl?.depthMask(enabled);
  }

  setUniformValue(name: BoolUniform, value: boolean): void;
  setUniformValue(name: 'uOverrideColor', value: QVector3D): void;
  setUniformValue(name: BoolUniform | 'uOverrideColor', value: boolean | QVector3D): void {
    if (name === 'uOverrideColor') this.m_uniformOverrideColor = value as QVector3D;
    else if (name === 'uUseOverrideColor') this.m_uniformUseOverrideColor = value as boolean;
    else this.m_uniformLightingEnabled = value as boolean;
  }

  glLineWidth(width: number): void {
    this.m_lineWidth = width;
  }

  glDrawArrays(mode: 'GL_LINES' | 'GL_TRIANGLES', first: number, count: number): void {
    const gl = this.m_gl;
    const program = this.m_program;
    if (!gl || !program || count <= 0) return;
    if (mode === 'GL_LINES' && this.drawLineQuads(gl, first, count)) return;
    gl.useProgram(program.program);
    gl.bindVertexArray(this.m_vao);
    gl.uniformMatrix4fv(program.uMvp, false, this.m_mvp.data);
    gl.uniformMatrix3fv(program.uNormalMatrix, false, this.m_normalMatrix);
    gl.uniform1i(program.uUseOverrideColor, this.m_uniformUseOverrideColor ? 1 : 0);
    const c = this.m_uniformOverrideColor;
    gl.uniform3f(program.uOverrideColor, c.x, c.y, c.z);
    gl.uniform1i(program.uLightingEnabled, this.m_uniformLightingEnabled ? 1 : 0);
    gl.drawArrays(mode === 'GL_LINES' ? gl.LINES : gl.TRIANGLES, first, count);
  }

  private createQuadStream(gl: WebGL2RenderingContext): QuadStream | null {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (let attribute = 0; attribute < 3; ++attribute) {
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, kLineQuadBytes, attribute * 3 * 4);
    }
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, kLineQuadBytes, 9 * 4);
    gl.bindVertexArray(null);
    return { vao, buffer };
  }

  private drawLineQuads(gl: WebGL2RenderingContext, first: number, count: number): boolean {
    const program = this.m_lineProgram;
    if (!program) return false;
    const layout = this.m_layout;
    const axes = this.m_dynamicQuadAxesVertices;
    const vectors = this.m_dynamicQuadVectorVertices;
    const wireEnd = layout.geometryWireVertexStart + layout.geometryWireVertexCount;
    const connectorLineEnd = layout.connectorLineStart + layout.connectorLineCount;
    let stream: QuadStream | null = null;
    let quadFirst = 0;
    if (first >= 0 && first + count <= axes) {
      stream = this.m_dynamicQuads;
      quadFirst = first;
    } else if (first >= layout.geometryWireVertexStart && first + count <= wireEnd) {
      stream = this.m_wireQuads;
      quadFirst = first - layout.geometryWireVertexStart;
    } else if (first >= layout.vectorVertexStart && first + count <= layout.vectorVertexStart + vectors) {
      stream = this.m_dynamicQuads;
      quadFirst = axes + first - layout.vectorVertexStart;
    } else if (first >= layout.connectorLineStart && first + count <= connectorLineEnd) {
      stream = this.m_dynamicQuads;
      quadFirst = axes + vectors + first - layout.connectorLineStart;
    }
    if (!stream) return false;
    gl.useProgram(program.program);
    gl.bindVertexArray(stream.vao);
    gl.uniformMatrix4fv(program.uMvp, false, this.m_mvp.data);
    gl.uniform2f(program.uViewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(program.uLineWidth, this.m_lineWidth);
    gl.uniform1i(program.uUseOverrideColor, this.m_uniformUseOverrideColor ? 1 : 0);
    const c = this.m_uniformOverrideColor;
    gl.uniform3f(program.uOverrideColor, c.x, c.y, c.z);
    gl.drawArrays(gl.TRIANGLES, quadFirst * kLineQuadVerticesPerVertex, count * kLineQuadVerticesPerVertex);
    return true;
  }
}
