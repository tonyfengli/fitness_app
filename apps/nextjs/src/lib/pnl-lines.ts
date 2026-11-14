/**
 * A month's P&L lines from its reconciliation data (what pnl_monthly_snapshot.data holds).
 * One calculation for the P&L tab and the monthly KPI pages in Notion:
 *   revenue  = Stripe charged net of refunds (gross of fees) + QuickBooks other income
 *   expenses = QuickBooks expense categories + Stripe processing fees
 */

import type { ExpenseBreakdown, MonthlyReconciliation } from "~/lib/revenue-reconciliation";

export type PnlExpenses = ExpenseBreakdown & { stripeFees: number };

export interface PnlLines {
  stripeRevenue: number;
  otherIncome: number;
  allRevenue: number;
  expenses: number;
  expenseBreakdown: PnlExpenses;
  netIncome: number;
}

export const EMPTY_EXPENSES: ExpenseBreakdown = {
  advertisingMarketing: 0,
  contractLabor: 0,
  appsSoftware: 0,
  materialsSupplies: 0,
  liabilityInsurance: 0,
  utilities: 0,
  repairsMaintenance: 0,
  businessLicenses: 0,
  clientCompensation: 0,
  other: 0,
  total: 0,
};

export function pnlLines(rec: Pick<MonthlyReconciliation, "stripe" | "quickbooks">): PnlLines {
  const stripeRevenue = rec.stripe.gross - rec.stripe.refunds;
  const otherIncome = rec.quickbooks.otherIncome;
  const allRevenue = stripeRevenue + otherIncome;
  const qbExpenses = rec.quickbooks.expenses || EMPTY_EXPENSES;
  const stripeFees = rec.stripe.fees;
  const expenseBreakdown: PnlExpenses = { ...qbExpenses, stripeFees, total: qbExpenses.total + stripeFees };
  const expenses = expenseBreakdown.total;
  return { stripeRevenue, otherIncome, allRevenue, expenses, expenseBreakdown, netIncome: allRevenue - expenses };
}
