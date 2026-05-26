import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The app has no public marketing page. Opening the site sends logged-in users
// straight to their dashboard and everyone else to the login screen. Because the
// session is a persistent JWT cookie, returning visitors land on the dashboard
// without signing in again.
export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}
