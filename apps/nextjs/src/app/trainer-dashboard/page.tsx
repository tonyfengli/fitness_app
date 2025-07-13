import { redirect } from "next/navigation";
import { getSession } from "~/auth/server";
import TrainerDashboardContent from "./trainer-dashboard-content";

export default async function TrainerDashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "client") {
    redirect("/client-dashboard");
  }

  return <TrainerDashboardContent />;
}