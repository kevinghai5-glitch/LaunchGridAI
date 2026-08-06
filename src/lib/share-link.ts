// The client offer's share link — one place that decides what is shareable.
//
// THE BUG THIS EXISTS TO STOP. The link used to be built from APP_URL, which
// falls back to http://localhost:3000. Copied on the operator's machine it looks
// perfectly correct; pasted into a client's inbox it is dead, and nothing
// anywhere reports an error. The failure surfaces days later, on the client's
// side, as silence.
//
// So an unconfigured host is not papered over with a fallback: offerShareUrl
// returns null, and every caller has to say what is missing. Two callers today —
// the Library row and the calculator's copy button — and they must never
// disagree about whether a link can be handed out.

import { PUBLIC_BASE_URL, PUBLIC_URL_ENV_VAR } from "@/lib/constants";

/** Relative path to the offer. Always valid — opening it locally is fine. */
export function offerPath(publicId: string): string {
  return `/p/${publicId}`;
}

/** The absolute URL to give a client, or null when no public host is set. */
export function offerShareUrl(publicId: string): string | null {
  return PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${offerPath(publicId)}` : null;
}

/** What to tell the operator when there is no shareable URL. Names the variable
 *  rather than saying "not configured", because the next thing he needs is the
 *  string to type, not a diagnosis. */
export const SHARE_URL_UNSET = `Set ${PUBLIC_URL_ENV_VAR} in .env to copy a client link`;
