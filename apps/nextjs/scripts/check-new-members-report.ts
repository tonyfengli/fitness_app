import 'dotenv/config';

const BASE_URL = process.env.GYMMASTER_BASE_URL!;
const API_KEY = process.env.GYMMASTER_REPORT_API_KEY!;

async function main() {
  // Fetch New Members report (ID 116)
  const response = await fetch(`${BASE_URL}/api/v2/report/standard_report`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-GM-API-KEY': API_KEY
    },
    body: JSON.stringify({
      report_id: 116,
      start_date: '2026-09-01',
      end_date: '2026-09-30'
    }),
  });

  const data = await response.json();
  const rows = data.result || [];

  console.log('=== New Members Report (ID 116) ===');
  console.log('Rows:', rows.length);

  if (rows.length > 0) {
    const columns = Object.keys(rows[0]).filter(k => !k.startsWith('sorted_'));
    console.log('Columns:', columns.join(', '));

    console.log('\nAll rows:');
    rows.forEach((r: any) => {
      console.log(
        ' ',
        (r['Member Name'] || '').padEnd(25),
        '| Joining:', (r['Member Joining Date'] || 'N/A').padEnd(12),
        '| Start:', r['Membership Start Date'] || 'N/A'
      );
    });
  }
}

main().catch(console.error);
