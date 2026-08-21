export type ReportLine = {
  productName: string;
  quantity: number;
  returnedQuantity: number;
  lineSubtotal: number;
  categoryName?: string;
};

export type ReportSale = {
  createdAt: Date;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: ReportLine[];
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function remainingQuantity(quantity: number, returnedQuantity: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(returnedQuantity)) return 0;
  return Math.max(0, quantity - Math.max(0, returnedQuantity));
}

export function canReturnQuantity(quantity: number, returnedQuantity: number, additional: number) {
  if (!Number.isInteger(additional) || additional <= 0) return false;
  return additional <= remainingQuantity(quantity, returnedQuantity);
}

export function netLineAmounts(line: Pick<ReportLine, "quantity" | "returnedQuantity" | "lineSubtotal">) {
  const remaining = remainingQuantity(line.quantity, line.returnedQuantity);
  if (line.quantity <= 0) {
    return { quantity: 0, subtotal: 0 };
  }
  return {
    quantity: remaining,
    subtotal: money(line.lineSubtotal * (remaining / line.quantity)),
  };
}

export function netSaleAmounts(sale: Pick<ReportSale, "subtotal" | "tax" | "discount" | "total" | "items">) {
  const netSubtotal = money(sale.items.reduce((sum, item) => sum + netLineAmounts(item).subtotal, 0));
  const ratio = sale.subtotal > 0 ? netSubtotal / sale.subtotal : 0;
  const netDiscount = money(sale.discount * ratio);
  const netTax = money(sale.tax * ratio);
  const netTotal = money(Math.max(0, netSubtotal - netDiscount + netTax));
  const grossTotal = money(sale.total);
  const returnedTotal = money(Math.max(0, grossTotal - netTotal));
  return {
    grossTotal,
    netSubtotal,
    netDiscount,
    netTax,
    netTotal,
    returnedTotal,
  };
}

export function summarizeSales(sales: ReportSale[]) {
  const daily = new Map<string, { count: number; gross: number; net: number; returned: number }>();
  const payments = new Map<string, { count: number; gross: number; net: number }>();
  const products = new Map<string, { quantity: number; revenue: number }>();
  const categories = new Map<string, { quantity: number; revenue: number }>();

  let grossTotal = 0;
  let netTotal = 0;
  let returnedTotal = 0;

  for (const sale of sales) {
    const amounts = netSaleAmounts(sale);
    grossTotal = money(grossTotal + amounts.grossTotal);
    netTotal = money(netTotal + amounts.netTotal);
    returnedTotal = money(returnedTotal + amounts.returnedTotal);

    const day = sale.createdAt.toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" });
    const dayRow = daily.get(day) ?? { count: 0, gross: 0, net: 0, returned: 0 };
    daily.set(day, {
      count: dayRow.count + 1,
      gross: money(dayRow.gross + amounts.grossTotal),
      net: money(dayRow.net + amounts.netTotal),
      returned: money(dayRow.returned + amounts.returnedTotal),
    });

    const payRow = payments.get(sale.paymentMethod) ?? { count: 0, gross: 0, net: 0 };
    payments.set(sale.paymentMethod, {
      count: payRow.count + 1,
      gross: money(payRow.gross + amounts.grossTotal),
      net: money(payRow.net + amounts.netTotal),
    });

    for (const item of sale.items) {
      const net = netLineAmounts(item);
      const product = products.get(item.productName) ?? { quantity: 0, revenue: 0 };
      product.quantity += net.quantity;
      product.revenue = money(product.revenue + net.subtotal);
      products.set(item.productName, product);
      if (item.categoryName) {
        const category = categories.get(item.categoryName) ?? { quantity: 0, revenue: 0 };
        category.quantity += net.quantity;
        category.revenue = money(category.revenue + net.subtotal);
        categories.set(item.categoryName, category);
      }
    }
  }

  return {
    count: sales.length,
    grossTotal,
    netTotal,
    returnedTotal,
    averageNet: sales.length > 0 ? money(netTotal / sales.length) : 0,
    daily,
    payments,
    products,
    categories,
  };
}
