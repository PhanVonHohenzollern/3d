export function capturePointer(element: Element, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);

    return true;
  } catch {
    return false;
  }
}
