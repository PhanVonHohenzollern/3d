// Change notification for the imperative UI models.
//
// The Qt widgets are imperative: MainWindow calls a panel method and reads
// the panel state back immediately (e.g. setRuntimeResult() followed by
// selectedApiCall()), and panels fire their callbacks synchronously in the
// middle of such sequences. The web port therefore keeps every panel's state
// in a plain model object that is mutated synchronously, exactly like the C++
// member variables. React views only render that state; a model reports each
// mutation through changed(), which re-renders its view (Qt's repaint).

import { useSyncExternalStore } from 'react';

export class Observable {
  #version = 0;
  #notifyScheduled = false;
  readonly #listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly version = (): number => this.#version;

  /**
   * The model state itself changes synchronously; the repaint request is
   * coalesced (like QWidget::update()), so building thousands of tree items
   * schedules one render.
   */
  protected changed(): void {
    ++this.#version;
    if (this.#notifyScheduled) return;
    this.#notifyScheduled = true;
    queueMicrotask(() => {
      this.#notifyScheduled = false;
      for (const listener of [...this.#listeners]) listener();
    });
  }
}

/** Re-render the calling component whenever `model` changes. */
export function useObservable(model: Observable): number {
  return useSyncExternalStore(model.subscribe, model.version);
}

/** Keyboard modifiers of a mouse/key event (Qt::KeyboardModifiers subset). */
export interface Modifiers {
  shift: boolean;
  /** Qt::ControlModifier: the Command key on macOS, Ctrl elsewhere. */
  control: boolean;
}

export const isMacPlatform =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export function eventModifiers(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): Modifiers {
  return { shift: event.shiftKey, control: isMacPlatform ? event.metaKey : event.ctrlKey };
}

/** QString::trimmed() */
export const trimmed = (text: string): string => text.trim();
