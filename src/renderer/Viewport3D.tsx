// Port of renderer/Viewport3D: the React wrapper around ViewportEngine.
//
// The engine holds all widget state and logic (a member-for-member port of
// the C++ class). This component owns the DOM that QOpenGLWidget and its
// children provided: the WebGL canvas, the 2D overlay canvas that replaces the
// QPainter pass, the Points / Vectors lists and the bottom-left Select button.
// It forwards resize, mouse and wheel events, and exposes the engine through
// the Viewport3DHandle ref; the C++ set...Callback() setters are props.

import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { DebugLabelPanelView } from './DebugLabelPanelView';
import {
  NoButton,
  modifiersFromEvent,
  mouseButtonFromDom,
  mouseButtonsFromDom,
  wheelAngleDeltaY,
  type MouseEventData,
} from './QtEvents';
import { pointSizeToPixels } from './TextMetrics';
import { ViewportEngine, kSelectionButtonFontSize } from './ViewportEngine';
import type { Viewport3DHandle, Viewport3DProps } from './Viewport3DHandle';
import './Viewport3D.css';

/** setPointerCapture, tolerating pointers the browser no longer tracks (synthetic events). */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Not an active pointer: events simply are not captured.
  }
}

function createViewport3DHandle(engine: ViewportEngine): Viewport3DHandle {
  return {
    setRuntimeResult: (result) => engine.setRuntimeResult(result),
    setShowPoints: (visible) => engine.setShowPoints(visible),
    setShowVectors: (visible) => engine.setShowVectors(visible),
    setShowLabels: (visible) => engine.setShowLabels(visible),
    setDebugItemVisible: (name, visible) => engine.setDebugItemVisible(name, visible),
    hideAllDebugItems: () => engine.hideAllDebugItems(),
    showAllDebugItems: () => engine.showAllDebugItems(),
    setSelectedVariable: (name) => engine.setSelectedVariable(name),
    setSelectedVariables: (names) => engine.setSelectedVariables(names),
    selectedDebugItems: () => engine.selectedDebugItems(),
    fitDebugOverlay: () => engine.fitDebugOverlay(),
    setGeometryScene: (scene) => engine.setGeometryScene(scene),
    setShowGeometry: (visible) => engine.setShowGeometry(visible),
    setGeometryWireframe: (wireframe) => engine.setGeometryWireframe(wireframe),
    setSelectedApiCall: (apiIndex, keepMeshSelection = false) => engine.setSelectedApiCall(apiIndex, keepMeshSelection),
    selectedMeshIndex: () => engine.selectedMeshIndex(),
    isMeshSelected: (meshIndex) => engine.isMeshSelected(meshIndex),
    hasApiFocus: () => engine.hasApiFocus(),
    hasMeshFocus: () => engine.hasMeshFocus(),
    setApiFocusIndices: (indices) => engine.setApiFocusIndices(indices),
    clearApiFocus: () => engine.clearApiFocus(),
    fitScene: () => engine.fitScene(),
    setConnectorPreviews: (connectors, selectedId) => engine.setConnectorPreviews(connectors, selectedId),
  };
}

