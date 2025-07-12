import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/auth/server";
import ExerciseList from "./exercise-list";

export default async function TrainerDashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "client") {
    redirect("/client-dashboard");
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Trainer Dashboard - Exercise Library</h1>
      
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
          </div>
        }
      >
        <ExerciseList />
      </Suspense>
    </div>
  );
}