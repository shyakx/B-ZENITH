import { ServiceChannel, SessionStatus, ItemStatus, FulfillmentStatus } from "@prisma/client";

export type PosVariant = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: string;
};

export type PosProduct = {
  id: string;
  name: string;
  categoryId: string;
  trackInventory: boolean;
  stockQuantity: number;
  variants: PosVariant[];
};

export type Category = { id: string; name: string };

export type TableInfo = {
  id: string;
  name: string;
  status: string;
  sortOrder: number;
};

export type SessionInfo = {
  id: string;
  channel: ServiceChannel;
  status: SessionStatus;
  waiterId: string;
  waiter: { name: string | null };
  tableId: string | null;
  table?: TableInfo | null;
  destinationLabel: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  openedAt: string;
  totalAmount: number;
  roundCount: number;
  rounds?: any[]; // For detailed session view
};
