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

        <div className="w-full max-w-2xl rounded-lg border p-8 text-center">
          <h2 className="mb-4 text-2xl font-semibold">Your Fitness Journey</h2>
          <p className="mb-6 text-muted-foreground">
            This is your personal dashboard where you'll be able to:
          </p>

          <ul className="mb-8 space-y-3 text-left">
            <li className="flex items-start">
              <span className="mr-2 text-primary">•</span>
              <span>View your assigned workouts</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary">•</span>
              <span>Track your progress</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary">•</span>
              <span>Log your workout sessions</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary">•</span>
              <span>View your exercise history</span>
            </li>
          </ul>

          <p className="text-sm italic text-muted-foreground">
            Features coming soon! Your trainer will set up your workouts.
          </p>
        </div>
      </div>
    </main>
  );
}
