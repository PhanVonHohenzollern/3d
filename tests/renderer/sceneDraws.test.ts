import { describe, expect, it, vi } from 'vitest';
import { ViewportEngine } from '@/widgets/viewport/lib/render/ViewportEngine';
import { playDrawScenarios } from '@tests/renderer/drawScenarios';
import { fixedMeasurer } from '@tests/renderer/helpers';
import { RecordingBackend } from '@tests/renderer/recordingBackend';

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
});
