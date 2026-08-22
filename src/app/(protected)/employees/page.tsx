import { Role } from "@prisma/client";
import { createEmployee, updateEmployee } from "@/actions/employees";
import { ActionForm } from "@/components/action-form";
import { DeleteUserButton } from "@/components/delete-user-button";
import { requireUser } from "@/lib/authorization";
import { formatDateTime } from "@/lib/datetime";
import {
  DELETED_USERNAME_PREFIX,
  LAST_OWNER_MESSAGE,
  assignableRoles,
  authorizeEmployeeDelete,
} from "@/lib/employee-update";
import { userAdminRoles, roleTitle } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage() {
  const actor = await requireUser(userAdminRoles);
  const employees = await prisma.user.findMany({
    where: { NOT: { username: { startsWith: DELETED_USERNAME_PREFIX } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      auditLogs: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true } },
    },
  });
  const roles = assignableRoles(actor.role);
  const activeOwners = employees.filter((employee) => employee.role === "OWNER" && employee.active);
  const lastOwnerId = activeOwners.length === 1 ? activeOwners[0].id : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Access control</p>
        <h1 className="text-3xl font-black">User management</h1>
        <p className="mt-2 text-sm text-stone-500">
          Admins can create users, promote them to owner, and delete accounts. The last active owner cannot be removed.
          Sales history is kept if the person already recorded transactions.
        </p>
      </div>
      <details className="rounded-lg border bg-white">
        <summary className="min-h-14 cursor-pointer p-4 font-black">Add user</summary>
        <ActionForm action={createEmployee} className="grid gap-3 border-t p-4 md:grid-cols-2">
          <input required name="firstName" placeholder="First name" className="min-h-11 rounded-md border px-3" />
          <input required name="lastName" placeholder="Last name" className="min-h-11 rounded-md border px-3" />
          <input required name="username" placeholder="Username (e.g. john.doe)" className="min-h-11 rounded-md border px-3" />
          <select name="role" className="min-h-11 rounded-md border px-3">
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleTitle(role)}
              </option>
            ))}
          </select>
          <input required name="pin" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="Temporary PIN" className="min-h-11 rounded-md border px-3" />
          <label className="flex items-center gap-2 font-bold">
            <input name="active" type="checkbox" defaultChecked /> Active
          </label>
          <button className="min-h-11 rounded-md bg-black font-bold text-[#d4af37] md:col-span-2">Create user</button>
        </ActionForm>
      </details>
      {employees.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No users found.</p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {employees.map((employee) => {
            const lastOwner = employee.id === lastOwnerId;
            const pinStatus = employee.mustChangePin
              ? "Must change PIN on next login."
              : employee.pinHash
                ? "PIN ready."
                : "No PIN.";
            const canDelete = authorizeEmployeeDelete({
              actorId: actor.id,
              actorRole: actor.role,
              targetId: employee.id,
              targetRole: employee.role,
              targetActive: employee.active,
              otherActiveOwnerCount:
                employee.role === "OWNER" && employee.active ? activeOwners.length - 1 : activeOwners.length,
            }).ok;

            return (
              <div key={`${employee.id}-${employee.role}-${employee.active}`} className="grid gap-3 rounded-lg border bg-white p-4">
                <ActionForm
                  action={updateEmployee.bind(null, employee.id)}
                  className="grid gap-3 sm:grid-cols-2"
                  footer={
                    employee.auditLogs.length > 0 ? (
                      <div className="sm:col-span-2 border-t pt-3 text-xs text-stone-500">
                        <p className="mb-1 font-bold text-stone-700">Recent activity</p>
                        {employee.auditLogs.map((log) => (
                          <p key={log.id}>
                            {formatDateTime(log.createdAt)} · {log.action}
                          </p>
                        ))}
                      </div>
                    ) : null
                  }
                >
                  <div className="flex items-start justify-between gap-3 sm:col-span-2">
                    <div>
                      <b>{employee.name}</b>
                      <p className="text-xs text-stone-500">
                        @{employee.username}
                        {employee.lastLoginAt ? ` · Last login ${formatDateTime(employee.lastLoginAt)}` : " · Never logged in"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${employee.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-600"}`}>
                      {employee.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  {lastOwner ? (
                    <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900 sm:col-span-2">{LAST_OWNER_MESSAGE}</p>
                  ) : null}
                  <input required name="firstName" defaultValue={employee.firstName} className="min-h-11 rounded-md border px-3" />
                  <input required name="lastName" defaultValue={employee.lastName} className="min-h-11 rounded-md border px-3" />
                  <input required name="username" defaultValue={employee.username} className="min-h-11 rounded-md border px-3" />
                  {lastOwner ? (
                    <>
                      <input type="hidden" name="role" value={employee.role} />
                      <select disabled defaultValue={employee.role} className="min-h-11 rounded-md border bg-stone-50 px-3">
                        <option value={employee.role}>{roleTitle(employee.role)}</option>
                      </select>
                    </>
                  ) : (
                    <select name="role" defaultValue={employee.role} className="min-h-11 rounded-md border px-3">
                      {[...new Set([...roles, employee.role])].map((role: Role) => (
                        <option key={role} value={role}>
                          {roleTitle(role)}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    name="pin"
                    inputMode="numeric"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="New temporary PIN (optional)"
                    className="min-h-11 rounded-md border px-3 sm:col-span-2"
                  />
                  {lastOwner ? (
                    <>
                      <input type="hidden" name="active" value="on" />
                      <label className="flex items-center gap-2 font-bold text-stone-500">
                        <input type="checkbox" defaultChecked={employee.active} disabled /> Active
                      </label>
                      <p className="self-center text-sm text-stone-500">{pinStatus}</p>
                    </>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 font-bold">
                        <input name="active" type="checkbox" defaultChecked={employee.active} /> Active
                      </label>
                      <p className="self-center text-sm text-stone-500">{pinStatus}</p>
                    </>
                  )}
                  <button className="min-h-11 rounded-md border font-bold sm:col-span-2">Save user</button>
                </ActionForm>
                {canDelete ? <DeleteUserButton userId={employee.id} name={employee.name} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
