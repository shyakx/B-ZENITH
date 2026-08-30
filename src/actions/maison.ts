"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createMaisonRecord, recordMaisonPayment } from "@/services/maison";

export async function createMaisonAction(input: {
  customerName: string;
  customerPhone?: string;
  reference?: string;
  date: string;
  amount: number;
  paidAmount?: number;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageMaison");
    const record = await createMaisonRecord({
      ...input,
      date: new Date(input.date),
      staffId: user.id,
    });
    revalidatePath("/manager/maison");
    return ok({ id: record.id });
  } catch (error) {
    return fail(error);
  }
}

export async function payMaisonAction(input: {
  id: string;
  amount: number;
}): Promise<ActionResult<{ paymentStatus: string }>> {
  try {
    const user = await requirePermission("manageMaison");
    const record = await recordMaisonPayment({ ...input, staffId: user.id });
    revalidatePath("/manager/maison");
    return ok({ paymentStatus: record.paymentStatus });
  } catch (error) {
    return fail(error);
  }
}
