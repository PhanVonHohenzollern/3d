export interface FontSpec {
  family: string;
  pixelSize: number;
  bold: boolean;
}

export interface TextMeasurer {
  horizontalAdvance(text: string, font: FontSpec): number;
  ascent(font: FontSpec): number;
  descent(font: FontSpec): number;
}

export type TextElideMode = 'ElideRight' | 'ElideMiddle';
