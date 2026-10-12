import { describe, expect, it, vi } from 'vitest';
import type { PreviewMesh } from '@engine/geometry/PreviewGeometryEngine';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { kVertexFloats } from '@/widgets/viewport/lib/render/VertexArray';
import { expandLineQuads, kLineQuadFloats } from '@/widgets/viewport/lib/render/lineQuads';
import { buildGeometryVertices, buildGeometryWireVertices } from '@/widgets/viewport/lib/render/geometryVertices';
import { boxMesh, mouse, scene } from '@tests/renderer/helpers';
import { GeometryRuntime } from '@engine/runtime';
import { PreviewGeometryEngine, buildConnectorPreview, defaultConnectorDefinition } from '@engine/geometry';
import { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import { SceneRenderer } from '@/widgets/viewport/lib/render/SceneRenderer';
import { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import { OverlayLayer } from '@/widgets/viewport/lib/render/OverlayLayer';
import { PickingService } from '@/widgets/viewport/lib/render/PickingService';
import { ViewportInput } from '@/widgets/viewport/lib/render/ViewportInput';
import { QRect } from '@/widgets/viewport/lib/math/Rect';
import {
  kConnectorColor,
  kHoverOutlineColor,
  kHoverTint,
  kHighlightLineWidth,
} from '@/widgets/viewport/config/viewport';

function normalAt(data: Float32Array, vertex: number): QVector3D {
  const o = vertex * kVertexFloats;

  return new QVector3D(data[o + 6], data[o + 7], data[o + 8]);
}

function foldedPair(degrees: number, apiName = 'makeTube'): PreviewMesh {
  const t = (degrees * Math.PI) / 180;
  const vertices = [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: Math.cos(t), z: Math.sin(t) },
  ].map((v) => ({ ...v, nx: 0, ny: 0, nz: 0 }));

  return { apiIndex: 0, sourceLine: 1, apiName, color: { r: 1, g: 0, b: 0 }, vertices, indices: [0, 2, 1, 1, 2, 3] };
}

describe('geometry triangles', () => {
  it('derives flat normals for box walls (90 degree creases are kept)', () => {
    const { vertices, ranges } = buildGeometryVertices(scene(boxMesh([0, 0, 0], [2, 1, 1])));
    expect(vertices.size()).toBe(36);
    expect(ranges).toEqual([{ meshIndex: 0, apiIndex: 0, start: 0, count: 36 }]);
    const data = vertices.data();
    for (let v = 0; v < 36; v += 3) {
      const n = normalAt(data, v);
      expect(n.length()).toBeCloseTo(1, 5);
      expect(Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))).toBeCloseTo(1, 5);
    }
  });

  it('blends normals across gentle folds', () => {
    const { vertices } = buildGeometryVertices(scene(foldedPair(20)));
    const data = vertices.data();
    const shared = normalAt(data, 1);
    expect(Math.abs(shared.z)).toBeLessThan(0.999);
    expect(Math.abs(normalAt(data, 0).z)).toBeCloseTo(1, 5);
  });

  it('keeps makeFacettedCylinder flat', () => {
    const { vertices } = buildGeometryVertices(scene(foldedPair(20, 'makeFacettedCylinder')));
    expect(Math.abs(normalAt(vertices.data(), 1).z)).toBeCloseTo(1, 5);
  });

  it('skips degenerate and out-of-range triangles', () => {
    const mesh = boxMesh([0, 0, 0], [1, 1, 1]);
    mesh.indices = [0, 1, 1, 0, 1, 99, 0, 1, 2];
    const { vertices } = buildGeometryVertices(scene(mesh));
    expect(vertices.size()).toBe(3);
  });

  it('stamps the mesh color on every vertex', () => {
    const { vertices } = buildGeometryVertices(scene(boxMesh([0, 0, 0], [1, 1, 1])));
    const data = vertices.data();
    expect([data[3], data[4], data[5]]).toEqual([1, Math.fround(176 / 255), 0]);
  });
});

describe('feature edges', () => {
  it('omits the coplanar quad diagonals of a box', () => {
    const { vertices, ranges } = buildGeometryWireVertices(scene(boxMesh([0, 0, 0], [3, 2, 1])));
    expect(vertices.size()).toBe(24);
    expect(ranges[0].count).toBe(24);
    const data = vertices.data();
    for (let v = 0; v < 24; v += 2) {
      const a = new QVector3D(data[v * 9], data[v * 9 + 1], data[v * 9 + 2]);
      const b = new QVector3D(data[(v + 1) * 9], data[(v + 1) * 9 + 1], data[(v + 1) * 9 + 2]);
      const d = b.sub(a);
      expect([d.x, d.y, d.z].filter((c) => c !== 0).length).toBe(1);
    }
  });

  it('keeps boundaries and creases, drops flat shared edges', () => {
    expect(buildGeometryWireVertices(scene(foldedPair(0))).vertices.size()).toBe(8);
    expect(buildGeometryWireVertices(scene(foldedPair(30))).vertices.size()).toBe(10);
  });

  it('expands wide lines into two triangles per segment', () => {
    const { vertices } = buildGeometryWireVertices(scene(boxMesh([0, 0, 0], [1, 1, 1])));
    const quads = expandLineQuads(vertices.data(), 2, 4);
    expect(quads.length).toBe(2 * 6 * kLineQuadFloats);
    const src = vertices.data();
    expect(Array.from(quads.slice(0, 11))).toEqual([
      src[18],
      src[19],
      src[20],
      src[27],
      src[28],
      src[29],
      src[21],
      src[22],
      src[23],
      0,
      -1,
    ]);
    const corners = [];
    for (let v = 0; v < 6; ++v) corners.push([quads[v * 11 + 9], quads[v * 11 + 10]]);
    expect(corners).toEqual([
      [0, -1],
      [0, 1],
      [1, -1],
      [1, -1],
      [0, 1],
      [1, 1],
    ]);
  });
});

