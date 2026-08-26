import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DELETED_USERNAME_PREFIX } from "./employee-update";
import {
  LOGIN_STAFF_CACHE_CONTROL,
  LOGIN_STAFF_PATH,
  LOGIN_STAFF_PUBLIC_FIELDS,
  listPublicLoginStaff,
  loginStaffQuery,
  loginStaffRoles,
  parseLoginStaffRole,
  toPublicLoginStaff,
  type PublicLoginStaff,
} from "./login-staff";

const staffRouteSource = readFileSync(new URL("../app/api/staff/route.ts", import.meta.url), "utf8");
const loginStaffRouteSource = readFileSync(new URL("../app/api/login/staff/route.ts", import.meta.url), "utf8");
const loginFormSource = readFileSync(new URL("../components/login-form.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
const authorizationSource = readFileSync(new URL("./authorization.ts", import.meta.url), "utf8");

const SENSITIVE_FIELDS = [
  "id",
  "email",
  "password",
  "passwordHash",
  "pin",
  "pinHash",
  "pinFailedAttempts",
  "pinLockedUntil",
  "mustChangePin",
  "lastLoginAt",
  "createdAt",
  "updatedAt",
  "session",
  "token",
  "tokens",
  "resetToken",
  "secret",
  "secrets",
] as const;

type CatalogUser = PublicLoginStaff & {
  active: boolean;
  id: string;
  email: string;
  password: string;
  passwordHash: string;
  pin: string;
  pinHash: string;
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
  mustChangePin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  session: string;
  token: string;
  resetToken: string;
  secret: string;
};

function catalogUser(partial: Partial<CatalogUser> & Pick<CatalogUser, "username" | "role">): CatalogUser {
  const now = new Date("2026-08-26T08:00:00.000Z");
  return {
    id: `user-${partial.username}`,
    firstName: partial.firstName ?? partial.username,
    lastName: partial.lastName ?? "Staff",
    name: partial.name ?? `${partial.firstName ?? partial.username} ${partial.lastName ?? "Staff"}`,
    email: `${partial.username}@example.test`,
    password: "plaintext-password",
    passwordHash: "$2a$12$not-a-real-hash",
    pin: "1234",
    pinHash: "$2a$12$not-a-real-pin-hash",
    pinFailedAttempts: 2,
    pinLockedUntil: null,
    mustChangePin: true,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
    session: "session-secret",
    token: "auth-token",
    resetToken: "reset-token",
    secret: "internal-secret",
    active: true,
    ...partial,
  };
}

const directory: CatalogUser[] = [
  catalogUser({ username: "ada.owner", role: "OWNER", firstName: "Ada", lastName: "Owner", name: "Ada Owner" }),
  catalogUser({ username: "ben.admin", role: "ADMIN", firstName: "Ben", lastName: "Admin", name: "Ben Admin" }),
  catalogUser({ username: "cara.manager", role: "MANAGER", firstName: "Cara", lastName: "Manager", name: "Cara Manager" }),
  catalogUser({ username: "diego.waiter", role: "WAITER", firstName: "Diego", lastName: "Waiter", name: "Diego Waiter" }),
  catalogUser({ username: "eva.billiard", role: "BILLIARD", firstName: "Eva", lastName: "Billiard", name: "Eva Billiard" }),
  catalogUser({
    username: "inactive.owner",
    role: "OWNER",
    firstName: "Inactive",
    lastName: "Owner",
    name: "Inactive Owner",
    active: false,
  }),
  catalogUser({
    username: `${DELETED_USERNAME_PREFIX}gone.admin`,
    role: "ADMIN",
    firstName: "Gone",
    lastName: "Admin",
    name: "Gone Admin",
    active: true,
  }),
];

function applyQuery(query: ReturnType<typeof loginStaffQuery>): PublicLoginStaff[] {
  const prefix = query.where.NOT.username.startsWith;
  return directory
    .filter((user) => user.active === query.where.active)
    .filter((user) => user.role === query.where.role)
    .filter((user) => !user.username.startsWith(prefix))
    .map((user) => {
      const selected: PublicLoginStaff = {
        username: query.select.username ? user.username : "",
        name: query.select.name ? user.name : "",
        firstName: query.select.firstName ? user.firstName : "",
        lastName: query.select.lastName ? user.lastName : "",
        role: query.select.role ? user.role : "WAITER",
      };
      return selected;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function payloadKeys(staff: PublicLoginStaff[]) {
  return new Set(staff.flatMap((person) => Object.keys(person)));
}

describe("signed-out login selector", () => {
  for (const role of loginStaffRoles) {
    it(`${role} selector returns active ${role} users`, async () => {
      const result = await listPublicLoginStaff(role, async (query) => applyQuery(query));
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.ok(result.staff.length >= 1);
      for (const person of result.staff) {
        assert.equal(person.role, role);
      }
      const usernames = result.staff.map((person) => person.username);
      const expected = directory
        .filter((user) => user.role === role && user.active && !user.username.startsWith(DELETED_USERNAME_PREFIX))
        .map((user) => user.username)
        .sort();
      assert.deepEqual([...usernames].sort(), expected);
    });
  }
});

describe("login selector security", () => {
  it("exposes only username, display name fields, and role", async () => {
    const result = await listPublicLoginStaff("OWNER", async (query) => applyQuery(query));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual([...payloadKeys(result.staff)].sort(), [...LOGIN_STAFF_PUBLIC_FIELDS].sort());
    for (const field of SENSITIVE_FIELDS) {
      assert.equal(payloadKeys(result.staff).has(field), false, `must not expose ${field}`);
    }
  });

  it("strips secrets even if a finder returns extra user columns", async () => {
    const result = await listPublicLoginStaff("WAITER", async () => [
      {
        ...directory.find((user) => user.username === "diego.waiter")!,
      } as unknown as PublicLoginStaff,
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.staff, [
      {
        username: "diego.waiter",
        name: "Diego Waiter",
        firstName: "Diego",
        lastName: "Waiter",
        role: "WAITER",
      },
    ]);
    for (const field of SENSITIVE_FIELDS) {
      assert.equal(field in result.staff[0], false, `must not expose ${field}`);
    }
  });

  it("excludes deleted usernames", async () => {
    const result = await listPublicLoginStaff("ADMIN", async (query) => applyQuery(query));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.staff.some((person) => person.username.startsWith(DELETED_USERNAME_PREFIX)),
      false,
    );
    assert.deepEqual(
      result.staff.map((person) => person.username),
      ["ben.admin"],
    );
  });

  it("excludes inactive users", async () => {
    const result = await listPublicLoginStaff("OWNER", async (query) => applyQuery(query));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.staff.some((person) => person.username === "inactive.owner"),
      false,
    );
    assert.deepEqual(
      result.staff.map((person) => person.username),
      ["ada.owner"],
    );
  });

  it("rejects invalid roles without listing users", async () => {
    let called = false;
    for (const value of [null, "", "CASHIER", "owner", "OWNER'; DROP TABLE", "ALL"]) {
      const result = await listPublicLoginStaff(value, async () => {
        called = true;
        return [];
      });
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.status, 400);
      assert.equal(result.error, "Invalid role.");
    }
    assert.equal(called, false);
    assert.equal(parseLoginStaffRole("fields"), null);
    assert.equal(parseLoginStaffRole("passwordHash"), null);
  });

  it("ignores arbitrary query-style field selection", () => {
    const query = loginStaffQuery("MANAGER");
    assert.deepEqual(Object.keys(query.select).sort(), [...LOGIN_STAFF_PUBLIC_FIELDS].sort());
    for (const field of SENSITIVE_FIELDS) {
      assert.equal(field in query.select, false);
    }
    assert.equal(query.where.active, true);
    assert.equal(query.where.role, "MANAGER");
    assert.equal(query.where.NOT.username.startsWith, DELETED_USERNAME_PREFIX);
  });

  it("does not cache login identities", () => {
    assert.equal(LOGIN_STAFF_CACHE_CONTROL, "no-store");
    assert.match(loginStaffRouteSource, /Cache-Control/);
    assert.match(loginStaffRouteSource, /LOGIN_STAFF_CACHE_CONTROL/);
    assert.match(loginStaffRouteSource, /force-dynamic/);
  });
});

describe("existing /api/staff protection", () => {
  it("still returns 401 to signed-out callers", () => {
    assert.match(staffRouteSource, /export async function GET/);
    assert.match(staffRouteSource, /requireApiUser\(tillRoles\)/);
    assert.match(staffRouteSource, /if \(!auth\.ok\) return auth\.response;/);
    assert.match(authorizationSource, /Please sign in to continue\./);
    assert.match(authorizationSource, /status: 401 as const/);
    assert.doesNotMatch(staffRouteSource, /listPublicLoginStaff/);
    assert.doesNotMatch(loginStaffRouteSource, /requireApiUser/);
  });
});

describe("authentication regression", () => {
  it("selecting a username still submits PIN through the existing credentials flow", () => {
    assert.match(loginFormSource, /LOGIN_STAFF_PATH/);
    assert.match(loginFormSource, /encodeURIComponent\(next\)/);
    assert.doesNotMatch(loginFormSource, /\/api\/staff\?role/);
    assert.match(
      loginFormSource,
      /signIn\("credentials", \{\s*username: selected\.username,\s*pin,\s*redirect: false,\s*\}\)/,
    );
    assert.match(authSource, /username: z\.string\(\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(authSource, /verifyAndRecordPinAttempt/);
    const publicRow = toPublicLoginStaff({
      username: "ada.owner",
      name: "Ada Owner",
      firstName: "Ada",
      lastName: "Owner",
      role: "OWNER",
    });
    assert.equal("id" in publicRow, false);
    assert.equal(LOGIN_STAFF_PATH, "/api/login/staff");
  });
});
