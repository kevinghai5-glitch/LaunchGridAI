import { redirect } from "next/navigation";

// Internal-use build: no public landing page. Send everyone straight to the app.
export default function RootPage() {
  redirect("/dashboard");
}
