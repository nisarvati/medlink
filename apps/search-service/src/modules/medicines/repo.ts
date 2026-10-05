import type { Db } from "@medlink/db";
import { dosagePattern, escapeLike, type MedicineQuery } from "./query.js";

export interface Medicine {
  id: number;
  brandName: string;
  genericName: string;
  dosage: string;
  form: string;
}

interface MedicineRow {
  id: string;
  brand_name: string;
  generic_name: string;
  dosage: string;
  form: string;
}

const toMedicine = (r: MedicineRow): Medicine => ({
  id: Number(r.id),
  brandName: r.brand_name,
  genericName: r.generic_name,
  dosage: r.dosage,
  form: r.form,
});

export async function searchMedicines(db: Db, q: MedicineQuery, limit = 20): Promise<Medicine[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (v: unknown) => `$${params.push(v)}`;

  for (const term of q.terms) {
    const p = add(`%${escapeLike(term)}%`);
    where.push(`(lower(brand_name) LIKE ${p} OR lower(generic_name) LIKE ${p} OR lower(form) LIKE ${p})`);
  }
  for (const d of q.dosages) {
    where.push(`lower(dosage) ~ ${add(dosagePattern(d))}`);
  }

  // Best name match first: exact brand, exact generic, brand prefix, generic prefix, anything else.
  const name = q.terms.join(" ");
  const exact = add(name);
  const prefix = add(`${escapeLike(name)}%`);
  const relevance = q.terms.length
    ? `CASE WHEN lower(brand_name) = ${exact} THEN 0
            WHEN lower(generic_name) = ${exact} THEN 1
            WHEN lower(brand_name) LIKE ${prefix} THEN 2
            WHEN lower(generic_name) LIKE ${prefix} THEN 3
            ELSE 4 END`
    : "0";

  const { rows } = await db.query<MedicineRow>(
    `SELECT id, brand_name, generic_name, dosage, form
     FROM medicines
     WHERE ${where.join(" AND ")}
     ORDER BY ${relevance}, brand_name, dosage
     LIMIT ${add(limit)}`,
    params,
  );
  return rows.map(toMedicine);
}
