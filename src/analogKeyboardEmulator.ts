// アナログキーボード(AnalogSense/WebHID)を実機なしで再現するテスト用エミュレータ。
//
// AI/自動テストは実際のアナログキーボードを操作できず、WebHID の権限ダイアログも
// 突破できないため、window.analogsense をこのエミュレータで丸ごと差し替えることで
// AnalogsenseHandler.ts / calcPressure.ts / main.ts を一切変更せずに本番と同じ経路
// (startListening → CaliculatePressure → 各画面のリスナー) を通す。
//
// 使い方（devtools コンソールや自動化スクリプトから）:
//   const { emulator } = installAnalogKeyboardEmulator();
//   await emulator.pressAndRelease("A");                         // 標準的な速さで底打ち
//   await emulator.pressAndRelease("A", { targetNewton: 1.2 });  // 特定の打鍵圧を再現
// autoRampOnKeyEvents(既定 true)により、通常のキー入力（自動化ツールのキー送信を含む）
// をそのままアナログ入力として扱うこともできる。

import type { AnalogSense, Device, KeyInput } from "./analogsense.js";
import {
  ReleaseThreshold,
  stroke_mm,
  fallbackNewton,
  SpeedToNewtonSlope,
} from "./calcPressure";

interface KeyDef {
  code: string;
  name: string;
  scancode: number;
}

// analogsense.js の keys 配列(wooting 用スキャンコード)から、
// タイピングゲームの入力に使う範囲だけを抜粋している。
const KEY_TABLE: KeyDef[] = [
  { code: "Escape", name: "Escape", scancode: 0x29 },
  { code: "Backquote", name: "`", scancode: 0x35 },
  { code: "Digit1", name: "1", scancode: 0x1e },
  { code: "Digit2", name: "2", scancode: 0x1f },
  { code: "Digit3", name: "3", scancode: 0x20 },
  { code: "Digit4", name: "4", scancode: 0x21 },
  { code: "Digit5", name: "5", scancode: 0x22 },
  { code: "Digit6", name: "6", scancode: 0x23 },
  { code: "Digit7", name: "7", scancode: 0x24 },
  { code: "Digit8", name: "8", scancode: 0x25 },
  { code: "Digit9", name: "9", scancode: 0x26 },
  { code: "Digit0", name: "0", scancode: 0x27 },
  { code: "Minus", name: "-", scancode: 0x2d },
  { code: "Equal", name: "=", scancode: 0x2e },
  { code: "Backspace", name: "Backspace", scancode: 0x2a },
  { code: "Tab", name: "Tab", scancode: 0x2b },
  { code: "KeyQ", name: "Q", scancode: 0x14 },
  { code: "KeyW", name: "W", scancode: 0x1a },
  { code: "KeyE", name: "E", scancode: 0x08 },
  { code: "KeyR", name: "R", scancode: 0x15 },
  { code: "KeyT", name: "T", scancode: 0x17 },
  { code: "KeyY", name: "Y", scancode: 0x1c },
  { code: "KeyU", name: "U", scancode: 0x18 },
  { code: "KeyI", name: "I", scancode: 0x0c },
  { code: "KeyO", name: "O", scancode: 0x12 },
  { code: "KeyP", name: "P", scancode: 0x13 },
  { code: "BracketLeft", name: "[", scancode: 0x2f },
  { code: "BracketRight", name: "]", scancode: 0x30 },
  { code: "Backslash", name: "Backslash", scancode: 0x31 },
  { code: "KeyA", name: "A", scancode: 0x04 },
  { code: "KeyS", name: "S", scancode: 0x16 },
  { code: "KeyD", name: "D", scancode: 0x07 },
  { code: "KeyF", name: "F", scancode: 0x09 },
  { code: "KeyG", name: "G", scancode: 0x0a },
  { code: "KeyH", name: "H", scancode: 0x0b },
  { code: "KeyJ", name: "J", scancode: 0x0d },
  { code: "KeyK", name: "K", scancode: 0x0e },
  { code: "KeyL", name: "L", scancode: 0x0f },
  { code: "Semicolon", name: ";", scancode: 0x33 },
  { code: "Quote", name: "'", scancode: 0x34 },
  { code: "Enter", name: "Enter", scancode: 0x28 },
  { code: "KeyZ", name: "Z", scancode: 0x1d },
  { code: "KeyX", name: "X", scancode: 0x1b },
  { code: "KeyC", name: "C", scancode: 0x06 },
  { code: "KeyV", name: "V", scancode: 0x19 },
  { code: "KeyB", name: "B", scancode: 0x05 },
  { code: "KeyN", name: "N", scancode: 0x11 },
  { code: "KeyM", name: "M", scancode: 0x10 },
  { code: "Comma", name: ",", scancode: 0x36 },
  { code: "Period", name: ".", scancode: 0x37 },
  { code: "Slash", name: "/", scancode: 0x38 },
  { code: "Space", name: "Space", scancode: 0x2c },
];

