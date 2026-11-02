import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { isFounder } from "~/lib/founders";

// The KPI dashboard is founders-only; everyone else goes back to their usual home
export default async function KpiLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isFounder(session.user.email)) redirect("/");
  return <>{children}</>;
}
