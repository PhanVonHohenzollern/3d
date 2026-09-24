import type { KeySequence, Modifiers } from '../types/qt';
import { isMacPlatform, isWindowsPlatform } from '../utils/platform';

export const quitKeySequence: KeySequence | null = isWindowsPlatform ? null : { key: 'q', control: true };

export function keySequenceText(sequence: KeySequence): string {
  const key = sequence.key.length === 1 ? sequence.key.toUpperCase() : sequence.key;
  if (isMacPlatform) return `${sequence.shift ? '\u21e7' : ''}${sequence.control ? '\u2318' : ''}${key}`;

  return `${sequence.control ? 'Ctrl+' : ''}${sequence.shift ? 'Shift+' : ''}${key}`;
}

export function matchesKeySequence(sequence: KeySequence, event: KeyboardEvent): boolean {
  const control = isMacPlatform ? event.metaKey : event.ctrlKey;
  const otherControl = isMacPlatform ? event.ctrlKey : event.metaKey;
  if (event.altKey || otherControl) return false;
  if (!!sequence.control !== control || !!sequence.shift !== event.shiftKey) return false;

  return event.key.toLowerCase() === sequence.key.toLowerCase();
}

export const stripMnemonic = (text: string): string => text.replace(/&(.)/g, '$1');

export function eventModifiers(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): Modifiers {
  return { shift: event.shiftKey, control: isMacPlatform ? event.metaKey : event.ctrlKey };
}

export const floatingWindowSelector = '[data-floating-window]';

export const textInputSelector = 'input, textarea, [contenteditable="true"], .cm-content';

export function closestTarget(target: EventTarget | null, selectors: string): Element | null {
  const element = target as Element | null;

  return typeof element?.closest === 'function' ? element.closest(selectors) : null;
}
