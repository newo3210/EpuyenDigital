// Registration steps - ordered conversation steps for new and returning citizens

export const NEW_CITIZEN_STEPS = [
  "welcome",
  "full_name",
  "document_id",
  "address_line",
  "location_help_offer",
  "location_help",
  "location",
  "animal_name",
  "species",
  "sex",
  "breed_color",
  "size",
  "age_stage",
  "sterilized",
  "rabies_status",
  "health_card_photo_optional",
  "animal_photos",
  "completing",
  "done",
] as const;

export const RETURNING_STEPS = [
  "returning_menu",
  "confirm_citizen",
  "animal_name",
  "species",
  "sex",
  "breed_color",
  "size",
  "age_stage",
  "sterilized",
  "rabies_status",
  "health_card_photo_optional",
  "animal_photos",
  "completing",
  "done",
] as const;

export type RegistrationStep =
  | (typeof NEW_CITIZEN_STEPS)[number]
  | (typeof RETURNING_STEPS)[number];

export const ANIMAL_START_STEP: RegistrationStep = "animal_name";

// isAnimalStep - whether step belongs to animal collection
export function isAnimalStep(step: RegistrationStep): boolean {
  const animal = new Set<RegistrationStep>([
    "animal_name",
    "species",
    "sex",
    "breed_color",
    "size",
    "age_stage",
    "sterilized",
    "rabies_status",
    "health_card_photo_optional",
    "animal_photos",
    "completing",
    "done",
  ]);
  return animal.has(step);
}
