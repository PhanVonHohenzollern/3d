import type { TreeMouseEvent } from '../../types/treeView';
import { TreeWidget } from '../treeWidget/TreeWidget';
import type { TreeWidgetItem } from '../treeWidget/TreeWidgetItem';

export class TraceTree extends TreeWidget {
  #anchor: TreeWidgetItem | null = null;
  #rangePress = false;

  override mousePressEvent(event: TreeMouseEvent): void {
    const index = event.item;
    const anchor = this.#anchor && this.#anchor.treeWidget() === this ? this.#anchor : null;
    this.#rangePress =
      event.modifiers.shift && !!anchor && !!index && this.isItemVisible(anchor) && this.isItemVisible(index);
    if (this.#rangePress) {
      this.setCurrentNoUpdate(index);
      this.selectVisualRange(anchor!, index!, event.modifiers.control ? 'Select' : 'ClearAndSelect');
    } else {
      super.mousePressEvent(event);
      this.#anchor = index;
    }
  }

  override mouseReleaseEvent(event: TreeMouseEvent): void {
    if (!this.#rangePress) {
      super.mouseReleaseEvent(event);

      return;
    }
    this.#rangePress = false;
    if (event.item) this.emitSignal(this.itemClicked, event.item, event.column);
  }
}
