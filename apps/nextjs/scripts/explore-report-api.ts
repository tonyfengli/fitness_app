/**
 * GymMaster Report API V2 - Full Exploration
 * Now that we know auth works, let's see what data we can get
 */

import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL || 'https://g1fitness.gymmasteronline.com';
const API_KEY = process.env.GYMMASTER_REPORT_API_KEY;

async function fetchGet(endpoint: string) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`GET ${endpoint}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-GM-API-KEY': API_KEY!,
    },
  });

  const data = await response.json();
  console.log(`Status: ${response.status}`);
  const preview = JSON.stringify(data, null, 2);
  console.log(preview.length > 2000 ? preview.slice(0, 2000) + '\n... (truncated)' : preview);
  return data;
}

async function fetchPost(endpoint: string, body: object) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`POST ${endpoint}`);
  console.log(`Body: ${JSON.stringify(body, null, 2)}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-GM-API-KEY': API_KEY!,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log(`Status: ${response.status}`);
  const preview = JSON.stringify(data, null, 2);
  console.log(preview.length > 3000 ? preview.slice(0, 3000) + '\n... (truncated)' : preview);
  return data;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GymMaster Report API V2 - Full Exploration');
  console.log('='.repeat(60));

  // 1. Get KPI Categories
  console.log('\n\n📊 KPI CATEGORIES');
  const categories = await fetchGet('/api/v2/report/kpi/categories/list');

  // 2. Get all KPI fields
  console.log('\n\n📈 ALL KPI FIELDS');
  const fields = await fetchGet('/api/v2/report/kpi/fields/list');

  // 3. Get Standard Reports list
  console.log('\n\n📋 STANDARD REPORTS LIST');
  const reports = await fetchGet('/api/v2/report/standard_report/list');

  // Print report names for reference
  if (reports?.result) {
    console.log('\n\nAvailable Standard Reports:');
    for (const r of reports.result) {
      console.log(`  ${r.id}: ${r.name} (${r.category})`);
    }
  }

  // 4. Fetch KPI data for August 2026
  console.log('\n\n📊 FETCHING KPI DATA (August 2026)');

  // Try fetching by category
  for (const category of categories?.result || []) {
    await fetchPost('/api/v2/report/kpi/categories', {
      date: { start: '2026-08-01', end: '2026-08-31' },
      category: category,
    });
  }

  // 5. Try fetching specific KPI fields if available
  if (fields?.result && Array.isArray(fields.result)) {
    console.log('\n\n📈 FETCHING SPECIFIC KPI FIELDS');
    // Get first 10 field names
    const fieldNames = fields.result.slice(0, 10).map((f: any) => typeof f === 'string' ? f : f.name);
    console.log('Trying fields:', fieldNames);

    await fetchPost('/api/v2/report/kpi/fields', {
      date: { start: '2026-08-01', end: '2026-08-31' },
      selected_fields: fieldNames,
    });
  }

  // 6. Try running key standard reports
  console.log('\n\n📋 RUNNING STANDARD REPORTS');

  // Find reports we need
  const reportIds = {
    currentMembers: reports?.result?.find((r: any) => r.name === 'Current Members')?.id,
    allPayments: reports?.result?.find((r: any) => r.name?.includes('All Payments'))?.id,
    newMembers: reports?.result?.find((r: any) => r.name === 'New Members')?.id,
    startingMemberships: reports?.result?.find((r: any) => r.name?.includes('Starting'))?.id,
    cancellations: reports?.result?.find((r: any) => r.name?.includes('Cancel'))?.id,
    membersOnHold: reports?.result?.find((r: any) => r.name?.includes('Hold') || r.name?.includes('Freeze'))?.id,
  };

  console.log('\nFound report IDs:', reportIds);

  // Run Current Members report
  if (reportIds.currentMembers) {
    console.log('\n\n👥 CURRENT MEMBERS REPORT');
    await fetchPost('/api/v2/report/standard_report', {
      report_id: reportIds.currentMembers,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    });
  }

  // Run Starting Memberships report
  if (reportIds.startingMemberships) {
    console.log('\n\n🆕 STARTING MEMBERSHIPS REPORT');
    await fetchPost('/api/v2/report/standard_report', {
      report_id: reportIds.startingMemberships,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    });
  }

  // Try to find payments report
  const paymentsReport = reports?.result?.find((r: any) =>
    r.name?.toLowerCase().includes('payment') ||
    r.name?.toLowerCase().includes('transaction') ||
    r.name?.toLowerCase().includes('revenue')
  );
  if (paymentsReport) {
    console.log(`\n\n💰 ${paymentsReport.name.toUpperCase()} REPORT`);
    await fetchPost('/api/v2/report/standard_report', {
      report_id: paymentsReport.id,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    });
  }

  // 7. Try dashboard endpoints
  console.log('\n\n📊 DASHBOARD ENDPOINTS');
  await fetchGet('/api/v2/dashboard/list');

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