const scancodeToName = new Map(KEY_TABLE.map((k) => [k.scancode, k.name]));
const codeToKeyDef = new Map(KEY_TABLE.map((k) => [k.code, k]));
const nameToKeyDef = new Map(KEY_TABLE.map((k) => [k.name, k]));

// ReleaseThreshold(0.2) より大きい、作動点通過とみなす値。
const ACTIVATION_VALUE = ReleaseThreshold + 0.05;
// 目標打鍵圧が指定されなかった場合に使う標準的な作動点〜底打ちの所要時間。
const DEFAULT_RAMP_MS = 35;

/**
 * 目標の打鍵圧(Newton相当値)を再現するために必要な、作動点通過から底打ちまでの
 * 所要時間(ms)を calcPressure.ts の変換式の逆算で求める。
 * fallbackNewton 以下は速度モデル上表現できない(v<=0 になる)ため呼び出し側で弾くこと。
 */
function newtonToRampMs(targetNewton: number, startValue: number = ACTIVATION_VALUE): number {
  const v = (targetNewton - fallbackNewton) / SpeedToNewtonSlope; // m/s (= mm/ms)
  const distanceMm = stroke_mm - startValue * stroke_mm;
  return distanceMm / v;
}

class EmulatedDevice implements Device {
  dev = {} as unknown as Device["dev"];
  forgotten = false;
  private handler: ((inputs: KeyInput[]) => void) | null = null;

  startListening(handler: (inputs: KeyInput[]) => void): void {
    this.handler = handler;
  }

  stopListening(): void {
    this.handler = null;
  }

  getProductName(): string {
    return "Analog Keyboard Emulator (test double)";
  }

  forget(): void {
    this.forgotten = true;
    this.stopListening();
  }

  /** テスト/エミュレータから生の {scancode, value} を流し込む */
  feed(scancode: number, value: number): void {
    this.handler?.([{ scancode, value }]);
  }
}

function createAnalogSenseEmulator(device: EmulatedDevice): AnalogSense {
  return {
    async getDevices() {
      return device.forgotten ? [] : [device];
    },
    async requestDevice() {
      device.forgotten = false;
      return device;
    },
    scancodeToString(scancode: number): string {
      return scancodeToName.get(scancode) ?? String(scancode);
    },
    findProviderForDevice() {
      // 実 HID の接続監視(startAnalogDeviceMonitor)はエミュレータでは使わない。
      return undefined;
    },
  };
}

interface PressOptions {
  /**
   * 目標の打鍵圧(Newton相当値)。省略時は標準的な速さ(DEFAULT_RAMP_MS)で底打ちする。
   * fallbackNewton(既定 0.81)以下を指定した場合は、作動点通過を取り逃した
   * 高速打鍵として扱い、fallbackNewton 固定で即座に底打ちさせる。
   */
  targetNewton?: number;
}

class AnalogKeyboardEmulator {
  readonly device = new EmulatedDevice();
  private timers = new Map<string, ReturnType<typeof setTimeout>[]>();

  private clearTimers(name: string): void {
    for (const t of this.timers.get(name) ?? []) clearTimeout(t);
    this.timers.delete(name);
  }

