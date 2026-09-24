import type { SelectionCommand, SelectionOp } from '../../types/viewportEngine';
import { setsEqual } from '../../utils/sets';

export class ItemSelectionModel {
  private m_ranges = new Set<number>();
  private m_currentSelection = new Set<number>();
  private m_currentCommand: SelectionOp = 'Select';

  clear(): void {
    this.m_ranges.clear();
    this.m_currentSelection.clear();
  }

  isSelected(row: number): boolean {
    if (row < 0) return false;
    const committed = this.m_ranges.has(row);
    if (!this.m_currentSelection.has(row)) return committed;
    if (this.m_currentCommand === 'Select') return true;
    if (this.m_currentCommand === 'Deselect') return false;
    return !committed;
  }

  selectedRows(): Set<number> {
    const result = new Set(this.m_ranges);
    for (const row of this.m_currentSelection) {
      if (this.m_currentCommand === 'Select') result.add(row);
      else if (this.m_currentCommand === 'Deselect') result.delete(row);
      else if (result.has(row)) result.delete(row);
      else result.add(row);
    }
    return result;
  }

  select(rows: readonly number[], command: SelectionCommand, rowCount: number): boolean {
    const old = this.selectedRows();
    if (command.clear) this.clear();
    if (!command.current) this.finalize();
    if (command.op) {
      this.m_currentCommand = command.op;
      this.m_currentSelection = new Set(rows.filter((row) => row >= 0 && row < rowCount));
    }
    return !setsEqual(old, this.selectedRows());
  }

  private finalize(): void {
    this.m_ranges = this.selectedRows();
    this.m_currentSelection = new Set();
  }
}
