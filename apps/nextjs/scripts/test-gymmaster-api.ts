/**
 * GymMaster API Test Script - Exploring Member Portal API
 */

import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL || 'https://g1fitness.gymmasteronline.com';
const MEMBER_API_KEY = process.env.GYMMASTER_MEMBER_API_KEY;
const GATEKEEPER_API_KEY = process.env.GYMMASTER_GATEKEEPER_API_KEY;

async function fetchMemberPortal(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/portal/api/v1${endpoint}`);
  url.searchParams.set('api_key', MEMBER_API_KEY!);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`GET ${endpoint}`);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const preview = JSON.stringify(data, null, 2);
      console.log('Response:', preview.length > 1000 ? preview.slice(0, 1000) + '\n... (truncated)' : preview);
      return data;
    } else {
      console.log('Error:', await response.text());
    }
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : error);
  }
  return null;
}

async function fetchGatekeeper(endpoint: string) {
  const url = `${BASE_URL}/gatekeeper_api/v2${endpoint}`;
  const auth = Buffer.from(`:${GATEKEEPER_API_KEY}`).toString('base64');

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`GET (Gatekeeper) ${endpoint}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });

    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const preview = JSON.stringify(data, null, 2);
      console.log('Response:', preview.length > 1000 ? preview.slice(0, 1000) + '\n... (truncated)' : preview);
      return data;
    } else {
      console.log('Error:', await response.text());
    }
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : error);
  }
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GymMaster API - Deep Exploration');
  console.log('='.repeat(60));

  // Member Portal API v1 endpoints
  console.log('\n\n📋 MEMBER PORTAL API v1');

  // List all members
  const members = await fetchMemberPortal('/members');

  // Get first member ID for testing member-specific endpoints
  const firstMemberId = members?.result?.[0]?.id;
  console.log(`\nUsing member ID: ${firstMemberId} for testing`);

  if (firstMemberId) {
    // Member profile
    await fetchMemberPortal('/member/profile', { member_id: String(firstMemberId) });

    // Member memberships
    await fetchMemberPortal('/member/memberships', { member_id: String(firstMemberId) });

    // Member account history (payments)
    await fetchMemberPortal('/member/accounthistory', { member_id: String(firstMemberId) });

    // Member outstanding balance
    await fetchMemberPortal('/member/outstandingbalance', { member_id: String(firstMemberId) });

    // Member visits
    await fetchMemberPortal('/member/visits', { member_id: String(firstMemberId) });
  }

  // Try some other endpoints that might exist
  console.log('\n\n🔍 EXPLORING OTHER ENDPOINTS');

  await fetchMemberPortal('/memberships'); // List available membership types
  await fetchMemberPortal('/member/holds', { member_id: String(firstMemberId) });
  await fetchMemberPortal('/member/suspensions', { member_id: String(firstMemberId) });
  await fetchMemberPortal('/member/cancellations', { member_id: String(firstMemberId) });

  // Try v2 endpoints
  console.log('\n\n📋 MEMBER PORTAL API v2');
  const v2Url = `${BASE_URL}/portal/api/v2/members?api_key=${MEMBER_API_KEY}`;
  try {
    const v2Response = await fetch(v2Url);
    console.log(`GET /portal/api/v2/members - Status: ${v2Response.status}`);
    if (v2Response.ok) {
      const data = await v2Response.json();
      console.log('v2 Response:', JSON.stringify(data, null, 2).slice(0, 500));
    }
  } catch (e) {
    console.log('v2 error:', e);
  }

  // Gatekeeper API - this might have holds/status info
  console.log('\n\n🚪 GATEKEEPER API');

  await fetchGatekeeper('/members');
  await fetchGatekeeper('/membershiptypes');
  await fetchGatekeeper('/configuration');

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
