import { describe, expect, it } from 'vitest';
import { containerPageSize } from '../src/helpers/pagination';

describe('Inspector page capacity', () => {
  it('reserves table headers and navigation when fitting rows', () => {
    expect(containerPageSize(600, 196, 28, 28)).toEqual({ columns: 1, pageSize: 5 });
    expect(containerPageSize(600, 195, 28, 28)).toEqual({ columns: 1, pageSize: 4 });
  });
  it('adapts parameter grids to both container dimensions', () => {
    expect(containerPageSize(680, 212, 86, 12, 170)).toEqual({ columns: 4, pageSize: 8 });
    expect(containerPageSize(354, 126, 86, 12, 170)).toEqual({ columns: 2, pageSize: 2 });
    expect(containerPageSize(300, 126, 86, 12, 170)).toEqual({ columns: 1, pageSize: 1 });
  });
  it('retains one reachable item before the container is measured', () => {
    expect(containerPageSize(0, 0, 28, 28)).toEqual({ columns: 1, pageSize: 1 });
  });
});
