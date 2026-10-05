export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface SearchResult {
  rank: number;
  score: number;
  medicine: { id: number; brandName: string; genericName: string; dosage: string; form: string };
  pharmacy: { id: number; name: string; address: string; latitude: number; longitude: number };
  quantity: number;
  price: number;
  stockStatus: StockStatus;
  distanceKm: number;
  updatedAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
}

/** An error whose message is safe and useful to show to the patient. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "validation" | "unavailable" | "network" | "unknown",
  ) {
    super(message);
  }
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
}

export async function searchMedicines(
  q: string,
  location: Location,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch; baseUrl?: string } = {},
): Promise<SearchResult[]> {
  const { signal, fetchImpl = fetch, baseUrl = API_URL } = opts;
  const params = new URLSearchParams({ q, lat: String(location.latitude), lng: String(location.longitude) });

  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/api/search?${params}`, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Can't reach the MedLink search service. Check your connection and try again.", "network");
  }

  if (res.ok) {
    const body = (await res.json()) as { data?: SearchResult[] };
    if (!Array.isArray(body.data)) throw new ApiError("Unexpected response from the search service.", "unknown");
    return body.data;
  }

  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  if (res.status === 400) {
    const detail = body.error?.details?.map((d) => d.message).join(". ");
    throw new ApiError(detail || body.error?.message || "Please check your search and location.", "validation");
  }
  if (res.status === 503) {
    throw new ApiError("MedLink is temporarily unavailable. Please try again in a moment.", "unavailable");
  }
  throw new ApiError("Something went wrong on our side. Please try again.", "unknown");
}
