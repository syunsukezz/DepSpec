import "./analogsense.js";
import "./style.css";
import { type AnalogSenseInput, connectAnalogDevice, hasAuthorizedDevice, SetAnalogsenseCallback } from "./AnalogsenseHandler";
import { CaliculatePressure, SetPressureCallback } from "./calcPressure.ts";
import { showStartScreen } from "./startScreen";
import { showTutorialScreen } from "./tutorialScreen";
import { showGameScreen, type GameResult, type GameMode } from "./gameScreen";
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
    showStartScreen(app, {
        connectAnalog: connectAnalogDevice,
        hasAuthorizedDevice,
        onStart: goToTutorial,
    });
}

function goToTutorial(mode: GameMode): void {
    showTutorialScreen(app, {
        mode,
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        onComplete: () => goToGame(mode),
        onSkip: () => goToGame(mode),
    });
}

function goToGame(mode: GameMode): void {
    showGameScreen(app, {
        mode,
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
