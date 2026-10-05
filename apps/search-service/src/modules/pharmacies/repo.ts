import type { Db } from "@medlink/db";

export interface Pharmacy {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export async function listPharmacies(db: Db): Promise<Pharmacy[]> {
  const { rows } = await db.query<{ id: string; name: string; address: string; latitude: number; longitude: number }>(
    "SELECT id, name, address, latitude, longitude FROM pharmacies ORDER BY name",
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}
