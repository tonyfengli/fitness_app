import { redirect } from "next/navigation";

// Save Calls now lives in the KPI dashboard's Retention tab
export default function SaveCallsPage() {
  redirect("/kpi?tab=retention");
}
