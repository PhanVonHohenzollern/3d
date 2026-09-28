import { useLayoutEffect, type RefObject } from 'react';

const kUserScrollEvents = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const;

// Scrolls a list to its selection and follows resizes while the layout settles: a dock tab that
// is still hidden has no height when the selection arrives. Once the user scrolls the list
// themselves, later resizes leave their position alone. `scrollToSelection` must be stable.
export function useScrollSelectionIntoView<Request>(
  containerRef: RefObject<HTMLElement | null>,
  request: Request | null,
  scrollToSelection: (container: HTMLElement, request: Request) => void,
): void {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !request) return;

    const scroll = () => scrollToSelection(container, request);

    const observer = new ResizeObserver(scroll);

    const release = () => observer.disconnect();

    scroll();
    observer.observe(container);
    for (const name of kUserScrollEvents) container.addEventListener(name, release, { passive: true });

    return () => {
      observer.disconnect();
      for (const name of kUserScrollEvents) container.removeEventListener(name, release);
    };
  }, [containerRef, request, scrollToSelection]);
}
