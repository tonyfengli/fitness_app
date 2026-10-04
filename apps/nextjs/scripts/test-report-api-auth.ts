/**
 * GymMaster Report API V2 - Authentication Testing
 * Testing various auth methods to debug 400 Bad Request
 */

import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL || 'https://g1fitness.gymmasteronline.com';
const REPORT_API_KEY = process.env.GYMMASTER_REPORT_API_KEY;
const MEMBER_API_KEY = process.env.GYMMASTER_MEMBER_API_KEY;
const GATEKEEPER_API_KEY = process.env.GYMMASTER_GATEKEEPER_API_KEY;

interface TestResult {
  method: string;
  status: number;
  response: string;
}

async function testAuth(description: string, url: string, options: RequestInit): Promise<TestResult> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${description}`);
  console.log(`URL: ${url}`);
  console.log(`Headers:`, JSON.stringify(options.headers, null, 2));

  try {
    const response = await fetch(url, options);
    const text = await response.text();

    console.log(`Status: ${response.status}`);
    console.log(`Response: ${text.slice(0, 500)}`);

    return { method: description, status: response.status, response: text.slice(0, 200) };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`Error: ${errMsg}`);
    return { method: description, status: 0, response: errMsg };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('GymMaster Report API V2 - Auth Debugging');
  console.log('='.repeat(60));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Report API Key: ${REPORT_API_KEY?.slice(0, 8)}...${REPORT_API_KEY?.slice(-4)}`);
  console.log(`Member API Key: ${MEMBER_API_KEY?.slice(0, 8)}...${MEMBER_API_KEY?.slice(-4)}`);
  console.log(`Gatekeeper Key: ${GATEKEEPER_API_KEY?.slice(0, 8)}...${GATEKEEPER_API_KEY?.slice(-4)}`);

  const endpoint = '/api/v2/report/kpi/categories/list';
  const fullUrl = `${BASE_URL}${endpoint}`;

  const results: TestResult[] = [];

  // Test 1: X-GM-API-KEY header (documented method)
  results.push(await testAuth(
    '1. X-GM-API-KEY header (Report key)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Test 2: X-GM-API-KEY with Member Portal key
  results.push(await testAuth(
    '2. X-GM-API-KEY header (Member key)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': MEMBER_API_KEY!,
      },
    }
  ));

  // Test 3: Query parameter api_key
  results.push(await testAuth(
    '3. Query param ?api_key=',
    `${fullUrl}?api_key=${REPORT_API_KEY}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }
  ));

  // Test 4: Authorization Bearer token
  results.push(await testAuth(
    '4. Authorization: Bearer token',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${REPORT_API_KEY}`,
      },
    }
  ));

  // Test 5: Basic auth with empty username
  const basicAuth1 = Buffer.from(`:${REPORT_API_KEY}`).toString('base64');
  results.push(await testAuth(
    '5. Basic Auth (:apikey)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth1}`,
      },
    }
  ));

  // Test 6: Basic auth with apikey as username
  const basicAuth2 = Buffer.from(`${REPORT_API_KEY}:`).toString('base64');
  results.push(await testAuth(
    '6. Basic Auth (apikey:)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth2}`,
      },
    }
  ));

  // Test 7: Basic auth with site name (g1fitness)
  const basicAuth3 = Buffer.from(`g1fitness:${REPORT_API_KEY}`).toString('base64');
  results.push(await testAuth(
    '7. Basic Auth (g1fitness:apikey)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuth3}`,
      },
    }
  ));

  // Test 8: Try with Gatekeeper key in X-GM-API-KEY
  results.push(await testAuth(
    '8. X-GM-API-KEY (Gatekeeper key)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': GATEKEEPER_API_KEY!,
      },
    }
  ));

  // Test 9: Try lowercase header
  results.push(await testAuth(
    '9. x-gm-api-key (lowercase)',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-gm-api-key': REPORT_API_KEY!,
      },
    }
  ));

  // Test 10: Try with Content-Type
  results.push(await testAuth(
    '10. X-GM-API-KEY + Content-Type',
    fullUrl,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Test 11: POST instead of GET (some APIs require POST even for list)
  results.push(await testAuth(
    '11. POST method with X-GM-API-KEY',
    fullUrl,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
      body: JSON.stringify({}),
    }
  ));

  // Test 12: Try the standard_report/list endpoint
  results.push(await testAuth(
    '12. standard_report/list endpoint',
    `${BASE_URL}/api/v2/report/standard_report/list`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Test 13: Try without /api prefix (maybe it's /v2/report/...)
  results.push(await testAuth(
    '13. Without /api prefix',
    `${BASE_URL}/v2/report/kpi/categories/list`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Test 14: Try /reporting/api/v2 path
  results.push(await testAuth(
    '14. /reporting/api/v2 path',
    `${BASE_URL}/reporting/api/v2/kpi/categories/list`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Test 15: Check if Report API has a different base path
  results.push(await testAuth(
    '15. /report/api/v2 path',
    `${BASE_URL}/report/api/v2/kpi/categories/list`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-GM-API-KEY': REPORT_API_KEY!,
      },
    }
  ));

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const r of results) {
    const statusEmoji = r.status === 200 ? '✅' : r.status === 400 ? '⚠️' : r.status === 401 ? '🔒' : r.status === 404 ? '❌' : '❓';
    console.log(`${statusEmoji} ${r.status} - ${r.method}`);
  }

  // Check if 400 means "missing required parameter" vs "bad auth"
  console.log('\n\nAnalysis:');
  const got400 = results.filter(r => r.status === 400);
  const got401 = results.filter(r => r.status === 401);
  const got404 = results.filter(r => r.status === 404);

  if (got400.length > 0) {
    console.log(`- ${got400.length} requests returned 400 Bad Request`);
    console.log('  This typically means: auth worked but request format is wrong, OR the API module is not enabled');
  }
  if (got401.length > 0) {
    console.log(`- ${got401.length} requests returned 401 Unauthorized`);
    console.log('  This means: authentication failed');
  }
  if (got404.length > 0) {
    console.log(`- ${got404.length} requests returned 404 Not Found`);
    console.log('  This means: endpoint does not exist at this path');
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
