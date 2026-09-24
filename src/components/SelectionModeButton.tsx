import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { useSelectionModeButton } from '../hooks/useSelectionModeButton';

interface SelectionModeButtonProps {
  engine: ViewportEngine;
}

export function SelectionModeButton({ engine }: SelectionModeButtonProps) {
  const button = useSelectionModeButton(engine);

  return (
    <button
      type="button"
      className="absolute z-3 m-0 cursor-pointer overflow-hidden rounded-md border border-viewport-button-line bg-viewport-button px-1.5 py-0.5 font-[family-name:inherit] text-[9pt] leading-none font-medium whitespace-nowrap text-viewport-button-fg outline-none hover:border-viewport-button-line-focus hover:bg-viewport-button-hover focus:border-viewport-button-line-focus active:bg-viewport-button-pressed"
      data-object-name="previewSelectionModeButton"
      aria-label="Preview selection mode"
      style={button.style}
      onClick={button.onClick}
      onPointerEnter={button.onPointerEnter}
      onFocus={button.onFocus}
      onContextMenu={button.onContextMenu}
    >
      {button.text}
    </button>
  );
}
