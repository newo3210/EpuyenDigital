import {
  LOCATION_HELP_MENU_LINES,
  RABIES_MENU_LINES,
  SEX_MENU_LINES,
  SIZE_MENU_LINES,
  SPECIES_MENU_LINES,
  STERILIZED_MENU_LINES,
} from "../../registration/menus.js";

// Registration i18n - es-AR citizen-facing copy for the pet registry bot (UX v2)

export const registrationMessages = {
  "welcome.intro":
    "Municipalidad de Epuyén — Inspectoría.\nVamos a registrar tu mascota. Empezamos con *tus datos*.",
  "citizen.ask_full_name": "¿Cuál es tu nombre y apellido?",
  "citizen.ask_full_name_again": "Necesitamos tu nombre completo. Escribilo por favor.",
  "citizen.ask_document": "¿Cuál es tu DNI o pasaporte?",
  "citizen.invalid_document":
    "Ese documento no parece válido. Ingresá un DNI (7 u 8 dígitos) o un pasaporte.",
  "citizen.ask_address": "¿Cuál es tu domicilio (calle y número)?",
  "citizen.ask_address_again": "Necesitamos un domicilio. Escribilo por favor.",
  "citizen.location_help_offer": `Para compartir tu ubicación actual, ¿necesitás una ayuda?\n${LOCATION_HELP_MENU_LINES.join("\n")}`,
  "citizen.location_help_offer_again": `Elegí una opción:\n${LOCATION_HELP_MENU_LINES.join("\n")}`,
  "citizen.location_help":
    "Para enviar tu ubicación: tocá el clip 📎 → *Ubicación* → *Ubicación actual*.\nSi no podés ahora, escribí *No puedo ahora*.",
  "citizen.ask_location":
    "Compartí tu ubicación actual con WhatsApp (clip → Ubicación → Ubicación actual).\nSi no podés ahora, escribí *No puedo ahora*.",
  "citizen.ask_location_again":
    "Necesitamos la ubicación de WhatsApp (pin de mapa) o escribí *No puedo ahora* para continuar sin GPS.",
  "returning.greeting":
    "Hola {name}. ¿Qué querés hacer?\n1 Registrar otra mascota\n2 Confirmar mis datos",
  "returning.confirm_citizen":
    "Escribí *OK* para confirmar tus datos actuales y continuar con el registro de la mascota. (En este MVP no se aceptan correcciones por texto; si necesitás cambiar datos, contactá a Inspectoría.)",
  "animal.photos_saving":
    "Estamos guardando la foto… esperá un momento y respondé *Listo* cuando quieras terminar.",
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
    "Si querés, enviá una foto de la libreta sanitaria. Si no, escribí *No*.",
  "animal.ask_photos":
    "Enviá al menos una foto de tu mascota (varios ángulos ayudan). Cuando termines, escribí *Listo*.",
  "animal.ask_photos_image": "Necesitamos una foto (imagen). Enviá una foto de la mascota.",
  "animal.photo_ack":
    "Foto recibida. Podés mandar otra desde otro ángulo, o escribí *Listo* / *OK* cuando termines.",
  "animal.photos_required": "Hace falta al menos una foto de la mascota para completar el registro.",
  "registration.completing": "Estamos guardando el registro…",
  "registration.confirmation":
    "¡Gracias! *{animalName}* quedó registrado/a a nombre de *{citizenFullName}*, identificador municipal *{municipalId}*.",
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
  "welcome.intro",
  "citizen.ask_full_name",
  "citizen.ask_document",
  "citizen.location_help_offer",
  "citizen.location_help",
  "citizen.ask_location",
  "returning.greeting",
  "animal.ask_species",
  "animal.ask_rabies",
  "animal.photos_required",
  "registration.confirmation",
] as const satisfies readonly RegistrationMessageKey[];
