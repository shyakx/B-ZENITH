import { requireRole } from "@/lib/auth/current-user";
import { assignableRoles } from "@/lib/auth/staff-policy";
import { CreateUserForm } from "@/components/admin/UserForms";
import { StaffDirectory } from "@/components/admin/StaffDirectory";
import { countActiveOwners, listUsers } from "@/services/users";

export default async function StaffPage() {
  const actor = await requireRole("ADMIN");
  const [users, ownerCount] = await Promise.all([listUsers(), countActiveOwners()]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <h1 className="text-xl font-semibold text-zenith-gold">Staff</h1>

      <section className="mt-5 rounded-xl border border-zenith-border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Create staff</h2>
        <CreateUserForm assignableRoles={assignableRoles(actor.role, ownerCount)} />
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">People</h2>
        <div className="mt-2 grid gap-2">
          <StaffDirectory users={users} />
        </div>
      </section>
    </div>
  );
}
