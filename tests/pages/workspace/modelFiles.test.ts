import { parseObj, writeObj } from '@engine/formats/obj';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewport3DHandle } from '@/widgets/viewport/model/viewportHandle';
import { QVector3D } from '@/widgets/viewport/lib/math/Vector3D';
import { boxMesh, click, createEngine, project, scene } from '@tests/renderer/helpers';
import { createWorkspace, keyEvent, kSource } from '@tests/pages/workspace/harness';

describe('Workspace: OBJ import and export', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the last build after OBJ import and rebuilds explicitly with Ctrl+R', () => {
    const { mw, editor, log } = createWorkspace();
    mw.start();
    editor.type(kSource, 1);
    mw.buildPreview();
    const builtScene = mw.session.scene;
    const builtResult = mw.session.lastResult;
    const exported = mw.exportObj();
    mw.replacePreviewWithObj(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'), 'triangle.obj');
    editor.type(kSource.replace('double after = 1', 'double after = 8'), 1);
    mw.returnToCodePreview();
    expect(mw.importedObj).toBeNull();
    expect(mw.session.scene).toBe(builtScene);
    expect(mw.session.lastResult).toBe(builtResult);
    expect(mw.exportObj()).toBe(exported);
    expect(log).toContain('setGeometryScene(obj)');
    expect(log).toContain('setRuntimeResult(obj)');

    const event = keyEvent('r', { control: true }, 'input');
    mw.handleKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mw.session.mode).toBe('build');
    expect(mw.session.currentLine).toBe(6);
    expect(mw.session.runtime.evaluateNumericExpression('after')).toBe(8);
    mw.dispose();
  });

  it.each(['build', 'debug'] as const)('%s explicitly switches an imported OBJ back to the editor preview', (mode) => {
    const { mw, editor, log } = createWorkspace();
    mw.start();
    editor.type(kSource, 3);
    mw.replacePreviewWithObj(parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'), 'triangle.obj');
    log.length = 0;
    if (mode === 'build') mw.buildPreview();
    else mw.debugPreview();
    expect(mw.importedObj).toBeNull();
    expect(mw.session.mode).toBe(mode);
    expect(mw.session.currentLine).toBe(mode === 'build' ? 6 : 3);
    expect(mw.session.scene.meshes).toHaveLength(mode === 'build' ? 1 : 0);
    expect(log).toContain('setGeometryScene(obj)');
    expect(log).toContain('setRuntimeResult(obj)');
    mw.dispose();
  });

  it('keeps OBJ preview independent from code edits and restores code on request', () => {
    const { mw, editor, log } = createWorkspace();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    const imported = parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
    mw.replacePreviewWithObj(imported, 'triangle.obj');
    expect(editor.text).toBe(kSource);
    expect(mw.canExportObj).toBe(true);
    expect(parseObj(mw.exportObj()).meshes[0].indices).toHaveLength(3);
    log.length = 0;
    editor.type(kSource.replace('double w = 2', 'double w = 4'), 6);
    vi.advanceTimersByTime(220);
    expect(log).not.toContain('setGeometryScene(obj)');
    expect(log).not.toContain('setRuntimeResult(obj)');
    expect(mw.importedObj?.name).toBe('triangle.obj');
    mw.returnToCodePreview();
    expect(mw.importedObj).toBeNull();
    expect(log).toContain('setGeometryScene(obj)');
    expect(parseObj(mw.exportObj()).meshes[0].indices.length).toBeGreaterThan(3);
    mw.dispose();
  });

  it('Esc clears imported OBJ mesh selection and focus without changing the model or camera', () => {
    const { mw, editor } = createWorkspace();
    mw.start();
    const engine = createEngine();
    mw.bindViewport(createViewport3DHandle(engine));
    engine.setMeshSelectionCallback(mw.selection.onViewportMeshSelection);
    engine.selectionModeButtonClicked();
    engine.selectionModeButtonClicked();
    const imported = parseObj(writeObj(scene(boxMesh([-1, -1, -1], [1, 1, 1]), boxMesh([4, -1, -1], [6, 1, 1]))));
    mw.replacePreviewWithObj(imported, 'two-meshes.obj');
    const camera = engine.camera();
    const before = { target: camera.target, distance: camera.distance, yaw: camera.yaw, pitch: camera.pitch };
    const first = project(engine, new QVector3D(0, 0, 0));
    click(engine, first.x, first.y);
    expect(engine.selectedMeshIndex()).toBe(0);
    mw.handleKeyDown(keyEvent('Escape'));
    expect(engine.selectedMeshIndex()).toBe(-1);
    expect(engine.isMeshSelected(0)).toBe(false);

    const second = project(engine, new QVector3D(5, 0, 0));
    click(engine, second.x, second.y);
    expect(engine.selectedMeshIndex()).toBe(1);
    engine.setSelectedApiCall(-1, true);
    engine.setApiFocusIndices(new Set());
    mw.handleKeyDown(keyEvent('Escape'));
    expect(engine.selectedMeshIndex()).toBe(-1);
    expect(engine.hasMeshFocus()).toBe(false);
    expect(engine.hasApiFocus()).toBe(false);
    click(engine, first.x, first.y);
    expect(engine.selectedMeshIndex()).toBe(0);
    mw.handleKeyDown(keyEvent('Escape'));
    expect(camera.target).toEqual(before.target);
    expect([camera.distance, camera.yaw, camera.pitch]).toEqual([before.distance, before.yaw, before.pitch]);
    expect(mw.importedObj?.scene).toBe(imported);
    expect(editor.text).toBe('');
    mw.dispose();
  });
});
