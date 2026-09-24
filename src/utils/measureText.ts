import { CanvasTextMeasurer } from './CanvasTextMeasurer';

let measurer: CanvasTextMeasurer | null | undefined;
let bodyFont: { family: string; pixelSize: number } | undefined;

function defaultFont(): { family: string; pixelSize: number } {
  if (!bodyFont && typeof document !== 'undefined' && document.body) {
    const style = getComputedStyle(document.body);
    bodyFont = { family: style.fontFamily, pixelSize: parseFloat(style.fontSize) };
  }
  return bodyFont ?? { family: 'sans-serif', pixelSize: 13 };
}

export function textWidth(text: string, bold = false): number {
  if (!text) return 0;
  if (measurer === undefined) measurer = CanvasTextMeasurer.create();
  if (!measurer) return text.length * 7;
  return measurer.horizontalAdvance(text, { ...defaultFont(), bold });
}
