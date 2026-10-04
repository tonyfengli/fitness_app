/**
 * GymMaster Report API Test Script
 * Testing various report endpoints to find payment/membership data
 */

import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL || 'https://g1fitness.gymmasteronline.com';
const REPORT_API_KEY = process.env.GYMMASTER_REPORT_API_KEY;
const STAFF_API_KEY = process.env.GYMMASTER_STAFF_API_KEY;

async function testEndpoint(name: string, url: string, authHeader?: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);

  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, { headers });
    console.log(`Status: ${response.status}`);

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const preview = JSON.stringify(json, null, 2);
      console.log('Response:', preview.length > 800 ? preview.slice(0, 800) + '\n... (truncated)' : preview);
    } catch {
      console.log('Response:', text.slice(0, 500));
    }
    return response.status;
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : error);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('GymMaster Report API - Endpoint Discovery');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Report API Key: ${REPORT_API_KEY?.slice(0, 8)}...`);

  // Try different Report API path patterns
  const reportPaths = [
    '/api/reports',
    '/api/v1/reports',
    '/api/v2/reports',
    '/reports/api',
    '/report/api',
    '/reporting/api',
    '/staff/api/reports',
    '/staff/api/v1/reports',
    '/admin/api/reports',
  ];

  console.log('\n\n📊 TRYING REPORT API PATHS');
  for (const path of reportPaths) {
    await testEndpoint(
      `Report API at ${path}`,
      `${BASE_URL}${path}?api_key=${REPORT_API_KEY}`
    );
  }

  // Try Staff API paths
  const staffPaths = [
    '/api/staff',
    '/api/v1/staff',
    '/staff/api',
    '/staff/api/v1',
    '/staff/api/v1/members',
    '/staff/api/v1/payments',
    '/admin/api/staff',
  ];

  console.log('\n\n👔 TRYING STAFF API PATHS');
  for (const path of staffPaths) {
    await testEndpoint(
      `Staff API at ${path}`,
      `${BASE_URL}${path}?api_key=${STAFF_API_KEY}`
    );
  }

  // Try known GymMaster API patterns from their docs
  const knownPatterns = [
    // Portal API - payment endpoints?
    '/portal/api/v1/payments',
    '/portal/api/v1/transactions',
    '/portal/api/v1/billing',
    '/portal/api/v1/reports',
    '/portal/api/v1/member/payments', // All members payments?

    // External API patterns
    '/external/api/v1/members',
    '/external/api/v1/payments',
    '/integration/api/v1/members',
    '/integration/api/v1/payments',

    // Webhook/data export patterns
    '/api/export/members',
    '/api/export/payments',
    '/data/api/v1/members',
  ];

  console.log('\n\n🔍 TRYING OTHER KNOWN PATTERNS');
  for (const path of knownPatterns) {
    await testEndpoint(
      `Pattern: ${path}`,
      `${BASE_URL}${path}?api_key=${REPORT_API_KEY}`
    );
  }

  // Try Basic auth with API key (common pattern)
  console.log('\n\n🔐 TRYING BASIC AUTH PATTERNS');
  const basicAuth = Buffer.from(`:${REPORT_API_KEY}`).toString('base64');
  const apiKeyAuth = Buffer.from(`${REPORT_API_KEY}:`).toString('base64');

  await testEndpoint(
    'Portal members with Basic Auth (empty:key)',
    `${BASE_URL}/portal/api/v1/members`,
    `Basic ${basicAuth}`
  );

  await testEndpoint(
    'Portal members with Basic Auth (key:empty)',
    `${BASE_URL}/portal/api/v1/members`,
    `Basic ${apiKeyAuth}`
  );

  // Try the member-specific endpoint with staff key
  await testEndpoint(
    'Member profile with staff key',
    `${BASE_URL}/portal/api/v1/member/profile?api_key=${STAFF_API_KEY}&member_id=322712`
  );

  // Check if there's a way to get ALL payments via portal API
  await testEndpoint(
    'All member payments (portal)',
    `${BASE_URL}/portal/api/v1/member/accounthistory?api_key=${REPORT_API_KEY}`
  );

  // Try without member_id
  await testEndpoint(
    'Account history without member_id',
    `${BASE_URL}/portal/api/v1/accounthistory?api_key=${REPORT_API_KEY}`
  );

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
