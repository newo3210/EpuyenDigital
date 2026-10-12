// Menu parsers - button replies and numbered fallbacks for catalog fields

export type Species = "dog" | "cat" | "other";
export type Sex = "male" | "female";
export type Size = "small" | "medium" | "large";
export type TriState = "yes" | "no" | "unknown";
export type RabiesStatus = "up_to_date" | "pending";

function normalizeChoice(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

// parseSpecies - Perro/Gato/Otro or 1/2/3
export function parseSpecies(raw: string): Species | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "perro" || v === "dog") return "dog";
  if (v === "2" || v === "gato" || v === "cat") return "cat";
  if (v === "3" || v === "otro" || v === "other") return "other";
  return null;
}

// parseSex - Macho/Hembra
export function parseSex(raw: string): Sex | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "macho" || v === "male") return "male";
  if (v === "2" || v === "hembra" || v === "female") return "female";
  return null;
}

// parseSize - Pequeño/Mediano/Grande
export function parseSize(raw: string): Size | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "pequeno" || v === "pequeño" || v === "small") return "small";
  if (v === "2" || v === "mediano" || v === "medium") return "medium";
  if (v === "3" || v === "grande" || v === "large") return "large";
  return null;
}

// parseSterilized - Sí/No/No sé
export function parseSterilized(raw: string): TriState | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "si" || v === "sí" || v === "yes") return "yes";
  if (v === "2" || v === "no") return "no";
  if (v === "3" || v === "no se" || v === "no sé" || v === "unknown") return "unknown";
  return null;
}

// parseRabiesStatus - Al día / Pendiente
export function parseRabiesStatus(raw: string): RabiesStatus | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "al dia" || v === "al día" || v === "up_to_date") return "up_to_date";
  if (v === "2" || v === "pendiente" || v === "pending") return "pending";
  return null;
}

// parseConsentAccept - Acepto keywords / button
export function parseConsentAccept(raw: string): boolean {
  const v = normalizeChoice(raw);
  return v === "acepto" || v === "aceptar" || v === "si" || v === "sí" || v === "1" || v === "accept";
}

// parseConsentDecline - explicit decline
export function parseConsentDecline(raw: string): boolean {
  const v = normalizeChoice(raw);
  return v === "no" || v === "rechazo" || v === "no acepto" || v === "2" || v === "decline";
}

// parsePhotoFinish - finish vs add another
export function parsePhotoFinish(raw: string): "finish" | "another" | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v === "listo" || v === "terminar" || v === "finish" || v === "fin") {
    return "finish";
  }
  if (v === "2" || v === "otra" || v === "otro" || v === "another") return "another";
  return null;
}

// parseReturningMenu - register animal / confirm data
export function parseReturningMenu(raw: string): "register_animal" | "confirm_citizen" | null {
  const v = normalizeChoice(raw);
  if (v === "1" || v.includes("animal") || v.includes("registrar")) return "register_animal";
  if (v === "2" || v.includes("dato") || v.includes("confirmar")) return "confirm_citizen";
  return null;
}

// parseConfirmCitizenOk - explicit OK/confirm only (no free-text corrections in MVP)
export function parseConfirmCitizenOk(raw: string): boolean {
  const v = normalizeChoice(raw);
  return (
    v === "ok" ||
    v === "okay" ||
    v === "confirmo" ||
    v === "confirm" ||
    v === "si" ||
    v === "sí" ||
    v === "1"
  );
}

export const SPECIES_MENU_LINES = ["1 Perro", "2 Gato", "3 Otro"] as const;
export const SEX_MENU_LINES = ["1 Macho", "2 Hembra"] as const;
export const SIZE_MENU_LINES = ["1 Pequeño", "2 Mediano", "3 Grande"] as const;
export const STERILIZED_MENU_LINES = ["1 Sí", "2 No", "3 No sé"] as const;
export const RABIES_MENU_LINES = ["1 Al día", "2 Pendiente"] as const;
