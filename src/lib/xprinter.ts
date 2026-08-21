const BAUD_KEY = "bzenith-xprinter-baud";
const DEFAULT_BAUD = 9600;

let openPort: SerialPort | null = null;
let openUsb: USBDevice | null = null;

const USB_FILTERS = [
  { classCode: 7 },
  { vendorId: 0x0483 },
  { vendorId: 0x1a86 },
  { vendorId: 0x0403 },
  { vendorId: 0x067b },
  { vendorId: 0x0416 },
  { vendorId: 0x28e9 },
  { vendorId: 0x1fc9 },
  { vendorId: 0x6868 },
  { vendorId: 0x4b43 },
  { vendorId: 0x0fe6 },
  { vendorId: 0x0519 },
  { vendorId: 0x20d1 },
  { vendorId: 0x0dd4 },
];

async function writeSerial(port: SerialPort, data: Uint8Array) {
  const baudRate = Number(window.localStorage.getItem(BAUD_KEY) || DEFAULT_BAUD);
  if (!port.writable) {
    await port.open({ baudRate: Number.isFinite(baudRate) && baudRate > 0 ? baudRate : DEFAULT_BAUD });
  }
  const writer = port.writable?.getWriter();
  if (!writer) throw new Error("Xprinter serial port is not writable.");
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
  openPort = port;
}

async function writeUsb(device: USBDevice, data: Uint8Array) {
  if (!device.configuration) {
    await device.open();
    await device.selectConfiguration(1);
  }
  const iface = device.configuration?.interfaces.find((item) =>
    item.alternate.endpoints.some((endpoint) => endpoint.direction === "out"),
  );
  if (!iface) throw new Error("No USB output endpoint was found on the printer.");
  if (!iface.claimed) await device.claimInterface(iface.interfaceNumber);
  const endpoint = iface.alternate.endpoints.find((item) => item.direction === "out");
  if (!endpoint) throw new Error("No USB output endpoint was found on the printer.");
  await device.transferOut(endpoint.endpointNumber, data);
  openUsb = device;
}

export async function printOnXprinter(data: Uint8Array, promptIfNeeded: boolean) {
  if (openPort) {
    await writeSerial(openPort, data);
    return "serial";
  }

  if (navigator.serial) {
    const remembered = await navigator.serial.getPorts();
    const port = remembered[0] ?? (promptIfNeeded ? await navigator.serial.requestPort() : null);
    if (port) {
      await writeSerial(port, data);
      return "serial";
    }
  }

  if (openUsb) {
    await writeUsb(openUsb, data);
    return "usb";
  }

  if (navigator.usb) {
    const remembered = await navigator.usb.getDevices();
    const device =
      remembered[0] ?? (promptIfNeeded ? await navigator.usb.requestDevice({ filters: USB_FILTERS }) : null);
    if (device) {
      await writeUsb(device, data);
      return "usb";
    }
  }

  throw new Error("No Xprinter is connected yet.");
}

export function printerErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "NotAllowedError")) {
    return "Printer selection was cancelled.";
  }
  const message = error instanceof Error ? error.message : "Unable to print.";
  if (message.toLowerCase().includes("no xprinter")) {
    return "Choose the Xprinter Mini in the browser list. If it is missing, pair it in Windows first, then try again.";
  }
  if (message.includes("Access denied") || message.includes("claimed")) {
    return "Windows is holding the printer. Close other print apps, or use Browser print and select the Xprinter.";
  }
  return message;
}
