import {
  RABIES_MENU_LINES,
  SEX_MENU_LINES,
  SIZE_MENU_LINES,
  SPECIES_MENU_LINES,
  STERILIZED_MENU_LINES,
} from "../../registration/menus.js";

// Registration i18n - es-AR citizen-facing copy for the pet registry bot

export const registrationMessages = {
  "consent.notice":
    "Municipalidad de Epuyén — Inspectoría. Vamos a registrar tu mascota. Tus datos personales se tratan conforme a la Ley 25.326 (protección de datos personales) solo para el registro municipal. ¿Aceptás continuar?\n1 Acepto\n2 No acepto",
  "consent.declined":
    "Sin tu consentimiento no podemos continuar con el registro. Si cambiás de opinión, escribí de nuevo.",
  "consent.unclear":
    "Para continuar necesitamos tu aceptación explícita. Respondé *Acepto* o elegí la opción 1.",
  "citizen.ask_full_name": "¿Cuál es tu nombre y apellido completo?",
  "citizen.ask_full_name_again": "Necesitamos tu nombre completo. Escribilo por favor.",
  "citizen.ask_document": "¿Cuál es tu DNI o pasaporte?",
  "citizen.invalid_document":
    "Ese documento no parece válido. Ingresá un DNI (7 u 8 dígitos) o un pasaporte.",
  "citizen.ask_address": "¿Cuál es tu domicilio (calle y número o referencia)?",
  "citizen.ask_address_again": "Necesitamos un domicilio. Escribilo por favor.",
  "citizen.ask_neighborhood": "¿En qué barrio o paraje vivís?",
  "citizen.ask_neighborhood_again": "Indicá el barrio o paraje, por favor.",
  "citizen.ask_location":
    "Compartí tu ubicación actual con WhatsApp (clip → Ubicación → Ubicación actual).",
  "citizen.ask_location_again":
    "Necesitamos la ubicación de WhatsApp (no texto). Usá el clip → Ubicación → Ubicación actual.",
  "returning.greeting":
    "Hola {name}. ¿Qué querés hacer?\n1 Registrar otra mascota\n2 Confirmar mis datos",
  "returning.confirm_citizen":
    "Escribí *OK* para confirmar tus datos actuales y continuar con el registro de la mascota. (En este MVP no se aceptan correcciones por texto; si necesitás cambiar datos, contactá a Inspectoría.)",
  "animal.photos_saving":
    "Estamos guardando la foto… esperá un momento y respondé *listo* cuando quieras terminar.",
  "animal.ask_name": "¿Cómo se llama tu mascota?",
  "animal.ask_name_again": "Indicá el nombre de la mascota, por favor.",
  "animal.ask_species": `¿Qué especie es?\n${SPECIES_MENU_LINES.join("\n")}`,
  "animal.ask_species_again": `Elegí una opción válida:\n${SPECIES_MENU_LINES.join("\n")}`,
  "animal.ask_sex": `¿Sexo?\n${SEX_MENU_LINES.join("\n")}`,
  "animal.ask_sex_again": `Elegí una opción:\n${SEX_MENU_LINES.join("\n")}`,
  "animal.ask_breed_color": "¿Raza y color? (por ejemplo: mestizo negro)",
  "animal.ask_breed_color_again": "Indicá raza y color, por favor.",
  "animal.ask_size": `¿Tamaño?\n${SIZE_MENU_LINES.join("\n")}`,
  "animal.ask_size_again": `Elegí un tamaño:\n${SIZE_MENU_LINES.join("\n")}`,
  "animal.ask_age_stage": "¿Edad o etapa? (cachorro, adulto, senior, o años aproximados)",
  "animal.ask_age_stage_again": "Indicá la edad o etapa, por favor.",
  "animal.ask_sterilized": `¿Está castrado/a o esterilizado/a?\n${STERILIZED_MENU_LINES.join("\n")}`,
  "animal.ask_sterilized_again": `Elegí una opción:\n${STERILIZED_MENU_LINES.join("\n")}`,
  "animal.ask_rabies": `¿Estado de la vacuna antirrábica?\n${RABIES_MENU_LINES.join("\n")}`,
  "animal.ask_rabies_again": `Elegí una opción:\n${RABIES_MENU_LINES.join("\n")}`,
  "animal.ask_health_card":
    "Si querés, enviá una foto de la libreta sanitaria. Si no, escribí *saltar*.",
  "animal.ask_photos":
    "Enviá al menos una foto de tu mascota (cámara o galería).",
  "animal.ask_photos_image": "Necesitamos una foto (imagen). Enviá una foto de la mascota.",
  "animal.photo_ack":
    "Foto recibida. ¿Querés agregar otra o terminar?\n1 Listo / terminar\n2 Otra foto",
  "animal.photos_required": "Hace falta al menos una foto de la mascota para completar el registro.",
  "registration.completing": "Estamos guardando el registro…",
  "registration.confirmation":
    "¡Listo! {animalName} quedó registrado/a con el identificador municipal *{municipalId}*. Estado: activo.",
  "registration.already_done":
    "Este registro ya está completo. Si querés registrar otra mascota, escribinos de nuevo.",
  "registration.restart": "Arrancamos de nuevo el registro.",
} as const;

export type RegistrationMessageKey = keyof typeof registrationMessages;

// formatRegistrationMessage - interpolate {params} in es-AR copy
export function formatRegistrationMessage(
  key: RegistrationMessageKey,
  params: Record<string, string | number> = {},
): string {
  let text: string = registrationMessages[key];
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

// requiredRegistrationMessageKeys - keys that must exist (for tests)
export const requiredRegistrationMessageKeys = [
  "consent.notice",
  "consent.declined",
  "citizen.ask_full_name",
  "citizen.ask_document",
  "citizen.ask_location",
  "returning.greeting",
  "animal.ask_species",
  "animal.photos_required",
  "registration.confirmation",
] as const satisfies readonly RegistrationMessageKey[];
