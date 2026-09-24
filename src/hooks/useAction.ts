import { keySequenceText, stripMnemonic } from '../helpers/keyboard';
import type { Action } from './mainWindow/Action';
import { useObservable } from './useObservable';

export function useAction(action: Action, onTriggered?: () => void) {
  useObservable(action);
  const shortcut = action.shortcut();

  return {
    menuText: stripMnemonic(action.text),
    iconText: action.iconText(),
    shortcutText: shortcut ? keySequenceText(shortcut) : '',
    checkable: action.isCheckable(),
    checked: action.isCheckable() && action.isChecked(),
    trigger: () => {
      onTriggered?.();
      action.trigger();
    },
  };
}
