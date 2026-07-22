import "./analogsense.js";

interface AnalogSenseInput {
    key: string;
    value: number;
    timestamp: number;
}

let AnalogsenseCallback: (inputs: AnalogSenseInput[]) => void = (inputs: AnalogSenseInput[]) => {
    console.log("Received inputs:", inputs);
};

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
async function connectAnalogDevice(): Promise<boolean> {
    if (!window.analogsense) return false;
    try {
        const devices = await window.analogsense.getDevices();
        let device: any = devices[0];
        if (!device) {
            device = await window.analogsense.requestDevice();
        }
        if (!device) return false;
        console.log(`Device connected: ${device.getProductName()}`);
        startListening(device);
        return true;
    } catch (e) {
        console.error("Failed to connect analog device:", e);
        return false;
    }
}

export {
    connectAnalogDevice,
    hasAuthorizedDevice,
    SetAnalogsenseCallback,
    type AnalogSenseInput,
};
