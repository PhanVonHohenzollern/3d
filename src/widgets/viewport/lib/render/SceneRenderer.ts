import {
  kAxisLineWidth,
  kConnectorLineWidth,
  kHighlightLineWidth,
  kHoverOutlineColor,
  kHoverTint,
  kSelectedApiOutlineColor,
  kSelectedMeshColor,
  kSelectedMeshOutlineColor,
  kSelectedVectorLineWidth,
  kUniteOpacity,
  kVectorLineWidth,
  kWireLineWidth,
} from '@/widgets/viewport/config/viewport';
import { QMatrix4x4 } from '@/widgets/viewport/lib/math/Matrix4x4';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import { appendConnectorVertices } from '@/widgets/viewport/lib/render/connectorOverlay';
import { appendVectorArrow } from '@/widgets/viewport/lib/render/debugItems';
import { buildGeometryVertices, buildGeometryWireVertices } from '@/widgets/viewport/lib/render/geometryVertices';
import type { GeometryRange, GpuVertexLayout } from '@/widgets/viewport/lib/render/types';
import { VertexArray } from '@/widgets/viewport/lib/render/VertexArray';
import { ViewportRenderer } from '@/widgets/viewport/lib/render/ViewportRenderer';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';

interface GeometryVertexCache {
  version: number;
  triangles: Float32Array;
  triangleRanges: GeometryRange[];
  wires: Float32Array;
  wireRanges: GeometryRange[];
}

interface Span {
  start: number;
  count: number;
}

const kNoSpan: Span = { start: 0, count: 0 };