  private schedule(name: string, ms: number, fn: () => void): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        fn();
        resolve();
      }, ms);
      const arr = this.timers.get(name) ?? [];
      arr.push(t);
      this.timers.set(name, arr);
    });
  }

  private resolveKey(name: string): KeyDef {
    const key = nameToKeyDef.get(name);
    if (!key) throw new Error(`analogKeyboardEmulator: 未対応のキーです: ${name}`);
    return key;
  }

  /** キーを押し込み、底打ちさせる。底打ち完了で resolve する。 */
  press(name: string, options: PressOptions = {}): Promise<void> {
    const key = this.resolveKey(name);
    this.clearTimers(name);
    const { targetNewton } = options;
    if (targetNewton !== undefined && targetNewton <= fallbackNewton) {
      this.device.feed(key.scancode, 1);
      return Promise.resolve();
    }
    this.device.feed(key.scancode, ACTIVATION_VALUE);
    const rampMs = targetNewton !== undefined ? newtonToRampMs(targetNewton) : DEFAULT_RAMP_MS;
    return this.schedule(name, Math.max(1, rampMs), () => {
      this.device.feed(key.scancode, 1);
    });
  }

  /** キーを戻す(離す)。 */
  release(name: string): Promise<void> {
    const key = this.resolveKey(name);
    this.clearTimers(name);
    this.device.feed(key.scancode, 0);
    return Promise.resolve();
  }

  /** 指定時間(既定 20ms)押し込んでから離す。 */
  async pressAndRelease(name: string, options: PressOptions & { holdMs?: number } = {}): Promise<void> {
    await this.press(name, options);
    await new Promise((resolve) => setTimeout(resolve, options.holdMs ?? 20));
    await this.release(name);
  }
}

interface InstallOptions {
  /** 通常のキーボードイベント(keydown/keyup)を自動でアナログ入力に変換するか(既定 true) */
  autoRampOnKeyEvents?: boolean;
  /** 自動変換時に再現する打鍵圧(Newton相当値)。省略時は標準的な速さ。 */
  autoRampNewton?: number;
  /** keydown/keyup を購読する対象(既定 window) */
  target?: EventTarget;
}

interface InstalledEmulator {
  emulator: AnalogKeyboardEmulator;
  uninstall: () => void;
}

/**
 * window.analogsense をエミュレータに差し替え、テスト/自動化から
 * アナログキーボードの打鍵圧をシミュレートできるようにする。
 * 本番コードからは呼ばれない。devtools コンソールや自動化スクリプトから明示的に呼ぶこと。
 */
function installAnalogKeyboardEmulator(options: InstallOptions = {}): InstalledEmulator {
  const emulator = new AnalogKeyboardEmulator();
  const previousAnalogsense = window.analogsense;
  window.analogsense = createAnalogSenseEmulator(emulator.device);

  const autoRamp = options.autoRampOnKeyEvents ?? true;
  const target = options.target ?? window;
  const heldCodes = new Set<string>();

  const onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke.repeat || heldCodes.has(ke.code)) return;
    const key = codeToKeyDef.get(ke.code);
    if (!key) return;
    heldCodes.add(ke.code);
    void emulator.press(key.name, { targetNewton: options.autoRampNewton });
  };
  const onKeyUp = (e: Event): void => {
    const ke = e as KeyboardEvent;
    const key = codeToKeyDef.get(ke.code);
    if (!key) return;
    heldCodes.delete(ke.code);
    void emulator.release(key.name);
  };

  if (autoRamp) {
    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
  }

  (window as unknown as { __analogKeyboardEmulator: AnalogKeyboardEmulator }).__analogKeyboardEmulator = emulator;

  return {
    emulator,
    uninstall(): void {
      window.analogsense = previousAnalogsense;
      if (autoRamp) {
        target.removeEventListener("keydown", onKeyDown);
        target.removeEventListener("keyup", onKeyUp);
      }
      delete (window as unknown as { __analogKeyboardEmulator?: AnalogKeyboardEmulator }).__analogKeyboardEmulator;
    },
  };
}

export {
  AnalogKeyboardEmulator,
  EmulatedDevice,
  KEY_TABLE,
  createAnalogSenseEmulator,
  installAnalogKeyboardEmulator,
};
export type { PressOptions, InstallOptions, InstalledEmulator };
