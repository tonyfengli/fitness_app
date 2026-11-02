import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { founderHome } from "~/lib/founders";

export default async function HomePage() {
  const session = await getSession();

  // Founders have their own landing page
  const home = founderHome(session?.user?.email);
  if (home) redirect(home);

  // Redirect authenticated users to their appropriate dashboard
  if (session?.user) {
    if (session.user.role === "trainer") {
      redirect("/trainer-home");
    } else if (session.user.role === "client") {
      redirect("/client-dashboard");
    }
  }

  // Redirect non-authenticated users to login
  redirect("/login");
}