// The GL scene: one vertex buffer holding the axes, the geometry (solid and wire), the vector
// arrows and the connectors, rebuilt when what is shown changes, and the draw calls over it.
export class SceneRenderer {
  readonly renderer = new ViewportRenderer();
  #vertices = new VertexArray(4096);
  #layout: GpuVertexLayout = {
    axesVertexCount: 0,
    geometryWireVertexStart: 0,
    geometryWireVertexCount: 0,
    vectorVertexStart: 0,
    connectorVertexStart: 0,
    connectorLineStart: 0,
    connectorLineCount: 0,
  };
  #geometryRanges: GeometryRange[] = [];
  #wireRanges: GeometryRange[] = [];
  #axes = kNoSpan;
  #vectors = kNoSpan;
  #selectedVectors = kNoSpan;
  #connectors = kNoSpan;
  #connectorLines = kNoSpan;
  #dirty = true;
  #cache: GeometryVertexCache | null = null;
  #geometryVersion = 0;

  constructor(
    private readonly state: ViewportState,
    private readonly view: CameraController,
  ) {}

  // The geometry scene changed: its vertices are rebuilt on the next rebuild.
  geometryChanged(): void {
    this.#cache = null;
    ++this.#geometryVersion;
  }

  rebuild(): void {
    const { state, view } = this;
    const vertices = this.#vertices;
    vertices.assign(view.axes);
    this.#axes = { start: 0, count: view.axes.size() };

    const cache = this.#geometryCache();
    this.#geometryRanges = this.#appendCached(cache.triangles, cache.triangleRanges);
    const geometryWireVertexStart = vertices.size();
    this.#wireRanges = this.#appendCached(cache.wires, cache.wireRanges);
    const geometryWireVertexCount = vertices.size() - geometryWireVertexStart;
    for (const range of this.#wireRanges)
      if (state.geometryScene.meshes[range.meshIndex].primitive === 'lines') this.#geometryRanges.push(range);

    const eye = view.camera.cameraPosition();

    const appendVectors = (selected: boolean): Span => {
      const start = vertices.size();
      if (state.showVectors) {
        for (const item of state.debugItems) {
          if (item.kind !== 'Vector' || state.selectedVariables.has(item.name) !== selected) continue;
          if (!state.isDebugItemVisible(item)) continue;
          appendVectorArrow(vertices, item, selected, eye, view.sceneScale);
        }
      }

      return { start, count: vertices.size() - start };
    };

    this.#vectors = appendVectors(false);
    this.#selectedVectors = appendVectors(true);

    const connectors = appendConnectorVertices(vertices, state.connectors, state.selectedConnectorId);
    this.#connectors = { start: connectors.vertexStart, count: connectors.vertexCount };
    this.#connectorLines = { start: connectors.lineStart, count: connectors.lineCount };

    this.#layout = {
      axesVertexCount: this.#axes.count,
      geometryWireVertexStart,
      geometryWireVertexCount,
      vectorVertexStart: this.#vectors.start,
      connectorVertexStart: this.#connectors.start,
      connectorLineStart: this.#connectorLines.start,
      connectorLineCount: this.#connectorLines.count,
    };
    this.#dirty = true;
  }

  // Sets up GL; `rebuild` fills the vertex buffer first when nothing was built yet.
  initialize(gl: WebGL2RenderingContext, rebuild: () => void): boolean {
    if (!this.renderer.initialize(gl)) return false;
    if (this.#vertices.empty()) rebuild();
    this.#upload();
    this.#dirty = false;

    return true;
  }

  // Updates the camera matrices and draws the scene when GL is available.
  paint(): void {
    const { renderer, state, view } = this;
    const glActive = renderer.beginFrame();
    view.updateMatrices();
    if (!glActive) return;
    if (this.#dirty) this.#upload();

    const model = new QMatrix4x4();
    model.setToIdentity();
    renderer.setMatrices(view.camera.viewProjection().times(model), view.camera.view.normalMatrix());
    renderer.setUniformValue('uUseOverrideColor', false);
    renderer.setUniformValue('uLightingEnabled', false);

    renderer.glLineWidth(kAxisLineWidth);
    if (this.#axes.count > 0) renderer.glDrawArrays('GL_LINES', 0, this.#axes.count);

    if (state.showGeometry && this.#geometryRanges.length > 0) {
      if (state.geometryWireframe) this.#drawWireframe();
      else this.#drawSolid();
      this.#drawHighlight();
      renderer.setDepthMask(true);
      renderer.setDepthTest(true);
    }

    renderer.setUniformValue('uUseOverrideColor', false);
    if (this.#vectors.count > 0) {
      renderer.glLineWidth(kVectorLineWidth);
      renderer.glDrawArrays('GL_LINES', this.#vectors.start, this.#vectors.count);
    }
    if (this.#selectedVectors.count > 0) {
      renderer.glLineWidth(kSelectedVectorLineWidth);
      renderer.glDrawArrays('GL_LINES', this.#selectedVectors.start, this.#selectedVectors.count);
    }

    if (!state.apiFocusActive && this.#connectors.count > 0) this.#drawConnectors();
    renderer.endFrame();
  }

  #upload(): void {
    if (this.renderer.uploadVertexData(this.#vertices, this.#layout, this.#geometryVersion)) this.#dirty = false;
  }

  #drawWireframe(): void {
    const { renderer, state } = this;
    renderer.setDepthTest(false);
    renderer.setDepthMask(false);
    renderer.glLineWidth(kWireLineWidth);
    for (const range of this.#wireRanges) {
      if (!state.isGeometryApiVisible(range.apiIndex)) continue;
      renderer.glDrawArrays('GL_LINES', range.start, range.count);
    }
  }

  #drawSolid(): void {
    const { renderer, state } = this;
    const unite = state.selectionPresentation === 'Unite';
    if (unite) {
      renderer.setDepthTest(false);
      renderer.setDepthMask(false);
    }
    renderer.glLineWidth(kWireLineWidth);
    for (const range of this.#geometryRanges) {
      if (!state.isGeometryApiVisible(range.apiIndex)) continue;
      const lines = state.geometryScene.meshes[range.meshIndex].primitive === 'lines';
      renderer.setUniformValue('uLightingEnabled', !lines);
      const selected = state.isMeshSelected(range.meshIndex);
      const hovered = state.isMeshInGroup(range.meshIndex, state.hoveredMeshIndex);
      if (unite) renderer.setOpacity(selected || hovered ? kUniteOpacity.focused : kUniteOpacity.other);
      renderer.setUniformValue('uUseOverrideColor', selected || hovered);
      if (selected) renderer.setUniformValue('uOverrideColor', kSelectedMeshColor);
      else if (hovered) {
        const color = state.geometryScene.meshes[range.meshIndex].color;
        renderer.setUniformValue(
          'uOverrideColor',
          new QVector3D(color.r, color.g, color.b).mul(kHoverTint.amount).add(kHoverTint.lift),
        );
      }
      renderer.glDrawArrays(lines ? 'GL_LINES' : 'GL_TRIANGLES', range.start, range.count);
    }
    if (unite) renderer.setOpacity(1);
    renderer.setUniformValue('uLightingEnabled', false);
    renderer.setUniformValue('uUseOverrideColor', false);
  }

  #drawHighlight(): void {
    const { renderer, state } = this;
    if (state.selectedApiIndex < 0 && state.selectedMeshIndex < 0 && state.hoveredMeshIndex < 0) return;
    renderer.setUniformValue('uUseOverrideColor', true);
    renderer.glLineWidth(kHighlightLineWidth);
    for (const range of this.#wireRanges) {
      if (!state.isGeometryApiVisible(range.apiIndex)) continue;
      const selectedDirectly =
        state.selectedMeshIndex >= 0
          ? state.isMeshSelected(range.meshIndex)
          : state.selectedApiIndex >= 0 && range.apiIndex === state.selectedApiIndex;
      const selectedAsHelperChild =
        state.selectedMeshIndex < 0 && state.apiFocusActive && state.apiFocusIndices.has(range.apiIndex);
      const hovered = state.isMeshInGroup(range.meshIndex, state.hoveredMeshIndex);
      if (!selectedDirectly && !selectedAsHelperChild && !hovered) continue;
      renderer.setUniformValue(
        'uOverrideColor',
        hovered
          ? kHoverOutlineColor
          : state.selectedMeshIndex >= 0
            ? kSelectedMeshOutlineColor
            : kSelectedApiOutlineColor,
      );
      renderer.glDrawArrays('GL_LINES', range.start, range.count);
    }
    renderer.setUniformValue('uUseOverrideColor', false);
  }

  #drawConnectors(): void {
    const { renderer, state } = this;
    renderer.setUniformValue('uUseOverrideColor', false);
    renderer.setUniformValue('uLightingEnabled', true);
    if (!state.geometryWireframe) renderer.glDrawArrays('GL_TRIANGLES', this.#connectors.start, this.#connectors.count);
    renderer.setUniformValue('uLightingEnabled', false);
    renderer.glLineWidth(kConnectorLineWidth);
    renderer.setDepthTest(false);
    renderer.setDepthMask(false);
    renderer.glDrawArrays('GL_LINES', this.#connectorLines.start, this.#connectorLines.count);
    renderer.setDepthMask(true);
    renderer.setDepthTest(true);
  }

  #geometryCache(): GeometryVertexCache {
    if (this.#cache && this.#cache.version === this.#geometryVersion) return this.#cache;
    const scene = this.state.geometryScene;
    const triangles = buildGeometryVertices(scene);
    const wires = buildGeometryWireVertices(scene);
    this.#cache = {
      version: this.#geometryVersion,
      triangles: triangles.vertices.data().slice(),
      triangleRanges: triangles.ranges,
      wires: wires.vertices.data().slice(),
      wireRanges: wires.ranges,
    };

    return this.#cache;
  }

  #appendCached(vertices: Float32Array, ranges: readonly GeometryRange[]): GeometryRange[] {
    const base = this.#vertices.size();
    this.#vertices.appendData(vertices);

    return ranges.map((range) => ({ ...range, start: range.start + base }));
  }
}
