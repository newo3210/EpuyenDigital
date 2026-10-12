import { validateDocumentId } from "./document.js";
import {
  parseConfirmCitizenOk,
  parseConsentAccept,
  parseConsentDecline,
  parsePhotoFinish,
  parseRabiesStatus,
  parseReturningMenu,
  parseSex,
  parseSize,
  parseSpecies,
  parseSterilized,
  type RabiesStatus,
  type Sex,
  type Size,
  type Species,
  type TriState,
} from "./menus.js";
import type { RegistrationStep } from "./steps.js";
import { ANIMAL_START_STEP } from "./steps.js";

// Session payload - partial registration data held in JSONB
export type SessionPayload = {
  privacyConsentAt?: string;
  privacyNoticeVersion?: string;
  fullName?: string;
  documentId?: string;
  addressLine?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  citizenId?: string;
  animalName?: string;
  species?: Species;
  sex?: Sex;
  breedColor?: string;
  size?: Size;
  ageStage?: string;
  sterilized?: TriState;
  rabiesStatus?: RabiesStatus;
  microchip?: string;
  animalPhotoCount?: number;
  pendingMediaMessageIds?: string[];
  /** messageId → photo kind for completion linking */
  pendingMediaKinds?: Record<string, "animal" | "health_card">;
  completedAnimalId?: string;
  completedMunicipalId?: string;
};

export type InboundKind = "text" | "image" | "location" | "button_reply" | "unknown";

export type TransitionInput = {
  step: RegistrationStep;
  payload: SessionPayload;
  kind: InboundKind;
  text?: string;
  latitude?: number;
  longitude?: number;
  isReturningCitizen: boolean;
  citizenFullName?: string;
  now?: Date;
  expiresAt?: Date;
  privacyNoticeVersion?: string;
};

export type OutboundEffect = {
  messageKey: string;
  params?: Record<string, string | number>;
  menu?: "consent" | "species" | "sex" | "size" | "sterilized" | "rabies" | "photos" | "returning";
};

export type TransitionResult = {
  nextStep: RegistrationStep;
  payload: SessionPayload;
  effects: OutboundEffect[];
  completeRegistration: boolean;
  expired: boolean;
};

function textOf(input: TransitionInput): string {
  return (input.text ?? "").trim();
}

function requireNonEmpty(text: string): string | null {
  const t = text.trim();
  return t.length > 0 ? t : null;
}

