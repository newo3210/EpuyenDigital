// Send mode guard - dry_run / allowlist / production for outbound WhatsApp

export type SendMode = "dry_run" | "allowlist" | "production";

export type SendDecision =
  | { allowed: true }
  | { allowed: false; reason: "dry_run" | "not_allowlisted" };

// decideSend - single entry guard before Evolution send
export function decideSend(params: {
  mode: SendMode;
  phone: string;
  allowlist: string[];
}): SendDecision {
  if (params.mode === "dry_run") {
    return { allowed: false, reason: "dry_run" };
  }
  if (params.mode === "allowlist") {
    if (!params.allowlist.includes(params.phone)) {
      return { allowed: false, reason: "not_allowlisted" };
    }
  }
  return { allowed: true };
}
