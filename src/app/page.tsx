import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// No public landing page. Opening the site sends you to sign-in, or straight to
// the dashboard if you already have a session (the NextAuth cookie persists).
export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}
