import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBarModel } from '../../src/hooks/mainWindow/StatusBarModel';

afterEach(() => vi.useRealTimers());

describe('status message severity', () => {
  it('preserves an explicit error until it is replaced by a normal message', () => {
    const model = new StatusBarModel();
    model.showMessage('Preview stopped', 0, 'error');
    expect(model.currentMessage()).toBe('Preview stopped');
    expect(model.currentTone()).toBe('error');
    model.showMessage('Preview updated');
    expect(model.currentTone()).toBe('info');
  });

  it('clears the warning tone when the message expires', () => {
    vi.useFakeTimers();
    const model = new StatusBarModel();
    model.showMessage('Unsupported geometry', 1000, 'warning');
    expect(model.currentTone()).toBe('warning');
    vi.advanceTimersByTime(1000);
    expect(model.currentMessage()).toBe('');
    expect(model.currentTone()).toBe('info');
  });

  it('does not let an earlier timeout clear a replacement error', () => {
    vi.useFakeTimers();
    const model = new StatusBarModel();
    model.showMessage('Preview updated', 1000);
    model.showMessage('Preview stopped', 4000, 'error');
    vi.advanceTimersByTime(1000);
    expect(model.currentMessage()).toBe('Preview stopped');
    expect(model.currentTone()).toBe('error');
    model.clearMessage();
    expect(model.currentTone()).toBe('info');
  });
});
