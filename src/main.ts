import "./analogsense.js";
import "./style.css";
import { type AnalogSenseInput, connectAnalogDevice, hasAuthorizedDevice, startAnalogDeviceMonitor, SetAnalogsenseCallback } from "./AnalogsenseHandler";
import { playEdgeRipple } from "./rippleEffect";
import { checkerboardTransition } from "./transition";
import { CaliculatePressure, SetPressureCallback } from "./calcPressure.ts";
import { showStartScreen } from "./startScreen";
import { showTutorialScreen } from "./tutorialScreen";
import { showLevelSelectScreen } from "./levelSelectScreen";
import { showGameScreen, type GameResult, type GameMode } from "./gameScreen";
import { showResultScreen } from "./resultScreen";
import { playMainBgm, playTutorialBgm, playResultSEThenBgm, armAutoplayUnlock } from "./bgm";
import type { Level } from "./sentences";
import type { NameChar } from "./playerName";

const app = document.getElementById("app") as HTMLDivElement;
if (!app) throw new Error("App element not found");

// 右クリック・メニューキーによるブラウザのネイティブコンテキストメニューを
// 全画面共通で抑制する（誤操作でメニューキーを押しても画面が乱れないように）
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ── リスナー管理 ─────────────────────────────────────────────────────────
type KeyListener = (code: string, value: number) => void;
let pressureListener: KeyListener | null = null;
let rawListener: KeyListener | null = null;

function callIfSet(fn: KeyListener | null, code: string, value: number): void {
    if (fn !== null) fn(code, value);
}

SetAnalogsenseCallback((inputs: AnalogSenseInput[]) => {
    const shiftPressed = inputs.some(input => input.key === "Shift"&& input.value > 0.5);
    inputs.forEach(input => {
        CaliculatePressure(input.key, input.value, shiftPressed);
        callIfSet(rawListener, input.key, input.value);
    });
});

SetPressureCallback((code: string, value: number) => {
    callIfSet(pressureListener, code, value);
});

// ── 画面遷移 ─────────────────────────────────────────────────────────────
// 各画面の描画本体（render*）と、市松模様ワイプを挟む遷移（goTo*）を分ける。
// 初回だけワイプ無しで直接描画し、以降の画面切り替えは checkerboardTransition を通す。
function renderStart(): void {
    playMainBgm();
    showStartScreen(app, {
        connectAnalog: connectAnalogDevice,
        hasAuthorizedDevice,
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        setRawListener: (cb) => { rawListener = cb; },
        clearRawListener: () => { rawListener = null; },
        onStart: goToTutorial,
    });
}
function goToStart(): void { checkerboardTransition(renderStart); }

function renderTutorial(mode: GameMode, name: NameChar[]): void {
    playTutorialBgm();
    showTutorialScreen(app, {
        mode,
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        setRawListener: (cb) => { rawListener = cb; },
        clearRawListener: () => { rawListener = null; },
        onComplete: () => goToLevelSelect(mode, name),
        onSkip: () => goToLevelSelect(mode, name),
    });
}
function goToTutorial(mode: GameMode, name: NameChar[]): void { checkerboardTransition(() => renderTutorial(mode, name)); }

function renderLevelSelect(mode: GameMode, name: NameChar[]): void {
    playTutorialBgm();
    showLevelSelectScreen(app, {
        mode,
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        setRawListener: (cb) => { rawListener = cb; },
        clearRawListener: () => { rawListener = null; },
        onSelect: (level: Level) => goToGame(mode, name, level),
        onBack: goToStart,
    });
}
function goToLevelSelect(mode: GameMode, name: NameChar[]): void { checkerboardTransition(() => renderLevelSelect(mode, name)); }

function renderGame(mode: GameMode, name: NameChar[], level: Level): void {
    playMainBgm(); // タイトルから続くメインBGMをそのまま継続
    showGameScreen(app, {
        mode,
        level,
        name,
        setPressureListener: (cb) => { pressureListener = cb; },
        clearPressureListener: () => { pressureListener = null; },
        setRawListener: (cb) => { rawListener = cb; },
        clearRawListener: () => { rawListener = null; },
        onFinish: (result: GameResult) => goToResult(result),
    });
}
function goToGame(mode: GameMode, name: NameChar[], level: Level): void { checkerboardTransition(() => renderGame(mode, name, level)); }

function renderResult(result: GameResult): void {
    playResultSEThenBgm(); // 効果音 → 鳴り終わってからメインBGM
    showResultScreen(app, result, goToStart);
}
function goToResult(result: GameResult): void { checkerboardTransition(() => renderResult(result)); }

// ── デバイス監視: アナログキーボードが接続されたら四方から波紋 ──────────────
startAnalogDeviceMonitor(() => {
    playEdgeRipple();
});

// ── エントリーポイント ────────────────────────────────────────────────────
// 初回はワイプ無しで直接描画（以降の画面切り替えは goTo* がワイプを挟む）
armAutoplayUnlock(); // 自動再生がブロックされても最初の操作でBGMを再生
renderStart();

// ── テスト用: アナログキーボードエミュレータ(開発ビルドのみ) ──────────────
// 実機のアナログキーボードやWebHIDの許可ダイアログを使わずに打鍵圧をテストできる
// よう、devtools コンソールや自動化スクリプトから `installAnalogKeyboardEmulator()`
// を呼べるようにする。本番ビルドには含まれない。
if (import.meta.env.DEV) {
    import("./analogKeyboardEmulator").then(({ installAnalogKeyboardEmulator }) => {
        (window as unknown as { installAnalogKeyboardEmulator: typeof installAnalogKeyboardEmulator }).installAnalogKeyboardEmulator = installAnalogKeyboardEmulator;
    });
}
