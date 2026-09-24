import type { Token } from '../helpers/tokens';

export const StatementKind = {
  Block: 0,
  Simple: 1,
  If: 2,
  For: 3,
  Function: 4,
  Empty: 5,
  While: 6,
  Do: 7,
  Switch: 8,
  Case: 9,
} as const;
export type StatementKind = (typeof StatementKind)[keyof typeof StatementKind];

export class Statement {
  endLine = 1;
  tokens: Token[] = [];
  condition: Token[] = [];
  forInit: Token[] = [];
  forCondition: Token[] = [];
  forIncrement: Token[] = [];
  children: Statement[] = [];
  thenBranch: Statement | null = null;
  elseBranch: Statement | null = null;
  body: Statement | null = null;
  signature: Token[] = [];
  functionName = '';

  constructor(
    public kind: StatementKind = StatementKind.Empty,
    public startLine = 1,
  ) {}
}
