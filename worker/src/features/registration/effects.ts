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
  location_help: [
    { id: "help", label: "Sí" },
    { id: "skip_help", label: "Ya sé" },
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
    { id: "unknown", label: "No sé" },
  ],
  returning: [
    { id: "register_animal", label: "Registrar" },
    { id: "confirm_citizen", label: "Mis datos" },
  ],
};

// renderEffect - produce text + optional buttons / media for an effect
export function renderEffect(effect: OutboundEffect): {
  text: string;
  buttons?: { id: string; label: string }[];
  sendMedia?: "location_help";
} {
  const text = formatRegistrationMessage(
    effect.messageKey as RegistrationMessageKey,
    effect.params,
  );
  const buttons = effect.menu ? MENU_BUTTONS[effect.menu] : undefined;
  return { text, buttons, sendMedia: effect.sendMedia };
}
