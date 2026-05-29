import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/dashboard/TopBar";
import { PlaybookBody } from "./PlaybookBody";

export const dynamic = "force-dynamic";

export default async function PlaybookPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <TopBar title="Sales Playbook" subtitle="Sell the pack" />
      <PlaybookBody />
    </>
  );
}
