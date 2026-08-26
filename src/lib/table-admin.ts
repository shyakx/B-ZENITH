import { userAdminRoles } from "@/lib/roles";

export const tableAdminRoles = userAdminRoles;

export function canManageTables(role?: string | null) {
  return Boolean(role && tableAdminRoles.some((allowed) => allowed === role));
}

export function normalizeTableName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateTableName(value: string) {
  const name = normalizeTableName(value);
  if (!name) return { ok: false as const, error: "Enter a table name." };
  if (name.length > 40) return { ok: false as const, error: "Table name is too long." };
  return { ok: true as const, name };
}

export function tableNameTaken(name: string, existingNames: string[]) {
  const needle = normalizeTableName(name).toLowerCase();
  return existingNames.some((existing) => normalizeTableName(existing).toLowerCase() === needle);
}

export function tableCanStartService(table: { active?: boolean; status: string }) {
  return table.active !== false && table.status === "AVAILABLE";
}

export function tableHasOpenService(input: { status: string; openSessionCount: number }) {
  return input.status === "OCCUPIED" || input.openSessionCount > 0;
}

export function canDeactivateTable(input: { status: string; openSessionCount: number }) {
  if (tableHasOpenService(input)) {
    return {
      ok: false as const,
      error: "This table is currently in service. Finish or settle the session before deactivating it.",
    };
  }
  return { ok: true as const };
}

export function nextTableSortOrder(maxSortOrder: number | null | undefined) {
  return Math.max(0, maxSortOrder ?? 0) + 1;
}

export function createTableWriteData(input: {
  name: string;
  active?: boolean;
  maxSortOrder: number | null | undefined;
}) {
  const parsed = validateTableName(input.name);
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    data: {
      name: parsed.name,
      active: input.active !== false,
      status: "AVAILABLE",
      sortOrder: nextTableSortOrder(input.maxSortOrder),
    },
  };
}

export function updateTableWriteData(input: { name?: string; active?: boolean }) {
  const data: { name?: string; active?: boolean } = {};
  if (input.name !== undefined) {
    const parsed = validateTableName(input.name);
    if (!parsed.ok) return parsed;
    data.name = parsed.name;
  }
  if (input.active !== undefined) data.active = input.active;
  if (Object.keys(data).length === 0) {
    return { ok: false as const, error: "Nothing to update." };
  }
  return { ok: true as const, data };
}
