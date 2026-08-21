"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/authorization";
import { pinSchema } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

export async function changeOwnPin(formData: FormData) {
  const actor = await requireUser(undefined, { allowMustChangePin: true });
  const pin = pinSchema.safeParse(formData.get("pin"));
  const confirm = pinSchema.safeParse(formData.get("confirmPin"));
  if (!pin.success || !confirm.success) return { error: "PIN must be 4 digits." };
  if (pin.data !== confirm.data) return { error: "PINs do not match." };

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { pinHash: true, mustChangePin: true },
  });

  if (!current.mustChangePin) {
    const currentPin = pinSchema.safeParse(formData.get("currentPin"));
    if (!currentPin.success) return { error: "Enter your current PIN." };
    if (!current.pinHash || !(await compare(currentPin.data, current.pinHash))) {
      return { error: "Current PIN is incorrect." };
    }
    if (currentPin.data === pin.data) return { error: "Choose a different PIN from your current one." };
  } else if (current.pinHash && (await compare(pin.data, current.pinHash))) {
    return { error: "Choose a new PIN. Do not reuse the temporary PIN." };
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: {
      pinHash: await hash(pin.data, 12),
      mustChangePin: false,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  });
  await writeAudit(actor, { action: "CHANGE_PIN", entity: "User", entityId: actor.id });
  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/change-pin");
  return { ok: true as const };
}
