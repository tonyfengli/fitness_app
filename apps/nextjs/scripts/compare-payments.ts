import 'dotenv/config';
import * as fs from 'fs';

const BASE_URL = process.env.GYMMASTER_BASE_URL!;
const API_KEY = process.env.GYMMASTER_REPORT_API_KEY!;

interface Payment {
  date: string;
  name: string;
  details: string;
  amount: number;
  memberId: string;
}

async function main() {
  // Read CSV
  const csvContent = fs.readFileSync(
    '/Users/tonyli/Desktop/September/report_All_Payments_2026-09-01_2026-09-30_d4de567601.csv',
    'utf8'
  );
  const csvLines = csvContent.trim().split('\n').slice(1);

  const csvPayments: Payment[] = csvLines.map(line => {
    const parts = line.match(/(?:"([^"]*)"|([^,]+))/g) || [];
    const clean = parts.map(p => p.replace(/^"|"$/g, ''));
    return {
      date: clean[0] || '',
      name: clean[1] || '',
      details: clean[3] || '',
      amount: parseFloat(clean[5]) || 0,
      memberId: clean[7] || ''
    };
  });

  const csvTotal = csvPayments.reduce((s, p) => s + p.amount, 0);
  console.log('CSV Total:', csvTotal.toFixed(2), '| Rows:', csvPayments.length);

  // Fetch API
  const response = await fetch(`${BASE_URL}/api/v2/report/standard_report`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-GM-API-KEY': API_KEY
    },
    body: JSON.stringify({
      report_id: 103,
      start_date: '2026-09-01',
      end_date: '2026-09-30'
    }),
  });

  const data = await response.json();
  const apiPayments: Payment[] = (data.result || []).map((r: any) => ({
    date: r['Payment Date'] || '',
    name: r['Name'] || '',
    details: r['Payment Details'] || '',
    amount: parseFloat(String(r['Payment Amount']).replace(/[$,]/g, '')) || 0,
    memberId: String(r['Member ID'] || '')
  }));

  const apiTotal = apiPayments.reduce((s, p) => s + p.amount, 0);
  console.log('API Total:', apiTotal.toFixed(2), '| Rows:', apiPayments.length);
  console.log('Difference:', (csvTotal - apiTotal).toFixed(2));

  // Build maps by memberId+date+amount for comparison
  const csvMap = new Map<string, Payment>();
  csvPayments.forEach(p => {
    const key = `${p.memberId}|${p.date}|${p.amount}`;
    csvMap.set(key, p);
  });

  const apiMap = new Map<string, Payment>();
  apiPayments.forEach(p => {
    // Normalize API date format (Sep 5 2026 -> 2026-09-05)
    const normalizedDate = normalizeDate(p.date);
    const key = `${p.memberId}|${normalizedDate}|${p.amount}`;
    apiMap.set(key, { ...p, date: normalizedDate });
  });

  // Rebuild CSV map with normalized dates
  const csvMapNormalized = new Map<string, Payment>();
  csvPayments.forEach(p => {
    const key = `${p.memberId}|${p.date}|${p.amount}`;
    csvMapNormalized.set(key, p);
  });

  // Find differences
  console.log('\n--- In CSV but not in API ---');
  let csvOnlyTotal = 0;
  for (const [key, p] of csvMapNormalized) {
    if (!apiMap.has(key)) {
      console.log(' ', p.name.padEnd(30), '|', p.date, '|', p.amount.toFixed(2).padStart(10), '|', p.details.slice(0, 30));
      csvOnlyTotal += p.amount;
    }
  }
  console.log('CSV-only total:', csvOnlyTotal.toFixed(2));

  console.log('\n--- In API but not in CSV ---');
  let apiOnlyTotal = 0;
  for (const [key, p] of apiMap) {
    if (!csvMapNormalized.has(key)) {
      console.log(' ', p.name.padEnd(30), '|', p.date, '|', p.amount.toFixed(2).padStart(10), '|', p.details.slice(0, 30));
      apiOnlyTotal += p.amount;
    }
  }
  console.log('API-only total:', apiOnlyTotal.toFixed(2));
}

function normalizeDate(dateStr: string): string {
  // Convert "Sep 5 2026" to "2026-09-05"
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const match = dateStr.match(/(\w+)\s+(\d+)\s+(\d+)/);
  if (match) {
    const [, month, day, year] = match;
    const mm = months[month] || '01';
    const dd = day.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  return dateStr;
}

main().catch(console.error);
