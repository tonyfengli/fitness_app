/**
 * Revenue Reconciliation API
 * GET /api/admin/revenue-reconciliation?year=2026
 *
 * Compares GymMaster P&L revenue to Stripe charges to QuickBooks income to bank deposits.
 * Uses deterministic date matching (charge/payment date) for reconciliation.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { fetchProfitAndLoss } from "~/lib/quickbooks";
import { validateApiAccess } from "~/lib/api-auth";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

// Expense categories we track
interface ExpenseBreakdown {
  advertisingMarketing: number;
  contractLabor: number;
  appsSoftware: number;
  materialsSupplies: number;
  liabilityInsurance: number;
  utilities: number;
  repairsMaintenance: number;
  businessLicenses: number;
  clientCompensation: number;
  other: number;
  total: number;
}

// Monthly reconciliation data
interface MonthlyReconciliation {
  month: string; // "2026-01"
  monthName: string; // "Jan 2026"
  gymMaster: {
    gross: number;
    refunds: number;
    net: number;
  };
  stripe: {
    gross: number;
    fees: number;
    feePercent: number;
    refunds: number;
    net: number;
  };
  quickbooks: {
    income: number;
    stripeIncome: number;
    otherIncome: number;
    expenses: ExpenseBreakdown;
    netIncome: number;
    connected: boolean;
  };
  payouts: number;
  variance: number;
  variancePercent: number;
  isReconciled: boolean;
}

interface RevenueReconciliationResponse {
  year: number;
  months: MonthlyReconciliation[];
  quickbooksConnected: boolean;
  totals: {
    gymMasterGross: number;
    gymMasterRefunds: number;
    gymMasterNet: number;
    stripeGross: number;
    stripeFees: number;
    stripeFeePercent: number;
    stripeRefunds: number;
    stripeNet: number;
    quickbooksIncome: number;
    quickbooksStripeIncome: number;
    quickbooksOtherIncome: number;
    quickbooksExpenses: ExpenseBreakdown;
    quickbooksNetIncome: number;
    payouts: number;
    variance: number;
    variancePercent: number;
    isReconciled: boolean;
  };
}

// Fetch GymMaster payments from Report 103
async function fetchGymMasterPayments(
  startDate: string,
  endDate: string
): Promise<{ gross: number; refunds: number }> {
  const baseUrl = process.env.GYMMASTER_BASE_URL;
  const apiKey = process.env.GYMMASTER_REPORT_API_KEY;

  const response = await fetch(`${baseUrl}/api/v2/report/standard_report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-GM-API-KEY": apiKey!,
    },
    body: JSON.stringify({
      report_id: 103, // ALL_PAYMENTS
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const data = await response.json();
  const payments = data.result || [];

  let gross = 0;
  let refunds = 0;

  for (const payment of payments) {
    const amount = parseFloat(
      String(payment["Payment Amount"] || "0").replace(/[$,]/g, "")
    );
    const method = String(payment["Payment Method"] || "").toLowerCase();

    // Only count Stripe/Billing payments
    const isStripePayment =
      method.includes("billing") ||
      method.includes("stripe") ||
      method.includes("online payment");

    if (isStripePayment) {
      if (amount >= 0) {
        gross += amount;
      } else {
        refunds += Math.abs(amount);
      }
    }
  }

  return { gross, refunds };
}

// Fetch Stripe charges using Charges API (matches GymMaster payment dates)
async function fetchStripeCharges(
  startDate: string,
  endDate: string
): Promise<{ gross: number; count: number }> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  let gross = 0;
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().charges.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const charge of response.data) {
      if (charge.status === "succeeded" && charge.paid) {
        gross += charge.amount / 100;
        count++;
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return { gross, count };
}

// Fetch Stripe fees from Balance Transactions
async function fetchStripeFees(startDate: string, endDate: string): Promise<number> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  let fees = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().balanceTransactions.list({
      created: { gte: startTs, lte: endTs },
      type: "charge",
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const txn of response.data) {
      fees += txn.fee / 100;
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return fees;
}

// Fetch Stripe refunds using Refunds API
async function fetchStripeRefunds(startDate: string, endDate: string): Promise<number> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  let refunds = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().refunds.list({
      created: { gte: startTs, lte: endTs },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const refund of response.data) {
      refunds += refund.amount / 100;
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return refunds;
}

// Fetch Stripe payouts (bank deposits)
async function fetchStripePayouts(startDate: string, endDate: string): Promise<number> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000);

  let payouts = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await getStripe().payouts.list({
      arrival_date: { gte: startTs, lte: endTs },
      status: "paid",
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const payout of response.data) {
      payouts += payout.amount / 100;
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1]!.id;
    }
  }

  return payouts;
}

// Parse expense account name to category
function categorizeExpense(accountName: string): keyof Omit<ExpenseBreakdown, 'total'> {
  const name = accountName.toLowerCase();

  if (name.includes("advertising") || name.includes("marketing")) {
    return "advertisingMarketing";
  }
  if (name.includes("contract") || name.includes("labor")) {
    return "contractLabor";
  }
  if (name.includes("app") || name.includes("software")) {
    return "appsSoftware";
  }
  if (name.includes("material") || name.includes("supplies")) {
    return "materialsSupplies";
  }
  if (name.includes("liability") || name.includes("insurance")) {
    return "liabilityInsurance";
  }
  if (name.includes("utilit")) {
    return "utilities";
  }
  if (name.includes("repair") || name.includes("maintenance")) {
    return "repairsMaintenance";
  }
  if (name.includes("license")) {
    return "businessLicenses";
  }
  if (name.includes("client") && name.includes("compensation")) {
    return "clientCompensation";
  }
  return "other";
}

// Create empty expense breakdown
function emptyExpenseBreakdown(): ExpenseBreakdown {
  return {
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
}

// Fetch QuickBooks P&L data (income + expenses) for a month
async function fetchQuickBooksPnL(
  startDate: string,
  endDate: string
): Promise<{
  income: number;
  stripeIncome: number;
  otherIncome: number;
  expenses: ExpenseBreakdown;
  netIncome: number;
  connected: boolean;
}> {
  try {
    // Try to fetch directly - fetchProfitAndLoss handles token validation internally
    const report = await fetchProfitAndLoss(startDate, endDate);
    if (!report) {
      return {
        income: 0,
        stripeIncome: 0,
        otherIncome: 0,
        expenses: emptyExpenseBreakdown(),
        netIncome: 0,
        connected: false,
      };
    }

    // Separate Stripe income from other income
    let stripeIncome = 0;
    let otherIncome = 0;

    for (const row of report.income) {
      if (row.account.toLowerCase().includes("stripe")) {
        stripeIncome += row.amount;
      } else {
        otherIncome += row.amount;
      }
    }

    // Categorize expenses
    const expenses = emptyExpenseBreakdown();
    for (const row of report.expenses) {
      const category = categorizeExpense(row.account);
      expenses[category] += row.amount;
      expenses.total += row.amount;
    }

    return {
      income: report.totalIncome,
      stripeIncome,
      otherIncome,
      expenses,
      netIncome: report.netIncome,
      connected: true,
    };
  } catch (err) {
    console.error("Failed to fetch QuickBooks P&L:", err);
    return {
      income: 0,
      stripeIncome: 0,
      otherIncome: 0,
      expenses: emptyExpenseBreakdown(),
      netIncome: 0,
      connected: false,
    };
  }
}

// Fetch all data for a single month
async function fetchMonthData(
  year: number,
  month: number
): Promise<MonthlyReconciliation> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "short",
  });

  // Fetch all data in parallel
  const [gmData, stripeCharges, stripeFees, stripeRefunds, payouts, qbData] =
    await Promise.all([
      fetchGymMasterPayments(startDate, endDate),
      fetchStripeCharges(startDate, endDate),
      fetchStripeFees(startDate, endDate),
      fetchStripeRefunds(startDate, endDate),
      fetchStripePayouts(startDate, endDate),
      fetchQuickBooksPnL(startDate, endDate),
    ]);

  const gmNet = gmData.gross - gmData.refunds;
  const stripeNet = stripeCharges.gross - stripeFees - stripeRefunds;
  const feePercent =
    stripeCharges.gross > 0 ? (stripeFees / stripeCharges.gross) * 100 : 0;

  // Compare GymMaster gross to Stripe gross (same date basis)
  const variance = gmData.gross - stripeCharges.gross;
  const variancePercent =
    gmData.gross > 0 ? (variance / gmData.gross) * 100 : 0;
  const isReconciled = Math.abs(variance) < 5; // Within $5

  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    monthName: `${monthName} ${year}`,
    gymMaster: {
      gross: gmData.gross,
      refunds: gmData.refunds,
      net: gmNet,
    },
    stripe: {
      gross: stripeCharges.gross,
      fees: stripeFees,
      feePercent,
      refunds: stripeRefunds,
      net: stripeNet,
    },
    quickbooks: {
      income: qbData.income,
      stripeIncome: qbData.stripeIncome,
      otherIncome: qbData.otherIncome,
      expenses: qbData.expenses,
      netIncome: qbData.netIncome,
      connected: qbData.connected,
    },
    payouts,
    variance,
    variancePercent,
    isReconciled,
  };
}

export async function GET(request: NextRequest) {
  const authError = await validateApiAccess(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(
    searchParams.get("year") || String(new Date().getFullYear())
  );

  // Determine which months to fetch
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;
  const startMonth = parseInt(searchParams.get("startMonth") || "1");
  const endMonth = parseInt(
    searchParams.get("endMonth") || String(currentMonth)
  );

  try {
    // Fetch all months in parallel
    const monthPromises: Promise<MonthlyReconciliation>[] = [];
    for (let m = startMonth; m <= endMonth; m++) {
      monthPromises.push(fetchMonthData(year, m));
    }

    const months = await Promise.all(monthPromises);

    // Check if any month has QB connected
    const quickbooksConnected = months.some((m) => m.quickbooks.connected);

    // Calculate totals
    const totals = months.reduce(
      (acc, m) => ({
        gymMasterGross: acc.gymMasterGross + m.gymMaster.gross,
        gymMasterRefunds: acc.gymMasterRefunds + m.gymMaster.refunds,
        gymMasterNet: acc.gymMasterNet + m.gymMaster.net,
        stripeGross: acc.stripeGross + m.stripe.gross,
        stripeFees: acc.stripeFees + m.stripe.fees,
        stripeRefunds: acc.stripeRefunds + m.stripe.refunds,
        stripeNet: acc.stripeNet + m.stripe.net,
        quickbooksIncome: acc.quickbooksIncome + m.quickbooks.income,
        quickbooksStripeIncome: acc.quickbooksStripeIncome + m.quickbooks.stripeIncome,
        quickbooksOtherIncome: acc.quickbooksOtherIncome + m.quickbooks.otherIncome,
        quickbooksExpenses: {
          advertisingMarketing: acc.quickbooksExpenses.advertisingMarketing + m.quickbooks.expenses.advertisingMarketing,
          contractLabor: acc.quickbooksExpenses.contractLabor + m.quickbooks.expenses.contractLabor,
          appsSoftware: acc.quickbooksExpenses.appsSoftware + m.quickbooks.expenses.appsSoftware,
          materialsSupplies: acc.quickbooksExpenses.materialsSupplies + m.quickbooks.expenses.materialsSupplies,
          liabilityInsurance: acc.quickbooksExpenses.liabilityInsurance + m.quickbooks.expenses.liabilityInsurance,
          utilities: acc.quickbooksExpenses.utilities + m.quickbooks.expenses.utilities,
          repairsMaintenance: acc.quickbooksExpenses.repairsMaintenance + m.quickbooks.expenses.repairsMaintenance,
          businessLicenses: acc.quickbooksExpenses.businessLicenses + m.quickbooks.expenses.businessLicenses,
          clientCompensation: acc.quickbooksExpenses.clientCompensation + m.quickbooks.expenses.clientCompensation,
          other: acc.quickbooksExpenses.other + m.quickbooks.expenses.other,
          total: acc.quickbooksExpenses.total + m.quickbooks.expenses.total,
        },
        quickbooksNetIncome: acc.quickbooksNetIncome + m.quickbooks.netIncome,
        payouts: acc.payouts + m.payouts,
      }),
      {
        gymMasterGross: 0,
        gymMasterRefunds: 0,
        gymMasterNet: 0,
        stripeGross: 0,
        stripeFees: 0,
        stripeRefunds: 0,
        stripeNet: 0,
        quickbooksIncome: 0,
        quickbooksStripeIncome: 0,
        quickbooksOtherIncome: 0,
        quickbooksExpenses: emptyExpenseBreakdown(),
        quickbooksNetIncome: 0,
        payouts: 0,
      }
    );

    const variance = totals.gymMasterGross - totals.stripeGross;
    const variancePercent =
      totals.gymMasterGross > 0
        ? (variance / totals.gymMasterGross) * 100
        : 0;
    const stripeFeePercent =
      totals.stripeGross > 0
        ? (totals.stripeFees / totals.stripeGross) * 100
        : 0;

    const result: RevenueReconciliationResponse = {
      year,
      months,
      quickbooksConnected,
      totals: {
        ...totals,
        stripeFeePercent,
        variance,
        variancePercent,
        isReconciled: Math.abs(variancePercent) < 1, // Within 1%
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Revenue reconciliation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch reconciliation data",
      },
      { status: 500 }
    );
  }
}
