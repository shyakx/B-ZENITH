import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { staffActionFlags } from "@/lib/auth/staff-policy";
import { roleLabel } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { StaffActions } from "@/components/admin/UserForms";
import { Badge } from "@/components/ui/Badge";
import { countActiveOwners, getUserById } from "@/services/users";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const ownerCount = await countActiveOwners();
  const flags = staffActionFlags(actor, user, ownerCount);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link href="/admin/users" className="text-sm font-semibold text-zenith-gold">
        ← Staff
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zenith-gold">{user.name}</h1>
          <p className="mt-1 text-sm text-zenith-muted">
            {roleLabel(user.role)} · Created {formatDate(user.createdAt)}
          </p>
        </div>
        <Badge
          className={
            user.active
              ? "border-emerald-200 bg-emerald-50 text-zenith-success"
              : "border-zenith-border bg-zenith-surface text-zenith-muted"
          }
        >
          {user.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="mt-6">
        <StaffActions user={user} {...flags} />
      </div>

      <p className="mt-6 text-sm">
        <Link href={`/admin/audit?userId=${encodeURIComponent(user.id)}`} className="font-semibold text-zenith-gold">
          View this staff member&apos;s audit log →
        </Link>
      </p>
    </div>
  );
}
