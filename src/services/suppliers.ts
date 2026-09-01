import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireInventoryManager } from "@/services/stock";

export async function listSuppliers(activeOnly = false) {
  return prisma.supplier.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function upsertSupplier(input: {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  active?: boolean;
  userId: string;
}) {
  await requireInventoryManager(prisma, input.userId);
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Supplier name is required.");

  if (input.id) {
    const current = await prisma.supplier.findUnique({ where: { id: input.id } });
    if (!current) throw new AppError("Supplier not found.");
    const updated = await prisma.supplier.update({
      where: { id: input.id },
      data: {
        name,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        taxId: input.taxId?.trim() || null,
        notes: input.notes?.trim() || null,
        active: input.active ?? current.active,
      },
    });
    await writeAudit({
      userId: input.userId,
      action: "SUPPLIER_UPDATED",
      entity: "Supplier",
      entityId: updated.id,
      before: { name: current.name, active: current.active },
      after: { name: updated.name, active: updated.active },
    });
    return updated;
  }

  const created = await prisma.supplier.create({
    data: {
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      taxId: input.taxId?.trim() || null,
      notes: input.notes?.trim() || null,
      active: input.active ?? true,
    },
  });
  await writeAudit({
    userId: input.userId,
    action: "SUPPLIER_CREATED",
    entity: "Supplier",
    entityId: created.id,
    after: { name: created.name },
  });
  return created;
}

export async function setSupplierActive(input: { id: string; active: boolean; userId: string }) {
  await requireInventoryManager(prisma, input.userId);
  const current = await prisma.supplier.findUnique({ where: { id: input.id } });
  if (!current) throw new AppError("Supplier not found.");
  const updated = await prisma.supplier.update({
    where: { id: input.id },
    data: { active: input.active },
  });
  await writeAudit({
    userId: input.userId,
    action: input.active ? "SUPPLIER_ACTIVATED" : "SUPPLIER_DEACTIVATED",
    entity: "Supplier",
    entityId: updated.id,
    before: { active: current.active },
    after: { active: updated.active, name: updated.name },
  });
  return updated;
}

export async function listSupplierHistory(supplierId: string, take = 50) {
  return prisma.stockReceipt.findMany({
    where: { supplierId },
    include: {
      receivedBy: { select: { id: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { receivedAt: "desc" },
    take,
  });
}
