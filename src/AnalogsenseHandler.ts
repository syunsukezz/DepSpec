import "./analogsense.js";

interface AnalogSenseInput {
    key: string;
    value: number;
    timestamp: number;
}

let AnalogsenseCallback: (inputs: AnalogSenseInput[]) => void = () => {};

function SetAnalogsenseCallback(callback: (inputs: AnalogSenseInput[]) => void) {
    AnalogsenseCallback = callback;
}

// device.startListening に渡す共通ハンドラ
function startListening(device: any): void {
    device.startListening((inputs: any[]) => {
        const mapped = inputs.map(input => ({
            key: window.analogsense.scancodeToString(input.scancode),
            value: input.value < 0.1 ? 0 : input.value,
            timestamp: performance.now(),
        }));
        AnalogsenseCallback(mapped);
    });
}

/** 既に許可済みのアナログデバイスがあるか（ユーザー操作なしで確認できる） */
async function hasAuthorizedDevice(): Promise<boolean> {
    if (!window.analogsense) return false;
    try {
        const devices = await window.analogsense.getDevices();
        return devices.length > 0;
    } catch {
        return false;
    }
}

/**
 * アナログキーボードに接続してリッスンを開始する。
 * 未許可なら requestDevice でダイアログを出す（ユーザー操作＝クリック内から呼ぶこと）。
 * @returns 接続できたら true
 */
let listening = false;

async function connectAnalogDevice(): Promise<boolean> {
    if (!window.analogsense) return false;
    // 既にリッスン中なら二重に startListening しない（冪等）
    if (listening) return true;
    try {
        const devices = await window.analogsense.getDevices();
        let device: any = devices[0];
        if (!device) {
            device = await window.analogsense.requestDevice();
        }
        if (!device) return false;
        console.log(`Device connected: ${device.getProductName()}`);
        startListening(device);
        listening = true;
        return true;
    } catch (e) {
        console.error("Failed to connect analog device:", e);
        return false;
    }
}

/**
 * アナログキーボードの接続を監視する。
 * WebHID の connect イベントを購読し、対応済みのアナログキーボードが
 * （物理的に挿された等で）接続されたときに onConnect を呼ぶ。
 * connect イベントは「このサイトが既に許可済みのデバイス」に対してのみ発火する。
 * @returns 監視を止める関数
 */
function startAnalogDeviceMonitor(onConnect: (device: any) => void): () => void {
    const hid = (navigator as any).hid;
    if (!hid) return () => {};
    // 1台のキーボードでも HID インターフェイスごとに connect が複数飛ぶので、
    // 短時間の連続発火はまとめて 1 回だけ通知する（波紋の多重再生を防ぐ）
    let lastFired = 0;
    const handler = (e: any) => {
        // アナログキーボードとして対応しているデバイスだけに反応する
        const provider = window.analogsense?.findProviderForDevice(e.device);
        if (!provider) return;
        const now = performance.now();
        if (now - lastFired < 500) return;
        lastFired = now;
        onConnect(e.device);
    };
    hid.addEventListener("connect", handler);
    return () => hid.removeEventListener("connect", handler);
}

export {
    connectAnalogDevice,
    hasAuthorizedDevice,
    startAnalogDeviceMonitor,
    SetAnalogsenseCallback,
    type AnalogSenseInput,
};
