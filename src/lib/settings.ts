import { prisma } from "@/lib/prisma";

export const RECEIPT_PAPER_OPTIONS = ["80", "58"] as const;
export type ReceiptPaperMm = (typeof RECEIPT_PAPER_OPTIONS)[number];

export type BusinessSettings = {
  businessName: string;
  address: string;
  phone: string;
  tin: string;
  receiptFooter: string;
  receiptPaperMm: ReceiptPaperMm;
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "B-ZENITH",
  address: "Kigali, Rwanda",
  phone: "",
  tin: "",
  receiptFooter: "Thank you for visiting B-ZENITH",
  receiptPaperMm: "80",
};

export function parseReceiptPaperMm(value: string | null | undefined): ReceiptPaperMm {
  return value === "58" ? "58" : "80";
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    businessName: map.businessName ?? DEFAULT_SETTINGS.businessName,
    address: map.address ?? DEFAULT_SETTINGS.address,
    phone: map.phone ?? DEFAULT_SETTINGS.phone,
    tin: map.tin ?? DEFAULT_SETTINGS.tin,
    receiptFooter: map.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
    receiptPaperMm: parseReceiptPaperMm(map.receiptPaperMm),
  };
}

export async function saveBusinessSettings(settings: BusinessSettings) {
  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}
