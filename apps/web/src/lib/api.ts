export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
/** "live": synced from the pharmacy's own events. "catalogue": the central database's last known value. */
export type StockSource = "live" | "catalogue";
export type SortKey = "best" | "distance" | "price" | "stock";

export interface MedicineRef {
  id: number;
  code: string;
  brandName: string;
  genericName: string;
  dosage: string;
  form: string;
}

export interface PharmacyRef {
  id: number;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SearchResult {
  rank: number;
  score: number;
  medicine: MedicineRef;
  pharmacy: PharmacyRef;
  quantity: number;
  price: number;
  stockStatus: StockStatus;
  distanceKm: number;
  updatedAt: string;
  source: StockSource;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SearchFilters {
  /** Only offers with stock (low stock counts). */
  inStock?: boolean;
  maxDistanceKm?: number;
  maxPrice?: number;
  sort?: SortKey;
}

export interface SearchResponse {
  results: SearchResult[];
  /** False: live stock did not answer, so everything shown is the catalogue's last known value. */
  live: boolean;
}

export interface Substitute {
  medicine: MedicineRef;
  sameStrength: boolean;
  sameForm: boolean;
  best: SearchResult;
  pharmaciesInStock: number;
}

export interface Pharmacy extends PharmacyRef {
  distanceKm: number | null;
}

export interface PharmacyStockItem {
  medicine: MedicineRef;
  quantity: number;
  price: number;
  stockStatus: StockStatus;
  updatedAt: string;
  source: StockSource;
}

export interface PharmacyStock {
  items: PharmacyStockItem[];
  /** Everything the pharmacy lists, before the name / availability filter. */
  total: number;
  live: boolean;
  summary: { inStock: number; lowStock: number; outOfStock: number };
}

export interface RestockSubscription {
  id: number;
  status: "ACTIVE" | "NOTIFIED" | "CANCELLED";
  medicine: { id: number; brandName: string; dosage: string };
  createdAt: string;
  notifiedAt: string | null;
}

export interface UserNotification {
  id: number;
  message: string;
  createdAt: string;
  deliveredAt: string | null;
}

/** An error whose message is safe and useful to show to the patient. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "validation" | "unavailable" | "network" | "notFound" | "unknown",
  ) {
    super(message);
  }
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
}

export type Options = { signal?: AbortSignal; fetchImpl?: typeof fetch; baseUrl?: string };

/** Maps an error response to a message that is safe and useful to show. Never exposes server text. */
async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  if (res.status === 400) {
    const detail = body.error?.details?.map((d) => d.message).join(". ");
    return new ApiError(detail || body.error?.message || "Please check your search and location.", "validation");
  }
  if (res.status === 404) return new ApiError("We couldn't find that.", "notFound");
  if (res.status === 503) return new ApiError("MedLink is temporarily unavailable. Please try again in a moment.", "unavailable");
  return new ApiError("Something went wrong on our side. Please try again.", "unknown");
}

async function call(path: string, init: RequestInit, opts: Options): Promise<Response> {
  const { signal, fetchImpl = fetch, baseUrl = API_URL } = opts;
  try {
    return await fetchImpl(`${baseUrl}${path}`, { ...init, signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Can't reach MedLink. Check your connection and try again.", "network");
  }
}

async function getJson<T extends { data?: unknown }>(path: string, opts: Options, expect: "array" | "object" = "array"): Promise<T> {
  const res = await call(path, {}, opts);
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as T;
  const ok = expect === "array" ? Array.isArray(body.data) : typeof body.data === "object" && body.data !== null;
  if (!ok) throw new ApiError("Unexpected response from MedLink.", "unknown");
  return body;
}

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return p.toString();
};

export async function searchMedicines(
  q: string,
  location: Location,
  opts: Options & { filters?: SearchFilters } = {},
): Promise<SearchResponse> {
  const f = opts.filters ?? {};
  const params = query({
    q,
    lat: location.latitude,
    lng: location.longitude,
    inStock: f.inStock ? "true" : undefined,
    maxDistanceKm: f.maxDistanceKm,
    maxPrice: f.maxPrice,
    sort: f.sort && f.sort !== "best" ? f.sort : undefined,
  });
  const body = await getJson<{ data: SearchResult[]; meta?: { live?: boolean } }>(`/api/search?${params}`, opts);
  return { results: body.data, live: body.meta?.live === true };
}

/** Same-ingredient medicines that can be bought nearby, for one that is out of stock. */
export async function getSubstitutes(medicineId: number, location: Location, opts: Options = {}): Promise<{ substitutes: Substitute[]; notice: string }> {
  const body = await getJson<{ data: Substitute[]; meta?: { notice?: string } }>(
    `/api/medicines/${medicineId}/substitutes?${query({ lat: location.latitude, lng: location.longitude })}`,
    opts,
  );
  return { substitutes: body.data, notice: body.meta?.notice ?? "Strength or form may differ. Check with a pharmacist or your doctor before switching." };
}

export async function listPharmacies(opts: Options = {}): Promise<PharmacyRef[]> {
  return (await getJson<{ data: PharmacyRef[] }>("/api/pharmacies", opts)).data;
}

export async function getPharmacy(id: number, location: Location | null, opts: Options = {}): Promise<Pharmacy> {
  const params = location ? `?${query({ lat: location.latitude, lng: location.longitude })}` : "";
  return (await getJson<{ data: Pharmacy }>(`/api/pharmacies/${id}${params}`, opts, "object")).data;
}

export async function getPharmacyStock(id: number, filter: { q?: string; inStock?: boolean } = {}, opts: Options = {}): Promise<PharmacyStock> {
  const params = query({ q: filter.q?.trim(), inStock: filter.inStock ? "true" : undefined });
  const body = await getJson<{ data: PharmacyStockItem[]; meta?: { total?: number; live?: boolean; summary?: PharmacyStock["summary"] } }>(
    `/api/pharmacies/${id}/stock${params ? `?${params}` : ""}`,
    opts,
  );
  return {
    items: body.data,
    total: body.meta?.total ?? body.data.length,
    live: body.meta?.live === true,
    summary: body.meta?.summary ?? { inStock: 0, lowStock: 0, outOfStock: 0 },
  };
}

/** Asks to be notified when a medicine is back in stock. Asking again while still waiting is fine. */
export async function subscribeToRestock(email: string, medicineId: number, opts: Options = {}): Promise<{ subscription: RestockSubscription; alreadyWaiting: boolean }> {
  const res = await call("/api/restock-subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, medicineId }) }, opts);
  if (res.ok) {
    const body = (await res.json()) as { data?: RestockSubscription; meta?: { created?: boolean } };
    if (!body.data) throw new ApiError("Unexpected response from MedLink.", "unknown");
    return { subscription: body.data, alreadyWaiting: body.meta?.created === false };
  }
  if (res.status === 404) throw new ApiError("That medicine is no longer listed.", "validation");
  throw await failure(res);
}

export async function listSubscriptions(email: string, opts: Options = {}): Promise<RestockSubscription[]> {
  return (await getJson<{ data: RestockSubscription[] }>(`/api/restock-subscriptions?${query({ email })}`, opts)).data;
}

export async function cancelSubscription(id: number, email: string, opts: Options = {}): Promise<void> {
  const res = await call(`/api/restock-subscriptions/${id}?${query({ email })}`, { method: "DELETE" }, opts);
  if (res.ok) return;
  if (res.status === 404) throw new ApiError("That subscription was already fulfilled or cancelled.", "notFound");
  throw await failure(res);
}

export async function listNotifications(email: string, opts: Options = {}): Promise<UserNotification[]> {
  return (await getJson<{ data: UserNotification[] }>(`/api/notifications?${query({ email })}`, opts)).data;
}
