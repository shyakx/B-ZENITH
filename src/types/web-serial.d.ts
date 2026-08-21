interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  getPorts(): Promise<SerialPort[]>;
  requestPort(): Promise<SerialPort>;
}

interface USBDevice {
  readonly configuration: { interfaces: USBInterface[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<unknown>;
}

interface USBInterface {
  interfaceNumber: number;
  claimed: boolean;
  alternate: {
    endpoints: Array<{ direction: string; endpointNumber: number }>;
  };
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: { filters: Array<{ vendorId?: number; classCode?: number }> }): Promise<USBDevice>;
}

interface Navigator {
  serial?: Serial;
  usb?: USB;
}
