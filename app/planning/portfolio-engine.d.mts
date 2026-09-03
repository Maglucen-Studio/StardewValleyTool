export type PortfolioConflict = { kind: string; id?: string; required: number; available: number };
export type PortfolioResult = { totals: { money: number; space: number; profit: number; revenue: number; items: number; inventory: Record<string, number>; machines: Record<string, number> }; conflicts: PortfolioConflict[]; feasible: boolean };
export function evaluateProductionPortfolio(plans: Array<Record<string, unknown>>, available?: Record<string, unknown>): PortfolioResult;
