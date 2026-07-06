import { redirect } from "next/navigation";

// The proposal builder is the single proposal surface. Any direct link to the
// old detail view redirects into the builder in edit mode.
export default function ProposalDetailRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/proposals/new?id=${params.id}`);
}
