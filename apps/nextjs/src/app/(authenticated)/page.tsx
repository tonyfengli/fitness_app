import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";

export default async function HomePage() {
  const session = await getSession();

  // Redirect authenticated users to their appropriate dashboard
  if (session?.user) {
    if (session.user.role === "trainer") {
      redirect("/trainer-dashboard");
    } else if (session.user.role === "client") {
      redirect("/client-dashboard");
    }
  }

  // Redirect non-authenticated users to login
  redirect("/login");
}