describe('centerline rendering', () => {
  const build = () =>
    new PreviewGeometryEngine().build(
      new GeometryRuntime().executeUpToLine('addCenterLine(FdPoint3d(3,5,7),FdPoint3d(3,105,7));', 999),
    );

  it('sends endpoint pairs to the line buffer without any triangle faces or width offsets', () => {
    const geometry = build();
    expect(buildGeometryVertices(geometry).vertices.size()).toBe(0);
    const { vertices, ranges } = buildGeometryWireVertices(geometry);
    const mesh = geometry.meshes[0];
    expect(vertices.size()).toBe(mesh.indices.length);
    expect(ranges).toEqual([{ meshIndex: 0, apiIndex: 0, start: 0, count: mesh.indices.length }]);
    mesh.indices.forEach((index, i) => {
      const v = mesh.vertices[index];
      expect(vertices.position(i)).toEqual(new QVector3D(v.x, v.y, v.z));
      expect(Array.from(vertices.data().slice(i * 9 + 3, i * 9 + 6))).toEqual([0, 1, 0]);
    });
  });

  it.each([false, true])('draws a scene containing only centerlines (wireframe=%s)', (wireframe) => {
    const state = new ViewportState();
    state.geometryScene = build();
    state.geometryWireframe = wireframe;
    const renderer = new SceneRenderer(state, new CameraController(state));
    vi.spyOn(renderer.renderer, 'beginFrame').mockReturnValue(true);
    const draw = vi.spyOn(renderer.renderer, 'glDrawArrays');
    renderer.rebuild();
    renderer.paint();
    expect(draw.mock.calls).toHaveLength(2);
    expect(draw.mock.calls.every(([mode]) => mode === 'GL_LINES')).toBe(true);
    expect(draw.mock.calls[1][2]).toBe(state.geometryScene.meshes[0].indices.length);
  });
});

describe('connector mesh hover', () => {
  it.each([false, true])('highlights only the hovered Link and clears on leave (wireframe=%s)', (wireframe) => {
    const state = new ViewportState();
    state.selectionMode = 'Mesh';
    state.geometryWireframe = wireframe;
    state.connectors = [1, 2].map((id) =>
      buildConnectorPreview(
        {
          ...defaultConnectorDefinition(),
          id,
          diameter: '40',
          position: ['0', id === 1 ? '-100' : '100', '0'],
        },
        Number,
      ),
    );
    const view = new CameraController(state);
    view.camera.setViewportSize(800, 600);
    view.setConnectors(state.connectors);
    view.fitScene();
    view.updateMatrices();
    const overlay = new OverlayLayer(state, view, () => {});
    const input = new ViewportInput(state, view, new PickingService(state, view), overlay, {
      callbacks: { selectionChanged: null, pointCreation: null, meshSelection: null, connectorSelection: null },
      bounds: () => new QRect(0, 0, 800, 600),
      update: () => {},
      setCursor: () => {},
      rebuild: () => {},
      selectDebugItems: () => {},
      setSelectedVariables: () => {},
    });
    const sceneRenderer = new SceneRenderer(state, view);
    const renderer = sceneRenderer.renderer;
    vi.spyOn(renderer, 'beginFrame').mockReturnValue(true);
    const upload = vi.spyOn(renderer, 'uploadVertexData').mockReturnValue(true);
    let override = false;
    let color = new QVector3D();
    let width = 1;
    const draws: { mode: string; override: boolean; color: QVector3D; width: number }[] = [];
    vi.spyOn(renderer, 'setUniformValue').mockImplementation((name: string, value: boolean | QVector3D) => {
      if (name === 'uUseOverrideColor' && typeof value === 'boolean') override = value;
      if (name === 'uOverrideColor' && value instanceof QVector3D) color = value;
    });
    vi.spyOn(renderer, 'glLineWidth').mockImplementation((value) => {
      width = value;
    });
    vi.spyOn(renderer, 'glDrawArrays').mockImplementation((mode) => {
      draws.push({ mode, override, color, width });
    });
    sceneRenderer.rebuild();
    sceneRenderer.paint();
    expect(draws.every((draw) => !draw.override)).toBe(true);
    draws.length = 0;

    const mesh = state.connectors[0].meshes[0];
    const face = mesh.indices.slice(0, 3).map((index) => mesh.vertices[index]);
    const target = face
      .reduce((point, vertex) => point.add(new QVector3D(vertex.x, vertex.y, vertex.z)), new QVector3D())
      .mul(1 / 3);
    const screen = view.projectToScreen(target)!;
    input.move(mouse(screen.x, screen.y, 0, 0));
    expect(state.hoveredConnectorId).toBe(1);
    sceneRenderer.paint();
    const highlighted = draws.filter((draw) => draw.override);
    expect(highlighted.filter((draw) => draw.mode === 'GL_LINES')).toEqual([
      { mode: 'GL_LINES', override: true, color: kHoverOutlineColor, width: kHighlightLineWidth },
    ]);
    expect(highlighted.filter((draw) => draw.mode === 'GL_TRIANGLES').map((draw) => draw.color)).toEqual(
      wireframe ? [] : [kConnectorColor.mul(kHoverTint.amount).add(kHoverTint.lift)],
    );
    expect(upload).toHaveBeenCalledTimes(1);
    state.selectedConnectorId = 2;
    input.clearHover();
    draws.length = 0;
    sceneRenderer.paint();
    expect(state.selectedConnectorId).toBe(2);
    expect(draws.every((draw) => !draw.override)).toBe(true);
  });
});