export function Viewport3D({ ref, ...props }: Viewport3DProps & { ref?: Ref<Viewport3DHandle> }) {
  const [engine] = useState(() => new ViewportEngine());
  const hostRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  // Qt::MouseButtons currently held on the viewport (chorded presses arrive as pointermove).
  const buttonsRef = useRef(0);

  // The callbacks read the latest props when they fire, so they are never stale.
  const propsRef = useRef<Viewport3DProps>(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  useLayoutEffect(() => {
    engine.setSelectionChangedCallback((names) => propsRef.current.onSelectionChanged?.(names));
    engine.setPointCreationCallback((point) => propsRef.current.onPointCreation?.(point));
    engine.setMeshSelectionCallback((apiIndex, sourceLine) => propsRef.current.onMeshSelection?.(apiIndex, sourceLine));
    engine.setConnectorSelectionCallback((id) => propsRef.current.onConnectorSelection?.(id));
    return () => {
      engine.setSelectionChangedCallback(null);
      engine.setPointCreationCallback(null);
      engine.setMeshSelectionCallback(null);
      engine.setConnectorSelectionCallback(null);
    };
  }, [engine]);

  useImperativeHandle(ref, () => createViewport3DHandle(engine), [engine]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const glCanvas = glCanvasRef.current;
    const overlay = overlayRef.current;
    if (!host || !glCanvas || !overlay) return;
    const style = getComputedStyle(host);
    engine.attach({
      glCanvas,
      overlay,
      cursorElement: overlay,
      fontFamily: style.fontFamily,
      fontPixelSize: Number.parseFloat(style.fontSize) || pointSizeToPixels(9),
    });

    const measure = () => engine.resize(host.clientWidth, host.clientHeight, window.devicePixelRatio || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    // devicePixelRatio changes (browser zoom, moving to another monitor) resize the backing store.
    let media: MediaQueryList | null = null;
    const onDevicePixelRatioChange = () => {
      measure();
      watchDevicePixelRatio();
    };
    const watchDevicePixelRatio = () => {
      media?.removeEventListener('change', onDevicePixelRatioChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onDevicePixelRatioChange);
    };
    watchDevicePixelRatio();

    // Wheel zoom; not passive, so the page neither scrolls nor zooms (Ctrl+wheel / pinch).
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = overlay.getBoundingClientRect();
      engine.wheelEvent({ x: e.clientX - rect.left, y: e.clientY - rect.top, angleDeltaY: wheelAngleDeltaY(e) });
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      overlay.removeEventListener('wheel', onWheel);
      media?.removeEventListener('change', onDevicePixelRatioChange);
      observer.disconnect();
      engine.detach();
    };
  }, [engine]);

  const pointPanel = engine.pointLabelPanel();
  const vectorPanel = engine.vectorLabelPanel();
  const selectionModeButton = useSyncExternalStore(engine.subscribeWidgets, engine.selectionModeButton);

  const mouseData = (e: PointerEvent<HTMLCanvasElement>, button: number, buttons: number): MouseEventData => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, button, buttons, modifiers: modifiersFromEvent(e) };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    // Qt::StrongFocus: clicking focuses the viewport.
    hostRef.current?.focus({ preventScroll: true });
    e.preventDefault();
    // The widget grabs the mouse while a button is held.
    capturePointer(e.currentTarget, e.pointerId);
    const button = mouseButtonFromDom(e.button);
    buttonsRef.current = mouseButtonsFromDom(e.buttons) | button;
    engine.mousePressEvent(mouseData(e, button, buttonsRef.current));
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const buttons = mouseButtonsFromDom(e.buttons);
    if (e.button >= 0 && buttons !== buttonsRef.current) {
      // Another button was pressed or released while one is held.
      const button = mouseButtonFromDom(e.button);
      buttonsRef.current = buttons;
      if (buttons & button) engine.mousePressEvent(mouseData(e, button, buttons));
      else engine.mouseReleaseEvent(mouseData(e, button, buttons));
      return;
    }
    buttonsRef.current = buttons;
    engine.mouseMoveEvent(mouseData(e, NoButton, buttons));
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    buttonsRef.current = mouseButtonsFromDom(e.buttons);
    engine.mouseReleaseEvent(mouseData(e, mouseButtonFromDom(e.button), buttonsRef.current));
  };

  const onPointerCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    // The gesture was taken over (e.g. by the browser): end it without a click.
    buttonsRef.current = 0;
    engine.mouseReleaseEvent(mouseData(e, NoButton, 0));
  };

  const suppress = (e: MouseEvent) => e.preventDefault();

  return (
    <div ref={hostRef} className="viewport3d" tabIndex={0}>
      <canvas ref={glCanvasRef} className="viewport3d-canvas viewport3d-gl" aria-hidden />
      <canvas
        ref={overlayRef}
        className="viewport3d-canvas viewport3d-overlay"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => engine.leaveEvent()}
        onMouseDown={suppress}
        onAuxClick={suppress}
        onContextMenu={suppress}
      />
      <DebugLabelPanelView panel={pointPanel} onEnterOrFocus={() => engine.eventFilter('Enter')} />
      <DebugLabelPanelView panel={vectorPanel} onEnterOrFocus={() => engine.eventFilter('Enter')} />
      <button
        type="button"
        className="viewport3d-selection-mode"
        data-object-name="previewSelectionModeButton"
        aria-label="Preview selection mode"
        style={{
          left: selectionModeButton.geometry.x,
          top: selectionModeButton.geometry.y,
          width: selectionModeButton.geometry.width,
          height: selectionModeButton.geometry.height,
          fontSize: `${kSelectionButtonFontSize}pt`,
        }}
        onClick={() => engine.selectionModeButtonClicked()}
        onPointerEnter={() => engine.eventFilter('Enter')}
        onFocus={() => engine.eventFilter('FocusIn')}
        onContextMenu={suppress}
      >
        {selectionModeButton.text}
      </button>
    </div>
  );
}
