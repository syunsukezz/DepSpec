export interface KeyInput {
  scancode: number;
  value: number;
}

export interface Device {
  startListening(handler: (inputs: KeyInput[]) => void): void;
  stopListening(): void;
  getProductName(): string;
  forget(): void;
  dev: HIDDevice;
}

export interface AnalogSense {
  getDevices(): Promise<Device[]>;
  requestDevice(): Promise<Device | undefined>;
  scancodeToString(scancode: number): string;
}

declare global {
  interface Window {
    analogsense: AnalogSense;
  }
}

export interface keys {
  name: string;
  wooting: number;
  razer: number;
};
export const keys: keys[];


export {};