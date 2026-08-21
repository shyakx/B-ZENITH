import { ChangePinForm } from "@/components/change-pin-form";
import { requireUser } from "@/lib/authorization";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#947313]">Your account</p>
        <h1 className="text-3xl font-black">Sign-in PIN</h1>
        <p className="mt-2 text-sm text-stone-500">
          Logged in as {user.name} · {user.role}
          {user.username ? ` · ${user.username}` : ""}
        </p>
      </div>
      <div className="rounded-lg border bg-white p-5">
        <ChangePinForm userId={user.id} role={user.role} requireCurrent={user.hasPin && !user.mustChangePin} />
      </div>
    </div>
  );
}
