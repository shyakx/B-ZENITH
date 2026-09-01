"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  changePinAction,
  createUserAction,
  deleteStaffAction,
  updateUserAction,
} from "@/actions/users";
import { ROLES, roleLabel, type Role } from "@/lib/auth/roles";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";

function isStaffRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function RoleOptions({ roles }: { roles: Role[] }) {
  return (
    <>
      {roles.map((item) => (
        <option key={item} value={item}>
          {roleLabel(item)}
        </option>
      ))}
    </>
  );
}

export function CreateUserForm({ assignableRoles }: { assignableRoles: Role[] }) {
  const router = useRouter();
  const defaultRole: Role = assignableRoles.includes("WAITER")
    ? "WAITER"
    : (assignableRoles[0] ?? "WAITER");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(defaultRole);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const result = await createUserAction({ name, role, pin });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setRole(defaultRole);
    setPin("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
      <Field label="Full name">
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Role">
        <Select
          name="role"
          value={role}
          onChange={(event) => {
            if (isStaffRole(event.target.value)) setRole(event.target.value);
          }}
        >
          <RoleOptions roles={assignableRoles} />
        </Select>
      </Field>
      <Field label="Temporary PIN">
        <Input
          name="pin"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          required
        />
      </Field>
      <div className="flex items-end">
        <Button className="w-full" disabled={busy || assignableRoles.length === 0}>
          {busy ? "Creating…" : "Create staff"}
        </Button>
      </div>
      {error ? <p className="text-sm font-semibold text-zenith-danger md:col-span-4">{error}</p> : null}
      {success ? (
        <p className="text-sm font-semibold text-zenith-success md:col-span-4">
          Staff member created successfully.
        </p>
      ) : null}
    </form>
  );
}

export function StaffActions({
  user,
  assignableRoles,
  canResetPin,
  canChangeActive,
  canDelete,
}: {
  user: { id: string; name: string; role: Role; active: boolean };
  assignableRoles: Role[];
  canResetPin: boolean;
  canChangeActive: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const roleOptions = ROLES.filter((item) => item === user.role || assignableRoles.includes(item));
  const [role, setRole] = useState<Role>(user.role);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState<"role" | "pin" | "active" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function resetFeedback() {
    setError("");
    setMessage("");
  }

  async function changeRole() {
    setBusy(true);
    resetFeedback();
    const result = await updateUserAction({
      id: user.id,
      role,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirm(null);
    setMessage("Role updated.");
    router.refresh();
  }

  async function resetPin() {
    setBusy(true);
    resetFeedback();
    const result = await changePinAction({ id: user.id, pin });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPin("");
    setConfirm(null);
    setMessage("Temporary PIN set. Give it to the staff member now.");
    router.refresh();
  }

  async function toggleActive() {
    setBusy(true);
    resetFeedback();
    const result = await updateUserAction({
      id: user.id,
      active: !user.active,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirm(null);
    setMessage(user.active ? "Staff member deactivated." : "Staff member activated.");
    router.refresh();
  }

  async function confirmDelete() {
    setBusy(true);
    resetFeedback();
    const result = await deleteStaffAction({ id: user.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zenith-border bg-white p-4">
        <h3 className="text-base font-semibold">Change role</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select
            value={role}
            disabled={confirm === "role"}
            onChange={(event) => {
              if (isStaffRole(event.target.value)) setRole(event.target.value);
            }}
          >
            <RoleOptions roles={roleOptions} />
          </Select>
          {confirm === "role" ? (
            <div className="sm:col-span-2 space-y-3">
              <p className="font-semibold">
                Change {user.name}&apos;s role from {roleLabel(user.role)} to {roleLabel(role)}?
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button disabled={busy || role === user.role} onClick={changeRole}>
                  {busy ? "Saving…" : "Change role"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              disabled={role === user.role}
              onClick={() => {
                resetFeedback();
                setConfirm("role");
              }}
            >
              Change role
            </Button>
          )}
        </div>
      </section>

      {canResetPin ? (
        <section className="rounded-2xl border border-zenith-border bg-white p-4">
          <h3 className="text-base font-semibold">Reset PIN</h3>
          {confirm === "pin" ? (
            <div className="mt-3 space-y-3">
              <p className="font-semibold">Reset PIN for {user.name}?</p>
              <p className="text-sm">
                The current PIN will stop working and the new temporary PIN will be used for the next
                login.
              </p>
              <Field label="New temporary PIN">
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setConfirm(null);
                    setPin("");
                  }}
                >
                  Cancel
                </Button>
                <Button disabled={busy || pin.length === 0} onClick={resetPin}>
                  {busy ? "Saving…" : "Reset PIN"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => {
                resetFeedback();
                setConfirm("pin");
              }}
            >
              Reset PIN
            </Button>
          )}
        </section>
      ) : null}

      {canChangeActive ? (
        <section className="rounded-2xl border border-zenith-border bg-white p-4">
          <h3 className="text-base font-semibold">{user.active ? "Deactivate" : "Activate"}</h3>
          {confirm === "active" ? (
            <div className="mt-3 space-y-3">
              {user.active ? (
                <>
                  <p className="font-semibold">Deactivate {user.name}?</p>
                  <p className="text-sm">
                    {user.name} will no longer be able to log in. The account stays in staff records
                    and can be activated again.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Activate {user.name}?</p>
                  <p className="text-sm">{user.name} will be able to log in again.</p>
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button variant={user.active ? "danger" : "primary"} disabled={busy} onClick={toggleActive}>
                  {busy ? "Saving…" : user.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              variant={user.active ? "danger" : "primary"}
              onClick={() => {
                resetFeedback();
                setConfirm("active");
              }}
            >
              {user.active ? "Deactivate" : "Activate"}
            </Button>
          )}
        </section>
      ) : null}

      {canDelete ? (
        <section className="rounded-2xl border border-zenith-border bg-white p-4">
          <h3 className="text-base font-semibold">Delete staff</h3>
          {confirm === "delete" ? (
            <div className="mt-3 space-y-3">
              <p className="font-semibold">Delete this staff account permanently?</p>
              <p className="text-sm">
                The staff account will no longer be able to log in. Historical business records will
                be preserved.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="danger" disabled={busy} onClick={confirmDelete}>
                  {busy ? "Deleting…" : "Delete permanently"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              variant="danger"
              onClick={() => {
                resetFeedback();
                setConfirm("delete");
              }}
            >
              Delete staff
            </Button>
          )}
        </section>
      ) : null}

      {error ? <p className="text-sm font-semibold text-zenith-danger">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-zenith-success">{message}</p> : null}
    </div>
  );
}
