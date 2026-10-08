export type { KeyboardModifiers, MouseEventData, WheelEventData } from '@/shared/lib/qt/input';
export {
  closestTarget,
  eventModifiers,
  floatingWindowSelector,
  keySequenceText,
  matchesKeySequence,
  quitKeySequence,
  stripMnemonic,
  textInputSelector,
} from '@/shared/lib/qt/keyboard';
export type { ChildIndicatorPolicy, KeySequence, Modifiers, SelectionCommand } from '@/shared/lib/qt/qt';
export {
  LeftButton,
  MiddleButton,
  NoButton,
  NoModifier,
  RightButton,
  isDomMiddleButton,
  modifiersFromEvent,
  mouseButtonFromDom,
  mouseButtonsFromDom,
  mouseEventData,
  wheelAngleDeltaY,
} from '@/shared/lib/qt/qtInput';
