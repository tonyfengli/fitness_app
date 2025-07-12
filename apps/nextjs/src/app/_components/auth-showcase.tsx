import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@acme/ui/button";

import { auth, getSession } from "~/auth/server";

export async function AuthShowcase() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="lg" variant="outline">
              Sign up
            </Button>
          </Link>
        </div>
        <form>
          <Button
            size="lg"
            variant="secondary"
            formAction={async () => {
              "use server";
              const res = await auth.api.signInSocial({
                body: {
                  provider: "discord",
                  callbackURL: "/",
                },
              });
              if (!res.url) {
                throw new Error("No URL returned from signInSocial");
              }
              redirect(res.url);
            }}
          >
            Sign in with Discord
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user.name}</span>
      </p>

      <form>
        <Button
          size="lg"
          formAction={async () => {
            "use server";
            await auth.api.signOut({
              headers: await headers(),
            });
            redirect("/");
          }}
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}
