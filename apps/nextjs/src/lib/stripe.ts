/**
 * Stripe API Client
 * Fetches balance transactions with fee breakdown
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

export interface StripeMonthSummary {
  month: string; // "Jan", "Feb", etc.
  year: number;
  grossAmount: number; // Total charged
  fees: number; // Stripe fees
  netAmount: number; // Amount after fees
  chargeCount: number;
  refunds: number;
  payouts: number;
}

/**
 * Fetch balance transactions for a date range
 */
export async function fetchBalanceTransactions(
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<Stripe.BalanceTransaction[]> {
  const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  const transactions: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.balanceTransactions.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    transactions.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return transactions;
}

/**
 * Get monthly summary of Stripe transactions
 */
export async function getMonthlyStripeSummary(
  startMonth: number,
  endMonth: number,
  year: number
): Promise<StripeMonthSummary[]> {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const results: StripeMonthSummary[] = [];

  for (let m = startMonth; m <= endMonth; m++) {
    const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const endDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;

    const transactions = await fetchBalanceTransactions(startDate, endDate);

    let grossAmount = 0;
    let fees = 0;
    let netAmount = 0;
    let chargeCount = 0;
    let refunds = 0;
    let payouts = 0;

    for (const tx of transactions) {
      // Convert from cents to dollars
      const amount = tx.amount / 100;
      const fee = tx.fee / 100;
      const net = tx.net / 100;

      if (tx.type === "charge") {
        grossAmount += amount;
        fees += fee;
        netAmount += net;
        chargeCount++;
      } else if (tx.type === "refund") {
        refunds += Math.abs(amount);
      } else if (tx.type === "payout") {
        payouts += Math.abs(amount);
      }
    }

    results.push({
      month: MONTH_NAMES[m - 1]!,
      year,
      grossAmount,
      fees,
      netAmount,
      chargeCount,
      refunds,
      payouts,
    });
  }

  return results;
}

/**
 * Get raw balance transactions for debugging
 */
export async function getBalanceTransactionsRaw(
  startDate: string,
  endDate: string,
  limit = 50
): Promise<{
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    fee: number;
    net: number;
    created: string;
    description: string | null;
  }>;
  total: number;
}> {
  const transactions = await fetchBalanceTransactions(startDate, endDate);

  return {
    transactions: transactions.slice(0, limit).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount / 100,
      fee: tx.fee / 100,
      net: tx.net / 100,
      created: new Date(tx.created * 1000).toISOString(),
      description: tx.description,
    })),
    total: transactions.length,
  };
}
