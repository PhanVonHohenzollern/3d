import { RightButton } from '../../helpers/qtInput';
import type { KeyboardModifiers } from '../../types/input';
import type { SelectionCommand, SelectionEvent } from '../../types/viewportEngine';

export const NoUpdate: SelectionCommand = {};
export const ClearAndSelect: SelectionCommand = { clear: true, op: 'Select' };

export const isNoUpdate = (command: SelectionCommand) => !command.clear && !command.op;

export interface ExtendedSelectionState {
  rowSelected: boolean;
  pressedRow: number;
  dragSelecting: boolean;
}

export function extendedSelectionCommand(
  row: number,
  event: SelectionEvent,
  state: ExtendedSelectionState,
): SelectionCommand {
  const shift = event.modifiers.shift;
  const control = event.modifiers.control;
  if (event.type === 'move') {
    if (control) return { current: true, op: 'Toggle' };
  } else if (event.type === 'press') {
    const rightButtonPressed = event.button === RightButton;
    if ((shift || control) && rightButtonPressed) return NoUpdate;
    if (!shift && !control && state.rowSelected) return NoUpdate;
    if (row < 0 && !rightButtonPressed && !shift && !control) return { clear: true };
    if (row < 0) return NoUpdate;
  } else {
    const rightButtonPressed = event.button === RightButton;
    if (
      ((row === state.pressedRow && row >= 0 && state.rowSelected) || row < 0) &&
      !state.dragSelecting &&
      !shift &&
      !control &&
      (!rightButtonPressed || row < 0)
    )
      return ClearAndSelect;
    return NoUpdate;
  }
  if (shift) return { current: true, op: 'Select' };
  if (control) return { op: 'Toggle' };
  if (state.dragSelecting) return { clear: true, current: true, op: 'Select' };
  return ClearAndSelect;
}

export function isListKey(key: string, modifiers: KeyboardModifiers): boolean {
  if (isSelectAllKey(key, modifiers) && !modifiers.alt) return true;
  return ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' '].includes(key);
}

export function isSelectAllKey(key: string, modifiers: KeyboardModifiers): boolean {
  return (key === 'a' || key === 'A') && modifiers.control;
}

export function moveCursor(key: string, current: number, count: number, pageRows: number): number {
  if (count === 0) return -1;
  if (current < 0) return 0;
  switch (key) {
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'ArrowDown':
      return Math.min(count - 1, current + 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'PageUp':
      return Math.max(0, current - pageRows);
    case 'PageDown':
      return Math.min(count - 1, current + pageRows);
    default:
      return current;
  }
}

export function rowRange(first: number, last: number): number[] {
  const rows: number[] = [];
  for (let row = first; row <= last; ++row) rows.push(row);
  return rows;
}
