type JsonRecord = Record<string, unknown>;

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Created staff",
  PERMISSION_CHANGED: "Changed role",
  PIN_CHANGED: "Reset PIN",
  USER_ACTIVATED: "Activated staff",
  USER_DEACTIVATED: "Deactivated staff",
  USER_DELETED: "Deleted staff",
  SETTINGS_CHANGED: "Changed settings",
};

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function readName(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readRole(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function auditAffected(log: {
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): string {
  const after = asRecord(log.after);
  const before = asRecord(log.before);
  const name = readName(after.name) || readName(before.name);
  const afterRole = readRole(after.role);
  const beforeRole = readRole(before.role);

  if (log.entity === "User") {
    if (beforeRole && afterRole && beforeRole !== afterRole) {
      return name ? `${name} · ${beforeRole} → ${afterRole}` : `${beforeRole} → ${afterRole}`;
    }
    if (name && afterRole) return `${name} · ${afterRole}`;
    if (name) return name;
    return "Staff member";
  }

  if (log.entity === "Setting") {
    return "Business settings";
  }

  return log.entity;
}
