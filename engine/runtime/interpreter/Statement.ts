import type { Token } from '@engine/runtime/helpers/tokens';

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

export interface StatementVisitor<Result, Context = void> {
  visitBlock(node: Statement, context: Context): Result;
  visitSimple(node: Statement, context: Context): Result;
  visitIf(node: Statement, context: Context): Result;
  visitFor(node: Statement, context: Context): Result;
  visitFunction(node: Statement, context: Context): Result;
  visitEmpty(node: Statement, context: Context): Result;
  visitWhile(node: Statement, context: Context): Result;
  visitDo(node: Statement, context: Context): Result;
  visitSwitch(node: Statement, context: Context): Result;
  visitCase(node: Statement, context: Context): Result;
}

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

  accept<Result, Context>(visitor: StatementVisitor<Result, Context>, context: Context): Result {
    switch (this.kind) {
      case StatementKind.Block:
        return visitor.visitBlock(this, context);
      case StatementKind.Simple:
        return visitor.visitSimple(this, context);
      case StatementKind.If:
        return visitor.visitIf(this, context);
      case StatementKind.For:
        return visitor.visitFor(this, context);
      case StatementKind.Function:
        return visitor.visitFunction(this, context);
      case StatementKind.Empty:
        return visitor.visitEmpty(this, context);
      case StatementKind.While:
        return visitor.visitWhile(this, context);
      case StatementKind.Do:
        return visitor.visitDo(this, context);
      case StatementKind.Switch:
        return visitor.visitSwitch(this, context);
      case StatementKind.Case:
        return visitor.visitCase(this, context);
    }
  }
}
