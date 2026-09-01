// SCREENS THE OPERATOR SHOWS TO A PROSPECT.
//
// Operator-only pages — they read and write his data, so the session check below
// is the same one the dashboard applies — but they are filled in LIVE on a Zoom
// with the prospect watching a shared browser tab. So they get no chrome.
//
// The (dashboard) layout renders the sidebar (workspace name, every section, the
// REVENUE figure) and MotivationPopup, which surfaces private notes-to-self. On a
// shared tab all of that is in front of the client. Opening in a new tab was not
// enough: the new tab inherited the same layout.
//
// This group deliberately carries NO `lg-app` class either. That is the fence the
// dark dashboard palette is applied behind — see the note in src/app/layout.tsx —
// so a page here renders in the cream/serif brand the client documents use, which
// is what the calculator was already styled for. It declares its own palette
// locally for exactly this reason.
//
// The URL is unchanged: a route group sets no path segment, so this is still
// /library/[id]/calculator and every existing link keeps working.
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function PresentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  return <>{children}</>;
}
