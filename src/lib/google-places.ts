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
  location: {
    lat: number;
    lng: number;
  };
}

interface PlacesApiPhoto {
  name?: string;
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

export async function searchBusinesses(
  industry: string,
  city: string
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY not configured");
  }

  const query = `${industry} in ${city}`;

  const response = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location,places.googleMapsUri,places.primaryTypeDisplayName,places.editorialSummary,places.photos",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Google Places API error: ${response.status} - ${JSON.stringify(errorData)}`
    );
  }

  const data: { places?: PlacesApiPlace[] } = await response.json();
  const places: PlacesApiPlace[] = data.places ?? [];

  return Promise.all(
    places.map(async (place: PlacesApiPlace) => {
      const firstPhoto = place.photos?.[0]?.name;
      const photoUrl = firstPhoto
        ? await resolvePhotoUrl(firstPhoto, apiKey)
        : "";

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
        location: {
          lat: place.location?.latitude ?? 0,
          lng: place.location?.longitude ?? 0,
        },
      };
    })
  );
}
