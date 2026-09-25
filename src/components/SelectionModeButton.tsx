import { Box, CircleDot, MoveUpRight } from 'lucide-react';
import type { ViewportEngine } from '../core/viewport/ViewportEngine';
import { useSelectionModeButton } from '../hooks/useSelectionModeButton';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface SelectionModeButtonProps {
  engine: ViewportEngine;
}

export function SelectionModeButton({ engine }: SelectionModeButtonProps) {
  const button = useSelectionModeButton(engine);
  const Icon = button.text === 'Mesh' ? Box : button.text === 'Vector' ? MoveUpRight : CircleDot;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute z-3 border-viewport-button-line bg-viewport-button px-2 text-xs text-viewport-button-fg shadow-md hover:bg-viewport-button-hover"
            style={button.presentationStyle}
            onClick={button.togglePresentation}
            aria-label={`Selection display: ${button.presentation}`}
            onPointerEnter={button.onPointerEnter}
            onFocus={button.onFocus}
          >
            {button.presentation}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {button.presentation === 'Separate'
            ? 'Separate: focus the selected part. Click for Unite.'
            : 'Unite: transparent meshes and all points/vectors. Click again at the same position to select objects behind it.'}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute z-3 gap-2 overflow-hidden border-viewport-button-line bg-viewport-button px-2 text-xs text-viewport-button-fg shadow-md hover:border-viewport-button-line-focus hover:bg-viewport-button-hover hover:text-viewport-button-fg focus-visible:ring-viewport-button-line-focus active:bg-viewport-button-pressed dark:border-viewport-button-line dark:bg-viewport-button dark:hover:bg-viewport-button-hover"
            data-object-name="previewSelectionModeButton"
            aria-label={`Selection mode: ${button.text}. Click to change mode.`}
            style={button.style}
            onClick={button.onClick}
            onPointerEnter={button.onPointerEnter}
            onFocus={button.onFocus}
            onContextMenu={button.onContextMenu}
          >
            <Icon className="size-3.5" aria-hidden />
            {button.text}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" sideOffset={8}>
          Select {button.text === 'Mesh' ? 'meshes' : `${button.text.toLowerCase()}s`}. Click to cycle Point, Vector,
          and Mesh.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
