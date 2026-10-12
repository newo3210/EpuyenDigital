import {
  formatRegistrationMessage,
  type OutboundEffect,
  type RegistrationMessageKey,
} from "@epuyen/shared";

// Effects - map state-machine outbound effects to send_outbound job payloads

const MENU_BUTTONS: Record<
  NonNullable<OutboundEffect["menu"]>,
  { id: string; label: string }[] | undefined
> = {
  consent: [
    { id: "accept", label: "Acepto" },
    { id: "decline", label: "No acepto" },
  ],
  species: [
    { id: "dog", label: "Perro" },
    { id: "cat", label: "Gato" },
    { id: "other", label: "Otro" },
  ],
  sex: [
    { id: "male", label: "Macho" },
    { id: "female", label: "Hembra" },
  ],
  size: [
    { id: "small", label: "Pequeño" },
    { id: "medium", label: "Mediano" },
    { id: "large", label: "Grande" },
  ],
  sterilized: [
    { id: "yes", label: "Sí" },
    { id: "no", label: "No" },
    { id: "unknown", label: "No sé" },
  ],
  rabies: [
    { id: "up_to_date", label: "Al día" },
    { id: "pending", label: "Pendiente" },
  ],
  photos: [
    { id: "finish", label: "Listo" },
    { id: "another", label: "Otra foto" },
  ],
  returning: [
    { id: "register_animal", label: "Registrar" },
    { id: "confirm_citizen", label: "Mis datos" },
  ],
};

// renderEffect - produce text + optional buttons for an effect
export function renderEffect(effect: OutboundEffect): {
  text: string;
  buttons?: { id: string; label: string }[];
} {
  const text = formatRegistrationMessage(
    effect.messageKey as RegistrationMessageKey,
    effect.params,
  );
  const buttons = effect.menu ? MENU_BUTTONS[effect.menu] : undefined;
  return { text, buttons };
}
