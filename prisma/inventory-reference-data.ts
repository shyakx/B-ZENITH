import { LocationKind, Prisma, UnitFamily, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const LOCATIONS = [
  { id: "loc_MAIN", code: "MAIN", name: "Main Stock", kind: LocationKind.WAREHOUSE, sortOrder: 0 },
  { id: "loc_BAR", code: "BAR", name: "Bar", kind: LocationKind.OPERATIONAL, sortOrder: 1 },
  { id: "loc_KITCHEN", code: "KITCHEN", name: "Kitchen", kind: LocationKind.OPERATIONAL, sortOrder: 2 },
  { id: "loc_CAFE", code: "CAFE", name: "Cafe", kind: LocationKind.OPERATIONAL, sortOrder: 3 },
] as const;

const UNITS = [
  { id: "unit_PIECE", code: "PIECE", name: "Piece", family: UnitFamily.COUNT },
  { id: "unit_BOTTLE", code: "BOTTLE", name: "Bottle", family: UnitFamily.COUNT },
  { id: "unit_SHOT", code: "SHOT", name: "Shot", family: UnitFamily.COUNT },
  { id: "unit_GLASS", code: "GLASS", name: "Glass", family: UnitFamily.COUNT },
  { id: "unit_G", code: "G", name: "Gram", family: UnitFamily.WEIGHT },
  { id: "unit_KG", code: "KG", name: "Kilogram", family: UnitFamily.WEIGHT },
  { id: "unit_ML", code: "ML", name: "Millilitre", family: UnitFamily.VOLUME },
  { id: "unit_L", code: "L", name: "Litre", family: UnitFamily.VOLUME },
  { id: "unit_CRATE", code: "CRATE", name: "Crate", family: UnitFamily.COUNT },
  { id: "unit_CARTON", code: "CARTON", name: "Carton", family: UnitFamily.COUNT },
  { id: "unit_BAG", code: "BAG", name: "Bag", family: UnitFamily.COUNT },
  { id: "unit_BOX", code: "BOX", name: "Box", family: UnitFamily.COUNT },
] as const;

export async function ensureInventoryReferenceData(db: Db) {
  for (const location of LOCATIONS) {
    await db.stockLocation.upsert({
      where: { code: location.code },
      create: { ...location, active: true },
      update: {
        name: location.name,
        kind: location.kind,
        active: true,
        sortOrder: location.sortOrder,
      },
    });
  }

  for (const unit of UNITS) {
    await db.unit.upsert({
      where: { code: unit.code },
      create: { ...unit, active: true },
      update: { name: unit.name, family: unit.family, active: true },
    });
  }
}