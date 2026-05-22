import { redirect } from 'next/navigation';

// /attendance has been merged into /clients as the "Sessions" tab.
// Preserve any incoming ?week=YYYY-MM-DD so bookmarks still resolve correctly.
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'attendance');
  if (sp.week) params.set('week', sp.week);
  redirect(`/clients?${params.toString()}`);
}
