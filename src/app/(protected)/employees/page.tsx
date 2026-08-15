import { Role } from "@prisma/client";
import { createEmployee, updateEmployee } from "@/actions/employees";
import { requireUser } from "@/lib/authorization";
import { formatDate } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage() {
  await requireUser(["OWNER"]);
  const employees = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Access control</p><h1 className="text-3xl font-black">Employees</h1></div>
      <details className="rounded-lg border bg-white"><summary className="min-h-14 cursor-pointer p-4 font-black">Add employee</summary><form action={createEmployee} className="grid gap-3 border-t p-4 md:grid-cols-2"><input required name="name" placeholder="Full name" className="min-h-11 rounded-md border px-3" /><input required name="email" type="email" placeholder="Email" className="min-h-11 rounded-md border px-3" /><select name="role" className="min-h-11 rounded-md border px-3">{Object.values(Role).map((role) => <option key={role}>{role}</option>)}</select><input required name="password" type="password" minLength={8} placeholder="Temporary password" className="min-h-11 rounded-md border px-3" /><button className="min-h-11 rounded-md bg-black font-bold text-[#d4af37] md:col-span-2">Create employee</button></form></details>
      {employees.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-white p-10 text-center text-stone-500">No employees found.</p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {employees.map((employee) => (
            <form key={employee.id} action={updateEmployee.bind(null, employee.id)} className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-start justify-between gap-3">
                <div>
                  <b>{employee.email}</b>
                  <p className="text-xs text-stone-500">Created {formatDate(employee.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${employee.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-600"}`}>
                  {employee.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <input required name="name" defaultValue={employee.name} className="min-h-11 rounded-md border px-3" />
              <select name="role" defaultValue={employee.role} className="min-h-11 rounded-md border px-3">{Object.values(Role).map((role) => <option key={role}>{role}</option>)}</select>
              <input name="password" type="password" minLength={8} placeholder="New password (optional)" className="min-h-11 rounded-md border px-3" />
              <label className="flex items-center gap-2 font-bold"><input name="active" type="checkbox" defaultChecked={employee.active} /> Active</label>
              <button className="min-h-11 rounded-md border font-bold sm:col-span-2">Save employee</button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
