/**
 * GymMaster Report API V2 Test Script
 * Using X-GM-API-KEY header authentication
 */

import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL || 'https://g1fitness.gymmasteronline.com';
const REPORT_API_KEY = process.env.GYMMASTER_REPORT_API_KEY;

async function fetchReportApi(method: string, endpoint: string, body?: object) {
  const url = `${BASE_URL}${endpoint}`;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${method} ${endpoint}`);

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
      console.log('Body:', JSON.stringify(body, null, 2));
    }

    const response = await fetch(url, options);
    console.log(`Status: ${response.status}`);

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const preview = JSON.stringify(json, null, 2);
      console.log('Response:', preview.length > 1500 ? preview.slice(0, 1500) + '\n... (truncated)' : preview);
      return json;
    } catch {
      console.log('Response:', text.slice(0, 800));
    }
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : error);
  }
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GymMaster Report API V2 - Testing');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${REPORT_API_KEY?.slice(0, 8)}...`);

  // Test KPI endpoints
  console.log('\n\n📊 KPI ENDPOINTS');

  // List KPI categories
  const categories = await fetchReportApi('GET', '/api/v2/report/kpi/categories/list');

  // List KPI fields
  const fields = await fetchReportApi('GET', '/api/v2/report/kpi/fields/list');

  // If fields are available, try to fetch some KPI data
  if (fields?.result) {
    console.log('\n📈 Fetching KPI data for August 2026...');
    await fetchReportApi('POST', '/api/v2/report/kpi/fields', {
      date: {
        start: '2026-08-01',
        end: '2026-08-31',
      },
      selected_fields: fields.result.slice(0, 5).map((f: any) => f.name || f), // First 5 fields
    });
  }

  // Test Standard Report endpoints
  console.log('\n\n📋 STANDARD REPORT ENDPOINTS');

  // List available reports
  const reports = await fetchReportApi('GET', '/api/v2/report/standard_report/list');

  // If reports are available, find payment/member reports
  if (reports?.result) {
    console.log('\nAvailable reports:');
    for (const report of reports.result) {
      console.log(`  - ${report.id}: ${report.name}`);
    }

    // Try to find All Payments or similar report
    const paymentReport = reports.result.find((r: any) =>
      r.name?.toLowerCase().includes('payment') ||
      r.name?.toLowerCase().includes('transaction')
    );

    const memberReport = reports.result.find((r: any) =>
      r.name?.toLowerCase().includes('member') &&
      !r.name?.toLowerCase().includes('membership')
    );

    const cancellationReport = reports.result.find((r: any) =>
      r.name?.toLowerCase().includes('cancel')
    );

    if (paymentReport) {
      console.log(`\n💰 Running payment report (ID: ${paymentReport.id})...`);
      await fetchReportApi('POST', '/api/v2/report/standard_report', {
        report_id: paymentReport.id,
        start_date: '2026-08-01',
        end_date: '2026-08-31',
      });
    }

    if (memberReport) {
      console.log(`\n👥 Running member report (ID: ${memberReport.id})...`);
      await fetchReportApi('POST', '/api/v2/report/standard_report', {
        report_id: memberReport.id,
        start_date: '2026-08-01',
        end_date: '2026-08-31',
      });
    }

    if (cancellationReport) {
      console.log(`\n❌ Running cancellation report (ID: ${cancellationReport.id})...`);
      await fetchReportApi('POST', '/api/v2/report/standard_report', {
        report_id: cancellationReport.id,
        start_date: '2026-08-01',
        end_date: '2026-08-31',
      });
    }
  }

  // Test Dashboard endpoints
  console.log('\n\n📊 DASHBOARD ENDPOINTS');
  await fetchReportApi('GET', '/api/v2/dashboard/list');

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
