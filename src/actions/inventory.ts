"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/current-user";
import { fail, ok, type ActionResult } from "@/lib/errors";
import {
  adjustStock,
  countStock,
  receiveStock,
  recordWaste,
  transferStock,
  upsertProductPack,
} from "@/services/inventory";
import { setSupplierActive, upsertSupplier } from "@/services/suppliers";

function refresh() {
  revalidatePath("/manager/inventory");
  revalidatePath("/manager/purchases");
  revalidatePath("/manager");
}

export async function receivePurchaseAction(input: {
  supplierId: string;
  locationId?: string;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
  lines: {
    productId: string;
    packUnitId?: string;
    packQuantity: number;
    packCost?: number;
    unitCost?: number;
  }[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const receipt = await receiveStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: receipt.id });
  } catch (error) {
    return fail(error);
  }
}

export async function transferStockAction(input: {
  fromLocationId?: string;
  toLocationId: string;
  notes?: string;
  idempotencyKey: string;
  lines: { productId: string; baseQuantity: number }[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const transfer = await transferStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: transfer.id });
  } catch (error) {
    return fail(error);
  }
}

export async function recordWasteAction(input: {
  productId: string;
  locationId: string;
  quantity: number;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await recordWaste({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}

export async function adjustStockAction(input: {
  productId: string;
  locationId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await adjustStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}

export async function countStockAction(input: {
  productId: string;
  locationId: string;
  counted: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const movement = await countStock({ ...input, userId: user.id });
    refresh();
    return ok({ id: movement.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveSupplierAction(input: {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  active?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const supplier = await upsertSupplier({ ...input, userId: user.id });
    refresh();
    return ok({ id: supplier.id });
  } catch (error) {
    return fail(error);
  }
}

export async function setSupplierActiveAction(input: {
  id: string;
  active: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const supplier = await setSupplierActive({ ...input, userId: user.id });
    refresh();
    return ok({ id: supplier.id });
  } catch (error) {
    return fail(error);
  }
}

export async function saveProductPackAction(input: {
  productId: string;
  unitId: string;
  baseQuantity: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageInventory");
    const pack = await upsertProductPack({ ...input, userId: user.id });
    refresh();
    return ok({ id: pack.id });
  } catch (error) {
    return fail(error);
  }
}
