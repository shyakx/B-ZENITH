import { Role } from "@prisma/client";
import { createEmployee, updateEmployee } from "@/actions/employees";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/authorization";
import { formatDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

const roleOptions: Record<string, Role[]> = {
  OWNER: ["OWNER", "ADMIN", "WAITER", "INVENTORY"],
  ADMIN: ["ADMIN", "WAITER", "INVENTORY"],
};

export default async function EmployeesPage() {
  const actor = await requireUser(["OWNER", "ADMIN"]);
  const employees = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      auditLogs: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true } },
    },
  });
  const roles = roleOptions[actor.role] ?? roleOptions.ADMIN;
  const activeOwners = employees.filter((employee) => employee.role === "OWNER" && employee.active);
  const lastOwnerId = activeOwners.length === 1 ? activeOwners[0].id : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Access control</p>
        <h1 className="text-3xl font-black">User management</h1>
        <p className="mt-2 text-sm text-stone-500">
          Create staff with a temporary PIN. They must change it on first login. Users are never deleted so sales history stays intact.
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
                {role}
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
          {employees.map((employee) => (
            <ActionForm key={employee.id} action={updateEmployee.bind(null, employee.id)} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
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
              <input required name="firstName" defaultValue={employee.firstName} className="min-h-11 rounded-md border px-3" />
              <input required name="lastName" defaultValue={employee.lastName} className="min-h-11 rounded-md border px-3" />
              <input required name="username" defaultValue={employee.username} className="min-h-11 rounded-md border px-3" />
              {employee.id === lastOwnerId ? (
                <>
                  <input type="hidden" name="role" value="OWNER" />
                  <select disabled defaultValue="OWNER" className="min-h-11 rounded-md border bg-stone-50 px-3">
                    <option value="OWNER">OWNER</option>
                  </select>
                </>
              ) : (
                <select name="role" defaultValue={employee.role} className="min-h-11 rounded-md border px-3">
                  {[...new Set([...roles, employee.role])].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              )}
              <input name="pin" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="New temporary PIN (optional)" className="min-h-11 rounded-md border px-3 sm:col-span-2" />
              {employee.id === lastOwnerId ? (
                <>
                  <input type="hidden" name="active" value="on" />
                  <label className="flex items-center gap-2 font-bold text-stone-500">
                    <input type="checkbox" defaultChecked disabled /> Active
                  </label>
                  <p className="self-center text-sm text-stone-500">
                    Last owner must stay active.
                    {employee.mustChangePin ? " Must change PIN on next login." : employee.pinHash ? " PIN ready." : " No PIN."}
                  </p>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 font-bold">
                    <input name="active" type="checkbox" defaultChecked={employee.active} /> Active
                  </label>
                  <p className="self-center text-sm text-stone-500">
                    {employee.mustChangePin ? "Must change PIN on next login" : employee.pinHash ? "PIN ready" : "No PIN"}
                  </p>
                </>
              )}
              <button className="min-h-11 rounded-md border font-bold sm:col-span-2">Save user</button>
              {employee.auditLogs.length > 0 && (
                <div className="sm:col-span-2 border-t pt-3 text-xs text-stone-500">
                  <p className="mb-1 font-bold text-stone-700">Recent activity</p>
                  {employee.auditLogs.map((log) => (
                    <p key={log.id}>
                      {formatDateTime(log.createdAt)} · {log.action}
                    </p>
                  ))}
                </div>
              )}
            </ActionForm>
          ))}
        </div>
      )}
    </div>
  );
}
