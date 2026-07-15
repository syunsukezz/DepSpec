import "./analogsense.js";
import "./style.css";
import { type AnalogSenseInput, RequestDeviceIfNeeded, SetAnalogsenseCallback } from "./AnalogsenseHandler";
import { CaliculatePressure, SetPressureCallback } from "./calcPressure";
import { showStartScreen } from "./startScreen";
import { showGameScreen, type GameResult } from "./gameScreen";
import { showResultScreen } from "./resultScreen";

const app = document.getElementById("app") as HTMLDivElement;
if (!app) throw new Error("App element not found");

// ── リスナー管理 ─────────────────────────────────────────────────────────
type KeyListener = (code: string, value: number) => void;
let pressureListener: KeyListener | null = null;
let rawListener: KeyListener | null = null;

function callIfSet(fn: KeyListener | null, code: string, value: number): void {
    if (fn !== null) fn(code, value);
}

SetAnalogsenseCallback((inputs: AnalogSenseInput[]) => {
    inputs.forEach(input => {
        CaliculatePressure(input.key, input.value);
        callIfSet(rawListener, input.key, input.value);
    });
});

SetPressureCallback((code: string, value: number) => {
    callIfSet(pressureListener, code, value);
});

// ── 画面遷移 ─────────────────────────────────────────────────────────────
function goToStart(): void {
    showStartScreen(
        app,
        (btn) => { RequestDeviceIfNeeded(btn); },
        goToGame,
    );
}

function goToGame(): void {
    showGameScreen(app, {
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        setRawListener: (cb) => { rawListener = cb; },
        clearRawListener: () => { rawListener = null; },
        onFinish: (result: GameResult) => goToResult(result),
    });
}

function goToResult(result: GameResult): void {
    showResultScreen(app, result, goToStart);
}

// ── エントリーポイント ────────────────────────────────────────────────────
goToStart();
