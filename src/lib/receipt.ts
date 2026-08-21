export type ReceiptItem = {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type ReceiptData = {
  businessName: string;
  venueLine: string;
  address: string;
  phone: string;
  email: string;
  receiptNumber: string;
  date: string;
  cashier: string;
  items: ReceiptItem[];
  subtotal: string;
  tax: string;
  showTax: boolean;
  total: string;
  payment: string;
  cashReceived: string | null;
  change: string | null;
  footer: string;
};

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const WIDTH = 32;

function ascii(value: string) {
  return value
    .normalize("NFKD")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u202f", " ")
    .replace(/[^\x20-\x7E]/g, (char) => {
      const map: Record<string, string> = {
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        é: "e",
        è: "e",
        ê: "e",
        ë: "e",
        à: "a",
        á: "a",
        ô: "o",
        ö: "o",
        ü: "u",
        ç: "c",
      };
      return map[char] ?? map[char.toLowerCase()] ?? " ";
    });
}

function encode(text: string) {
  return Uint8Array.from(ascii(text), (char) => char.charCodeAt(0));
}

function concat(...chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function wrap(text: string, width = WIDTH) {
  const clean = ascii(text).trim();
  if (clean.length <= width) return [clean];
  const lines: string[] = [];
  let rest = clean;
  while (rest.length > width) {
    const slice = rest.slice(0, width);
    const breakAt = slice.lastIndexOf(" ");
    const take = breakAt > 12 ? breakAt : width;
    lines.push(rest.slice(0, take).trimEnd());
    rest = rest.slice(take).trimStart();
  }
  if (rest) lines.push(rest);
  return lines;
}

function columns(left: string, right: string, width = WIDTH) {
  const l = ascii(left);
  const r = ascii(right);
  if (l.length + r.length >= width) {
    return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`.slice(0, width);
  }
  return `${l}${" ".repeat(width - l.length - r.length)}${r}`;
}

function line(text = "") {
  return concat(encode(text.padEnd(WIDTH, " ").slice(0, WIDTH)), new Uint8Array([LF]));
}

function dashed() {
  return line("-".repeat(WIDTH));
}

export function buildEscPosReceipt(receipt: ReceiptData) {
  const chunks: Uint8Array[] = [
    new Uint8Array([ESC, 0x40]),
    new Uint8Array([ESC, 0x74, 0x00]),
    new Uint8Array([ESC, 0x61, 0x01]),
    new Uint8Array([ESC, 0x21, 0x30]),
    concat(encode(ascii(receipt.businessName).slice(0, 16)), new Uint8Array([LF])),
    new Uint8Array([ESC, 0x21, 0x00]),
    concat(encode(receipt.venueLine), new Uint8Array([LF])),
  ];

  if (receipt.address) chunks.push(concat(encode(ascii(receipt.address)), new Uint8Array([LF])));
  if (receipt.phone) chunks.push(concat(encode(`Tel: ${receipt.phone}`), new Uint8Array([LF])));
  if (receipt.email) chunks.push(concat(encode(receipt.email), new Uint8Array([LF])));

  chunks.push(
    new Uint8Array([ESC, 0x61, 0x00]),
    dashed(),
    line(columns("Receipt", receipt.receiptNumber)),
    ...wrap(`Date ${receipt.date}`).map(line),
    ...wrap(`Cashier ${receipt.cashier}`).map(line),
    dashed(),
  );

  for (const item of receipt.items) {
    const name =
      item.variantName && item.variantName !== "Portion" && !item.name.includes(item.variantName)
        ? `${item.name} ${item.variantName}`
        : item.name;
    for (const wrapped of wrap(name)) chunks.push(line(wrapped));
    chunks.push(line(columns(`  ${item.quantity} x ${item.unitPrice}`, item.lineTotal)));
  }

  chunks.push(dashed(), line(columns("Subtotal", receipt.subtotal)));
  if (receipt.showTax) chunks.push(line(columns("Tax", receipt.tax)));
  chunks.push(
    new Uint8Array([ESC, 0x45, 0x01]),
    line(columns("TOTAL", receipt.total)),
    new Uint8Array([ESC, 0x45, 0x00]),
    line(columns("Payment", receipt.payment)),
  );
  if (receipt.cashReceived) chunks.push(line(columns("Cash", receipt.cashReceived)));
  if (receipt.change) chunks.push(line(columns("Change", receipt.change)));
  chunks.push(dashed(), new Uint8Array([ESC, 0x61, 0x01]));
  chunks.push(
    new Uint8Array([ESC, 0x45, 0x01]),
    concat(encode("Powered by Cloud Sync"), new Uint8Array([LF])),
    new Uint8Array([ESC, 0x45, 0x00]),
    new Uint8Array([LF, LF, LF, LF]),
    new Uint8Array([GS, 0x56, 0x41, 0x03]),
    new Uint8Array([ESC, 0x69]),
  );

  return concat(...chunks);
}
