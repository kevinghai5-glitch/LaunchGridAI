// The Zoom Room now lives as a toggle inside the Calendar page. This index route
// is kept only to redirect any old links there.
import { redirect } from "next/navigation";

export default function ZoomRoomIndexRedirect() {
  redirect("/calendar");
}
