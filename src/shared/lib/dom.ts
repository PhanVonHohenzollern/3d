export function capturePointer(element: Element, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);

    return true;
  } catch {
    return false;
  }
}

export function isOnScrollbar(event: { currentTarget: Element; clientX: number; clientY: number }): boolean {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();

  return (
    event.clientX - rect.left >= element.clientLeft + element.clientWidth ||
    event.clientY - rect.top >= element.clientTop + element.clientHeight
  );
}
