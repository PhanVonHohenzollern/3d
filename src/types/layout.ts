import type { KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react';

export interface SplitterOptions {
  orientation: 'horizontal' | 'vertical';
  initialSizes: [number, number];
  stretchFactors?: [number, number];
}

export interface SplitterProps extends SplitterOptions {
  className?: string;
  label: string;
  children: [ReactNode, ReactNode];
}

export interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical';
  label: string;
  value: number;
  min: number;
  max: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}
