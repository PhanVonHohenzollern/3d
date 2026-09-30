import { describe, expect, it, vi } from 'vitest';
import { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import { playDrawScenarios } from '@tests/renderer/drawScenarios';
import { boxMesh, fixedMeasurer, scene } from '@tests/renderer/helpers';
import { fakeSurface, RecordingBackend } from '@tests/renderer/recordingBackend';

const backend = vi.hoisted(() => ({ current: null as RecordingBackend | null }));

vi.mock('@/widgets/viewport/lib/render/backend/createRenderBackend', () => ({
  createRenderBackend: () => backend.current,
}));

// What SceneRenderer asks its backend to draw. Any backend must receive exactly these calls, so a
// change here is a change in what the viewport draws.
describe('scene draw calls', () => {
  it('draws each viewport state with the same calls', () => {
    const recorder = new RecordingBackend();
    backend.current = recorder;
    const engine = new ViewportEngine();
    engine.setTextMeasurer(fixedMeasurer);
    const names = playDrawScenarios(engine);
    const frames = recorder.frames.slice(-names.length);
    const byName = Object.fromEntries(names.map((name, i) => [name, frames[i]]));

    expect(byName['wireframe']).not.toContain('lighting true');
    expect(byName['unite']).toContain('opacity 0.27');
    expect(byName['api selected']).toContain('overrideColor 1,0.92,0.18');
    expect(byName['selected vector']).toContain('lineWidth 4');
    expect(byName['hovered mesh']).toContain('overrideColor 0.7,0.95,1');
    expect(byName).toMatchSnapshot();
  });

  it('uploads again and repaints when a lost device comes back', () => {
    const recorder = new RecordingBackend();
    backend.current = recorder;
    const pending: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => pending.push(callback));

    const flush = () => {
      for (const callback of pending.splice(0)) callback(0);
    };

    try {
      const engine = new ViewportEngine();
      engine.setTextMeasurer(fixedMeasurer);
      engine.attach(fakeSurface());
      engine.resize(800, 600, 1);
      engine.setGeometryScene(scene(boxMesh([0, 0, 0], [10, 10, 10])));
      flush();
      const uploads = recorder.uploads;
      const frames = recorder.frames.length;

      recorder.events?.lost();
      recorder.events?.ready();
      expect(recorder.uploads).toBe(uploads + 1);
      flush();
      expect(recorder.frames).toHaveLength(frames + 1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
