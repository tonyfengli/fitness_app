import { redirect } from "next/navigation";
import { getSession } from "~/auth/server";

export default async function ClientDashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "client") {
    redirect("/trainer-dashboard");
  }

  return (
    <main className="container h-screen py-16">
      <div className="flex flex-col items-center justify-center gap-8">
        <h1 className="text-4xl font-bold">Welcome, {session.user.name}!</h1>
        
        <div className="rounded-lg border p-8 max-w-2xl w-full text-center">
          <h2 className="text-2xl font-semibold mb-4">Your Fitness Journey</h2>
          <p className="text-muted-foreground mb-6">
            This is your personal dashboard where you'll be able to:
          </p>
          
          <ul className="text-left space-y-3 mb-8">
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>View your assigned workouts</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Track your progress</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>Log your workout sessions</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span>View your exercise history</span>
            </li>
          </ul>
          
          <p className="text-sm text-muted-foreground italic">
            Features coming soon! Your trainer will set up your workouts.
          </p>
        </div>
      </div>
    </main>
  );
}