// applyRegistrationTransition - pure step transition for registration chat
export function applyRegistrationTransition(input: TransitionInput): TransitionResult {
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) {
    const startStep: RegistrationStep = input.isReturningCitizen ? "returning_menu" : "consent";
    return {
      nextStep: startStep,
      payload: input.isReturningCitizen
        ? { citizenId: input.payload.citizenId }
        : {},
      effects: [
        input.isReturningCitizen
          ? {
              messageKey: "returning.greeting",
              params: { name: input.citizenFullName ?? "" },
              menu: "returning",
            }
          : { messageKey: "consent.notice", menu: "consent" },
      ],
      completeRegistration: false,
      expired: true,
    };
  }

  const payload = { ...input.payload };
  const effects: OutboundEffect[] = [];
  let step = input.step;
  let completeRegistration = false;

  switch (step) {
    case "consent": {
      if (parseConsentDecline(textOf(input))) {
        effects.push({ messageKey: "consent.declined" });
        break;
      }
      if (!parseConsentAccept(textOf(input))) {
        effects.push({ messageKey: "consent.unclear", menu: "consent" });
        break;
      }
      payload.privacyConsentAt = now.toISOString();
      payload.privacyNoticeVersion = input.privacyNoticeVersion ?? "v1";
      step = "full_name";
      effects.push({ messageKey: "citizen.ask_full_name" });
      break;
    }
    case "full_name": {
      const name = requireNonEmpty(textOf(input));
      if (!name) {
        effects.push({ messageKey: "citizen.ask_full_name_again" });
        break;
      }
      payload.fullName = name;
      step = "document_id";
      effects.push({ messageKey: "citizen.ask_document" });
      break;
    }
    case "document_id": {
      const doc = validateDocumentId(textOf(input));
      if (!doc) {
        effects.push({ messageKey: "citizen.invalid_document" });
        break;
      }
      payload.documentId = doc;
      step = "address_line";
      effects.push({ messageKey: "citizen.ask_address" });
      break;
    }
    case "address_line": {
      const address = requireNonEmpty(textOf(input));
      if (!address) {
        effects.push({ messageKey: "citizen.ask_address_again" });
        break;
      }
      payload.addressLine = address;
      step = "neighborhood";
      effects.push({ messageKey: "citizen.ask_neighborhood" });
      break;
    }
    case "neighborhood": {
      const neighborhood = requireNonEmpty(textOf(input));
      if (!neighborhood) {
        effects.push({ messageKey: "citizen.ask_neighborhood_again" });
        break;
      }
      payload.neighborhood = neighborhood;
      step = "location";
      effects.push({ messageKey: "citizen.ask_location" });
      break;
    }
    case "location": {
      if (input.kind !== "location" || input.latitude == null || input.longitude == null) {
        effects.push({ messageKey: "citizen.ask_location_again" });
        break;
      }
      payload.latitude = input.latitude;
      payload.longitude = input.longitude;
      step = ANIMAL_START_STEP;
      effects.push({ messageKey: "animal.ask_name" });
      break;
    }
    case "returning_menu": {
      const choice = parseReturningMenu(textOf(input));
      if (choice === "confirm_citizen") {
        step = "confirm_citizen";
        effects.push({ messageKey: "returning.confirm_citizen" });
        break;
      }
      if (choice === "register_animal") {
        step = ANIMAL_START_STEP;
        effects.push({ messageKey: "animal.ask_name" });
        break;
      }
      effects.push({
        messageKey: "returning.greeting",
        params: { name: input.citizenFullName ?? "" },
        menu: "returning",
      });
      break;
    }
    case "confirm_citizen": {
      // MVP narrowed: only explicit OK/confirm advances (no free-text corrections)
      if (!parseConfirmCitizenOk(textOf(input))) {
        effects.push({ messageKey: "returning.confirm_citizen" });
        break;
      }
      step = ANIMAL_START_STEP;
      effects.push({ messageKey: "animal.ask_name" });
      break;
    }
    case "animal_name": {
      const name = requireNonEmpty(textOf(input));
      if (!name) {
        effects.push({ messageKey: "animal.ask_name_again" });
        break;
      }
      payload.animalName = name;
      step = "species";
      effects.push({ messageKey: "animal.ask_species", menu: "species" });
      break;
    }
    case "species": {
      const species = parseSpecies(textOf(input));
      if (!species) {
        effects.push({ messageKey: "animal.ask_species_again", menu: "species" });
        break;
      }
      payload.species = species;
      step = "sex";
      effects.push({ messageKey: "animal.ask_sex", menu: "sex" });
      break;
    }
    case "sex": {
      const sex = parseSex(textOf(input));
      if (!sex) {
        effects.push({ messageKey: "animal.ask_sex_again", menu: "sex" });
        break;
      }
      payload.sex = sex;
      step = "breed_color";
      effects.push({ messageKey: "animal.ask_breed_color" });
      break;
    }
    case "breed_color": {
      const breed = requireNonEmpty(textOf(input));
      if (!breed) {
        effects.push({ messageKey: "animal.ask_breed_color_again" });
        break;
      }
      payload.breedColor = breed;
      step = "size";
      effects.push({ messageKey: "animal.ask_size", menu: "size" });
      break;
    }
    case "size": {
      const size = parseSize(textOf(input));
      if (!size) {
        effects.push({ messageKey: "animal.ask_size_again", menu: "size" });
        break;
      }
      payload.size = size;
      step = "age_stage";
      effects.push({ messageKey: "animal.ask_age_stage" });
      break;
    }
    case "age_stage": {
      const age = requireNonEmpty(textOf(input));
      if (!age) {
        effects.push({ messageKey: "animal.ask_age_stage_again" });
        break;
      }
      payload.ageStage = age;
      step = "sterilized";
      effects.push({ messageKey: "animal.ask_sterilized", menu: "sterilized" });
      break;
    }
    case "sterilized": {
      const sterilized = parseSterilized(textOf(input));
      if (!sterilized) {
        effects.push({ messageKey: "animal.ask_sterilized_again", menu: "sterilized" });
        break;
      }
      payload.sterilized = sterilized;
      step = "rabies_status";
      effects.push({ messageKey: "animal.ask_rabies", menu: "rabies" });
      break;
    }
    case "rabies_status": {
      const rabies = parseRabiesStatus(textOf(input));
      if (!rabies) {
        effects.push({ messageKey: "animal.ask_rabies_again", menu: "rabies" });
        break;
      }
      payload.rabiesStatus = rabies;
      step = "health_card_photo_optional";
      effects.push({ messageKey: "animal.ask_health_card" });
      break;
    }
    case "health_card_photo_optional": {
      if (input.kind === "image") {
        step = "animal_photos";
        payload.animalPhotoCount = payload.animalPhotoCount ?? 0;
        effects.push({ messageKey: "animal.ask_photos" });
        break;
      }
      const skip = normalizeSkip(textOf(input));
      if (skip || requireNonEmpty(textOf(input))) {
        step = "animal_photos";
        effects.push({ messageKey: "animal.ask_photos" });
        break;
      }
      effects.push({ messageKey: "animal.ask_health_card" });
      break;
    }
    case "animal_photos": {
      if (input.kind === "image") {
        payload.animalPhotoCount = (payload.animalPhotoCount ?? 0) + 1;
        effects.push({ messageKey: "animal.photo_ack", menu: "photos" });
        break;
      }
      if (input.kind !== "text" && input.kind !== "button_reply") {
        effects.push({ messageKey: "animal.ask_photos_image" });
        break;
      }
      const finish = parsePhotoFinish(textOf(input));
      if (finish === "another") {
        effects.push({ messageKey: "animal.ask_photos" });
        break;
      }
      if (finish === "finish") {
        if ((payload.animalPhotoCount ?? 0) < 1) {
          effects.push({ messageKey: "animal.photos_required" });
          break;
        }
        step = "completing";
        completeRegistration = true;
        effects.push({ messageKey: "registration.completing" });
        break;
      }
      if ((payload.animalPhotoCount ?? 0) < 1) {
        effects.push({ messageKey: "animal.photos_required" });
        break;
      }
      effects.push({ messageKey: "animal.photo_ack", menu: "photos" });
      break;
    }
    case "completing": {
      // Crash resume: completing without durable animal id must retry finalize
      if (!payload.completedAnimalId) {
        completeRegistration = true;
        effects.push({ messageKey: "registration.completing" });
        break;
      }
      effects.push({ messageKey: "registration.already_done" });
      break;
    }
    case "done": {
      effects.push({ messageKey: "registration.already_done" });
      break;
    }
    default: {
      effects.push({ messageKey: "registration.restart" });
      step = input.isReturningCitizen ? "returning_menu" : "consent";
    }
  }

  return {
    nextStep: step,
    payload,
    effects,
    completeRegistration,
    expired: false,
  };
}

// startRegistrationSession - initial step/effects for a phone
export function startRegistrationSession(params: {
  isReturningCitizen: boolean;
  citizenFullName?: string;
}): { step: RegistrationStep; effects: OutboundEffect[]; payload: SessionPayload } {
  if (params.isReturningCitizen) {
    return {
      step: "returning_menu",
      payload: {},
      effects: [
        {
          messageKey: "returning.greeting",
          params: { name: params.citizenFullName ?? "" },
          menu: "returning",
        },
      ],
    };
  }
  return {
    step: "consent",
    payload: {},
    effects: [{ messageKey: "consent.notice", menu: "consent" }],
  };
}

function normalizeSkip(raw: string): boolean {
  const v = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
  return v === "saltar" || v === "skip" || v === "no" || v === "omitir";
}
