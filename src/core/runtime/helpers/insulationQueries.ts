// SDK insulation queries: `if (getExtInsSize(size))` is true only when the user enabled that
// insulation, and then writes its thickness into `size`.
export const kInsulationQueries = ['getExtInsSize', 'getIntInsSize'] as const;

export type InsulationQuery = (typeof kInsulationQueries)[number];

export function isInsulationQuery(name: string | undefined): name is InsulationQuery {
  return kInsulationQueries.some((query) => query === name);
}
