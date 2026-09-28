import { qColor } from '@/shared/lib/painting';
import type { FontSpec, TextMeasurer } from '@/shared/lib/text';
import { approximateTextMeasurer, fontWithPointSize, kDefaultFontFamily, pointSizeToPixels } from '@/shared/lib/text';
import {
  kButtonGap,
  kExtraControlHeight,
  kPointLabels,
  kVectorLabels,
  kWidgetFontPointSize,
  kWidgetMargin,
} from '@/widgets/viewport/config/viewport';
import { QRect, QRectF } from '@/widgets/viewport/lib/math/Rect';
import type { QPoint } from '@/widgets/viewport/lib/math/Vector3D';
import type { CameraController } from '@/widgets/viewport/lib/render/CameraController';
import { drawConnectorPoints } from '@/widgets/viewport/lib/render/connectorOverlay';
import { DebugLabelPanel } from '@/widgets/viewport/lib/render/DebugLabelPanel';
import { drawDebugItems, drawPreselection, type DebugOverlayScene } from '@/widgets/viewport/lib/render/debugOverlay';
import { OverlayPainter } from '@/widgets/viewport/lib/render/OverlayPainter';
import { debugLabelPanelsLayout } from '@/widgets/viewport/lib/render/panelLayout';
import type { AxisLabel, DebugLabelEntry, SelectionModeButtonState } from '@/widgets/viewport/lib/render/types';
import type { ViewportState } from '@/widgets/viewport/lib/render/ViewportState';
import { drawWorldAxisLabels, placeWorldAxisLabels } from '@/widgets/viewport/lib/render/worldAxes';

// The 2D layer over the GL scene: debug point and vector labels, the label panels, the selection
// buttons, connector points and the world axis labels.
export class OverlayLayer {
  readonly pointLabels = new DebugLabelPanel(kPointLabels.title, qColor(...kPointLabels.color));
  readonly vectorLabels = new DebugLabelPanel(kVectorLabels.title, qColor(...kVectorLabels.color));
  #selectionModeButton: SelectionModeButtonState = { text: '', geometry: new QRect() };
  #measurer: TextMeasurer = approximateTextMeasurer;
  #fontFamily = kDefaultFontFamily;
  #fontPixelSize = pointSizeToPixels(kWidgetFontPointSize);

  constructor(
    private readonly state: ViewportState,
    private readonly view: CameraController,
    // Called when the selection-mode button changes, so React re-renders it.
    private readonly buttonChanged: () => void,
  ) {}

  get panels(): readonly DebugLabelPanel[] {
    return [this.pointLabels, this.vectorLabels];
  }

  get measurer(): TextMeasurer {
    return this.#measurer;
  }

  selectionModeButton(): SelectionModeButtonState {
    return this.#selectionModeButton;
  }

