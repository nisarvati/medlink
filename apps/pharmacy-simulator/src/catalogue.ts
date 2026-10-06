import { MEDICINES, PHARMACIES, type SeedMedicine, type SeedPharmacy } from "@medlink/db";

export class SimulatorError extends Error {
  constructor(
    public readonly code: "UNKNOWN_PHARMACY" | "UNKNOWN_MEDICINE" | "NOT_STOCKED" | "ALREADY_STOCKED" | "INSUFFICIENT_STOCK" | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "SimulatorError";
  }
}

export const pharmacyByCode = (code: string): SeedPharmacy => {
  const p = PHARMACIES.find((x) => x.code === code);
  if (!p) throw new SimulatorError("UNKNOWN_PHARMACY", `Unknown pharmacy "${code}". Known: ${PHARMACIES.map((x) => x.code).join(", ")}`);
  return p;
};

export const medicineByCode = (code: string): SeedMedicine | undefined => MEDICINES.find((m) => m.code === code);

/** "Crocin 500mg" */
export const medicineLabel = (code: string): string => {
  const m = medicineByCode(code);
  return m ? `${m.brand} ${m.dosage}` : code;
};

/** Accepts a pharmacy code in any case ("p004"). */
export function resolvePharmacy(input: string): string {
  return pharmacyByCode(input.trim().toUpperCase()).code;
}

/** Accepts a medicine code ("m001") or the start of a brand name ("croc"). */
export function resolveMedicine(input: string): string {
  const text = input.trim();
  if (!text) throw new SimulatorError("UNKNOWN_MEDICINE", `Name a medicine by code (M001) or brand (Crocin); "list" shows the catalogue.`);
  if (/^m\d{3,}$/i.test(text)) {
    const code = text.toUpperCase();
    if (!medicineByCode(code)) throw new SimulatorError("UNKNOWN_MEDICINE", `Unknown medicine "${code}". Try "list" to see the catalogue.`);
    return code;
  }
  const matches = MEDICINES.filter((m) => m.brand.toLowerCase().startsWith(text.toLowerCase()));
  if (matches.length === 1) return matches[0]!.code;
  if (matches.length > 1) {
    throw new SimulatorError("UNKNOWN_MEDICINE", `"${input}" matches several medicines: ${matches.map((m) => `${m.code} ${m.brand}`).join(", ")}`);
  }
  throw new SimulatorError("UNKNOWN_MEDICINE", `Unknown medicine "${input}". Use a code (M001) or a brand name (Crocin); "list" shows the catalogue.`);
}
