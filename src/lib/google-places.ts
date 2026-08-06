export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  userRatingsTotal: number;
  mapsUrl: string;
  category: string;
  description: string;
  photoUrl: string;
  // The UNRESOLVED Places photo resource name, kept so a caller that deferred
  // photo hydration can resolve it later (see hydratePhotoUrls). Empty when the
  // place has no photo, or when photoUrl was already resolved inline.
  photoName: string;
  location: {
    lat: number;
    lng: number;
  };
}

interface PlacesApiPhoto {
  name?: string;
}

interface PlacesApiReview {
  text?: { text?: string };
  originalText?: { text?: string };
  rating?: number;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
}

interface PlacesApiPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  photos?: PlacesApiPhoto[];
  reviews?: PlacesApiReview[];
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  when: string;
}

export interface CompetitorResult {
  name: string;
  rating: number;
  reviewCount: number;
  website: string;
  category: string;
  address: string;
}

const PLACES_BASE = "https://places.googleapis.com/v1";

// Resolve a Places photo resource into a public, key-free googleusercontent URL.
// Uses skipHttpRedirect so the API returns JSON ({ photoUri }) instead of redirecting,
// which keeps our API key server-side only. Best-effort: returns "" on any failure.
async function resolvePhotoUrl(
  photoName: string,
  apiKey: string
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${PLACES_BASE}/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true&key=${apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return "";
    const data: { photoUri?: string } = await res.json();
    return data.photoUri ?? "";
  } catch {
    return "";
  }
}

// Shared Text Search runner. Google Places Text Search returns up to 20 per page
// and a maximum of 60 total across 3 pages (hard API cap). Walk the
// nextPageToken chain until we hit the cap, the requested max, or run out of
// pages, then hydrate each place (incl. a key-free photo URL).
//
// resolvePhotos=false skips the per-place Place Photo call and returns the raw
// photo resource name instead. That call is BILLED PER PLACE, and the daily
// prospector discards ~75% of what it searches during scoring — so paying for a
// photo before the row survives selection is money spent on rows nobody sees.
// Callers that render results immediately (the Studio search) leave it true.
async function runTextSearch(
  query: string,
  apiKey: string,
  maxResults: number,
  resolvePhotos = true
): Promise<PlaceResult[]> {
  const collected: PlacesApiPlace[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // nextPageToken must be in the field mask or it won't be returned.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location,places.googleMapsUri,places.primaryTypeDisplayName,places.editorialSummary,places.photos,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!response.ok) {
      // Fail hard only on the first page; otherwise return what we have so far.
      if (collected.length === 0) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Google Places API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }
      break;
    }

    const data: { places?: PlacesApiPlace[]; nextPageToken?: string } =
      await response.json();
    collected.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && collected.length < maxResults);

  const places = collected.slice(0, maxResults);

  return Promise.all(
    places.map(async (place: PlacesApiPlace) => {
      const firstPhoto = place.photos?.[0]?.name ?? "";
      const photoUrl =
        firstPhoto && resolvePhotos ? await resolvePhotoUrl(firstPhoto, apiKey) : "";

      return {
        placeId: place.id ?? "",
        name: place.displayName?.text ?? "",
        address: place.formattedAddress ?? "",
        phone: place.nationalPhoneNumber ?? "",
        website: place.websiteUri ?? "",
        rating: place.rating ?? 0,
        userRatingsTotal: place.userRatingCount ?? 0,
        mapsUrl: place.googleMapsUri ?? "",
        category: place.primaryTypeDisplayName?.text ?? "",
        description: place.editorialSummary?.text ?? "",
        photoUrl,
        // Carried only when hydration was deferred — once photoUrl is resolved
        // the name has no further use.
        photoName: resolvePhotos ? "" : firstPhoto,
        location: {
          lat: place.location?.latitude ?? 0,
          lng: place.location?.longitude ?? 0,
        },
      };
    })
  );
}

export async function searchBusinesses(
  industry: string,
  city: string,
  maxResults = 60,
  opts?: { resolvePhotos?: boolean }
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }
  return runTextSearch(
    `${industry} in ${city}`,
    apiKey,
    maxResults,
    opts?.resolvePhotos ?? true
  );
}

// Resolve photos for an ALREADY-SELECTED subset of results — the other half of
// searchBusinesses({ resolvePhotos: false }). Place Photo is billed per call, so
// the prospector searches wide with hydration off and calls this on only the
// rows that survived scoring. Best-effort per row: a photo that fails to resolve
// leaves photoUrl empty, exactly as inline hydration does.
// Generic over the row type so callers that have ENRICHED a PlaceResult (the
// prospector attaches score/metro/finding) get their own type back rather than a
// widened PlaceResult, which would silently drop those fields at the type level.
export async function hydratePhotoUrls<T extends PlaceResult>(
  places: T[]
): Promise<T[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return places;

  return Promise.all(
    places.map(async (p) => {
      if (p.photoUrl || !p.photoName) return { ...p, photoName: "" };
      const photoUrl = await resolvePhotoUrl(p.photoName, apiKey);
      return { ...p, photoUrl, photoName: "" };
    })
  );
}

// Search for a specific business by name. City is optional but, when given,
// disambiguates between locations/chains. Returns every matching place so the
// operator can pick the exact one and generate an asset pack for it.
export async function searchBusinessesByName(
  name: string,
  city?: string,
  maxResults = 60
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }
  const query = city && city.trim() ? `${name} ${city}` : name;
  return runTextSearch(query, apiKey, maxResults);
}

// Fetch up to 5 of a place's most relevant Google reviews (text + rating).
// Best-effort: returns [] on any failure or when no placeId/API key is present,
// so audit generation degrades gracefully to website + Places metadata only.
export async function fetchPlaceReviews(
  placeId: string | null | undefined
): Promise<PlaceReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !placeId) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      signal: controller.signal,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "reviews",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data: PlacesApiPlace = await res.json();
    const reviews = data.reviews ?? [];

    return reviews
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "Google reviewer",
        rating: r.rating ?? 0,
        text: (r.text?.text ?? r.originalText?.text ?? "").trim(),
        when: r.relativePublishTimeDescription ?? "",
      }))
      .filter((r) => r.text.length > 0)
      .slice(0, 5);
  } catch {
    return [];
  }
}

// Find direct local competitors for the same niche + city. Excludes the target
// business by placeId. Best-effort: returns [] on any failure so the audit can
// still proceed without competitor intelligence.
export async function findCompetitors(
  industry: string | null | undefined,
  city: string | null | undefined,
  excludePlaceId?: string | null
): Promise<CompetitorResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !industry || !city) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({
        textQuery: `${industry} in ${city}`,
        maxResultCount: 12,
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const data: { places?: PlacesApiPlace[] } = await response.json();
    const places = data.places ?? [];

    return places
      .filter((p) => p.id && p.id !== excludePlaceId)
      .map((p) => ({
        name: p.displayName?.text ?? "",
        rating: p.rating ?? 0,
        reviewCount: p.userRatingCount ?? 0,
        website: p.websiteUri ?? "",
        category: p.primaryTypeDisplayName?.text ?? "",
        address: p.formattedAddress ?? "",
      }))
      .filter((c) => c.name.length > 0)
      .slice(0, 8);
  } catch {
    return [];
  }
}