  setSelectionModeButton(state: Partial<SelectionModeButtonState>): void {
    const next = { ...this.#selectionModeButton, ...state };
    const g = next.geometry;
    const o = this.#selectionModeButton.geometry;
    if (
      next.text === this.#selectionModeButton.text &&
      g.x === o.x &&
      g.y === o.y &&
      g.width === o.width &&
      g.height === o.height
    )
      return;
    this.#selectionModeButton = next;
    this.buttonChanged();
  }

  presentationButtonRect(): QRect {
    const rect = this.#selectionModeButton.geometry;

    return new QRect(rect.x, Math.max(0, rect.y - rect.height - kButtonGap), rect.width, rect.height);
  }

  // Whether an overlay widget covers this point, so the scene under it is not hovered.
  covers(p: QPoint): boolean {
    if (this.#selectionModeButton.geometry.contains(p)) return true;
    if (this.presentationButtonRect().contains(p)) return true;

    return this.panels.some((panel) => panel.isVisible() && panel.geometry().contains(p));
  }

  setFont(family: string, pixelSize: number): void {
    this.#fontFamily = family;
    this.#fontPixelSize = pixelSize;
    for (const panel of this.panels) panel.setFontFamily(family);
  }

  setTextMeasurer(measurer: TextMeasurer): void {
    this.#measurer = measurer;
    for (const panel of this.panels) panel.setTextMeasurer(measurer);
  }

  updateLabelPanels(width: number, height: number): void {
    const points: DebugLabelEntry[] = [];
    const vectors: DebugLabelEntry[] = [];
    const seen = new Set<string>();
    for (const item of this.state.debugItems) {
      if (!this.state.isDebugItemVisible(item) || seen.has(item.name)) continue;
      seen.add(item.name);
      const entry: DebugLabelEntry = {
        id: item.name,
        name: item.label === '' ? item.name : item.label,
        value: item.valueText,
      };
      (item.kind === 'Point' ? points : vectors).push(entry);
    }
    this.pointLabels.setEntries(points, this.state.selectedVariables);
    this.vectorLabels.setEntries(vectors, this.state.selectedVariables);
    this.layout(width, height);
  }

  layout(width: number, height: number): void {
    const layout = debugLabelPanelsLayout({
      extraControlHeight: kExtraControlHeight,
      width,
      height,
      pointContentHeight: this.pointLabels.contentHeight(),
      vectorContentHeight: this.vectorLabels.contentHeight(),
      showLabels: this.state.showLabels,
      apiFocusActive: this.state.apiFocusActive,
    });
    this.setSelectionModeButton({ geometry: layout.button });
    this.pointLabels.setGeometry(layout.point.x, layout.point.y, layout.point.width, layout.point.height);
    this.vectorLabels.setGeometry(layout.vector.x, layout.vector.y, layout.vector.width, layout.vector.height);
    this.pointLabels.setVisible(layout.pointVisible);
    this.vectorLabels.setVisible(layout.vectorVisible);
  }

  paint(context: CanvasRenderingContext2D, devicePixelRatio: number, width: number, height: number): void {
    const { state, view } = this;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const painter = new OverlayPainter(context, this.#measurer, this.#widgetFont());

    const scene = this.#debugScene();
    drawDebugItems(painter, scene);
    drawPreselection(painter, { ...scene, isVisible: (item) => state.isDebugItemPickable(item) });
    if (!state.apiFocusActive)
      drawConnectorPoints(
        painter,
        state.connectors,
        state.selectedConnectorId,
        state.hoveredConnectorId,
        this.#measurer,
        view.projectToScreen,
      );
    drawWorldAxisLabels(painter, this.#axisLabels(width, height), this.#axisLabelFont());
  }

  #debugScene(): DebugOverlayScene {
    const { state, view } = this;

    return {
      items: state.debugItems,
      selected: state.selectedVariables,
      hovered: state.hoveredDebugItem,
      showLabels: state.showLabels,
      isVisible: (item) => state.isDebugItemVisible(item),
      project: view.projectToScreen,
      selectedRowRect: (item) =>
        (item.kind === 'Point' ? this.pointLabels : this.vectorLabels).selectedRowRect(item.name),
      vectorArrow: (item) => view.vectorArrow(item),
    };
  }

  #axisLabels(width: number, height: number): AxisLabel[] {
    const margin = kWidgetMargin;
    const occupied: QRectF[] = [];
    for (const panel of this.panels)
      if (panel.isVisible())
        occupied.push(QRectF.fromRect(panel.geometry()).adjusted(-margin, -margin, margin, margin));
    occupied.push(QRectF.fromRect(this.#selectionModeButton.geometry).adjusted(-margin, -margin, margin, margin));
    occupied.push(QRectF.fromRect(this.presentationButtonRect()).adjusted(-margin, -margin, margin, margin));

    return placeWorldAxisLabels({
      axes: this.view.axes,
      transform: this.view.camera.viewProjection(),
      width,
      height,
      occupied,
      measurer: this.#measurer,
      font: this.#axisLabelFont(),
    });
  }

  #widgetFont(): FontSpec {
    return { family: this.#fontFamily, pixelSize: this.#fontPixelSize, bold: false };
  }

  #axisLabelFont(): FontSpec {
    return fontWithPointSize(this.#fontFamily, kWidgetFontPointSize, true);
  }
}
