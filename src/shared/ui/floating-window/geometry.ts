export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function initialFloatingGeometry(viewportWidth: number, viewportHeight: number): WindowGeometry {
  const width = Math.max(Math.min(1380, viewportWidth - 60), 320);
  const height = Math.max(Math.min(720, viewportHeight - 60), 200);

  return {
    x: Math.max((viewportWidth - width) / 2, 0),
    y: Math.max((viewportHeight - height) / 2, 0),
    width,
    height,
  };
}

export function movedFloatingGeometry(
  start: WindowGeometry,
  dx: number,
  dy: number,
  viewportWidth: number,
  viewportHeight: number,
): WindowGeometry {
  return {
    ...start,
    x: Math.min(Math.max(start.x + dx, 40 - start.width), viewportWidth - 40),
    y: Math.min(Math.max(start.y + dy, 0), viewportHeight - 24),
  };
}

export function resizedFloatingGeometry(start: WindowGeometry, dx: number, dy: number): WindowGeometry {
  return { ...start, width: Math.max(start.width + dx, 320), height: Math.max(start.height + dy, 160) };
}
