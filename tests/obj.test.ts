import { buildGeometryVertices } from '@/widgets/viewport/lib/render/geometryVertices';
import { describe, expect, it } from 'vitest';
import { parseObj, writeObj } from '@engine/formats/obj';
import { GeometryRuntime } from '@engine/runtime';
import { PreviewGeometryEngine } from '@engine/geometry';
const triangle = 'v 0 0 0\nv 2 0 0\nv 0 2 0\nf 1 2 3';

describe('OBJ mesh exchange', () => {
  it('exports centerline dashes as OBJ lines and round trips them alongside faces', () => {
    const geometry = new PreviewGeometryEngine().build(
      new GeometryRuntime().executeUpToLine('addCenterLine(FdPoint3d(0,0,0),FdPoint3d(100,0,0));', 999),
    );
    geometry.meshes.push(...parseObj(triangle).meshes);
    const text = writeObj(geometry);
    expect(
      text
        .trimEnd()
        .split('\n')
        .every((line) => /^(v|vn|f|l) /.test(line)),
    ).toBe(true);
    expect(text.split('\n').filter((line) => line.startsWith('f '))).toHaveLength(1);
    expect(text.split('\n').filter((line) => line.startsWith('l '))).toHaveLength(
      geometry.meshes[0].indices.length / 2,
    );
    const restored = parseObj(text);
    expect(restored.meshes).toHaveLength(2);
    expect(restored.meshes[0].primitive).toBe('lines');
    expect(restored.meshes[0].vertices).toEqual(geometry.meshes[0].vertices);
    expect(restored.meshes[0].indices).toEqual(geometry.meshes[0].indices);
    expect(restored.meshes[1].vertices).toHaveLength(3);
    expect(restored.meshes[1].vertices).toEqual(expect.arrayContaining(geometry.meshes[1].vertices));
  });

  it('keeps faces and polylines in separate primitives within an OBJ object', () => {
    const meshes = parseObj(`${triangle}\nl -3 -2 -1\nf 3 2 1`).meshes;
    expect(meshes.map((mesh) => mesh.primitive)).toEqual([undefined, 'lines', undefined]);
    expect(meshes[1].indices).toEqual([0, 1, 1, 2]);
  });

  it.each(['l 0 2', 'l 1 99', 'l 1', 'l 1/9 2/9', 'l 1//1 2//1'])('rejects malformed OBJ lines: %s', (line) =>
    expect(() => parseObj(`v 0 0 0\nv 1 0 0\n${line}`)).toThrow(/Line 3/),
  );

  it('imports positions, generates normals, and keeps imported meshes separate from code', () => {
    const mesh = parseObj(triangle).meshes[0];
    expect(mesh.apiIndex).toBe(-1);
    expect(mesh.indices).toHaveLength(3);
    expect(mesh.vertices[1]).toEqual({ x: 2, y: 0, z: 0, nx: 0, ny: 0, nz: 1 });
  });
  it('supports relative indices, texture references, normals and named objects', () => {
    const scene = parseObj('o Part\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvn 0 0 2\nf -3/1/1 -2/1/1 -1/1/1');
    expect(scene.meshes[0].apiName).toBe('Part');
    expect(scene.meshes[0].vertices[0].nz).toBe(1);
    expect(scene.warnings).toContain('Textures and materials are not imported.');
  });
  it('triangulates concave polygons without filling the notch, preserving winding', () => {
    const scene = parseObj('v 0 0 0\nv 0 2 0\nv 1 1 0\nv 2 2 0\nv 2 0 0\nf 1 2 3 4 5');
    const mesh = scene.meshes[0];
    let area = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      expect(cross).toBeLessThan(0);
      area += Math.abs(cross) / 2;
    }
    expect(area).toBe(3);
  });
  it('passes supplied OBJ normals to the renderer unchanged', () => {
    const scene = parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nvn 1 0 0\nf 1//1 2//1 3//1');
    const vertices = buildGeometryVertices(scene).vertices.data();
    expect(Array.from(vertices.slice(6, 9))).toEqual([1, 0, 0]);
  });

  it('round trips geometry from multiple objects without exporting their names', () => {
    const source = triangle + '\no second\nf 3 2 1';
    const restored = parseObj(writeObj(parseObj(source)));
    expect(restored.meshes).toHaveLength(2);
    expect(restored.meshes[0].vertices).toHaveLength(3);
    expect(restored.meshes[1].vertices[0].nz).toBe(-1);
    expect(restored.meshes.reduce((n, m) => n + m.indices.length, 0)).toBe(6);
  });

  it('keeps consecutive centerlines separately selectable after a nameless export', () => {
    const geometry = new PreviewGeometryEngine().build(
      new GeometryRuntime().executeUpToLine(
        'addCenterLine(FdPoint3d(),FdPoint3d(100,0,0));\n' + 'addCenterLine(FdPoint3d(0,20,0),FdPoint3d(100,20,0));',
        999,
      ),
    );
    const restored = parseObj(writeObj(geometry));
    expect(restored.meshes).toHaveLength(2);
    restored.meshes.forEach((mesh, i) => {
      expect(mesh.primitive).toBe('lines');
      expect(mesh.vertices).toEqual(geometry.meshes[i].vertices);
      expect(mesh.indices).toEqual(geometry.meshes[i].indices);
    });
  });

  it.each(['o', 'g'])('preserves explicit OBJ %s grouping across vertex blocks', (group) => {
    const restored = parseObj(`${group} Part\n${triangle}\nv 0 0 1\nv 2 0 1\nv 0 2 1\nf 4 5 6`);
    expect(restored.meshes).toHaveLength(1);
    expect(restored.meshes[0].apiName).toBe('Part');
    expect(restored.meshes[0].indices).toHaveLength(6);
  });
  it.each(['f 0 2 3', 'f 1 2 99', 'f 1 2', 'f 1//9 2//9 3//9', 'f 1.2 2 3'])('rejects malformed faces: %s', (face) => {
    expect(() => parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\n' + face)).toThrow(/Line 4/);
  });
  it('triangulates faces outside the XY plane', () => {
    const mesh = parseObj('v 0 0 0\nv 0 1 0\nv 0 1 1\nv 0 0 1\nf 1 2 3 4').meshes[0];
    expect(mesh.indices).toHaveLength(6);
    expect(mesh.vertices[0].nx).toBe(1);
  });

  it('enforces input and face-size limits before processing geometry', () => {
    expect(() => parseObj(' '.repeat(20 * 1024 * 1024 + 1))).toThrow(/20 MB/);
    expect(() => parseObj('f ' + Array(4097).fill('1').join(' '))).toThrow(/4096 corners/);
  });

  it('rejects empty and non-finite geometry', () => {
    expect(() => parseObj('v 0 0 0')).toThrow(/No mesh faces/);
    expect(() => parseObj('v NaN 0 0')).toThrow(/Line 1/);
    expect(() => writeObj({ meshes: [], warnings: [] })).toThrow(/no mesh/);
  });
});
