"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { changePin, createUser, updateUser } from "@/services/users";

function revalidateStaff(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/access");
  revalidatePath("/admin/audit");
  if (id) revalidatePath(`/admin/users/${id}`);
}

export async function createUserAction(input: {
  name: string;
  role: string;
  pin: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("manageUsers");
    const user = await createUser({ ...input, actorId: actor.id });
    revalidateStaff(user.id);
    return ok({ id: user.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateUserAction(input: {
  id: string;
  name?: string;
  role?: string;
  active?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("manageUsers");
    const user = await updateUser({ ...input, actorId: actor.id });
    revalidateStaff(user.id);
    return ok({ id: user.id });
  } catch (error) {
    return fail(error);
  }
}

export async function changePinAction(input: {
  id: string;
  pin: string;
}): Promise<ActionResult> {
  try {
    const actor = await requirePermission("manageUsers");
    await changePin({ ...input, actorId: actor.id });
    revalidateStaff(input.id);
    return ok(undefined);
  } catch (error) {
    return fail(error);
  }
}
