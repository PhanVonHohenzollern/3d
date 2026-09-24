import type { KeyboardModifiers } from './input';

export type Modifiers = Pick<KeyboardModifiers, 'control' | 'shift'>;

export interface KeySequence {
  key: string;
  control?: boolean;
  shift?: boolean;
}

export type ChildIndicatorPolicy = 'ShowIndicator' | 'DontShowIndicator' | 'DontShowIndicatorWhenChildless';

export type SelectionCommand = 'NoUpdate' | 'ClearAndSelect' | 'Select' | 'Toggle' | 'SelectCurrent';
