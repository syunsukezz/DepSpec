/**
 * InputManager.ts
 * アナログキーボードの打鍵圧をゲームに渡すモジュール。
 *
 * ── データフロー ──
 *
 *   [AnalogSense デバイス（WebHID）]
 *         │ HID レポート（~1000Hz）
 *         ↓
 *   [AnalogsenseHandler]
 *     inputs: KeyInput[] を "A:0.75" 形式の文字列配列に変換
 *         │ string[]（"キー名:アナログ値0〜1"）
 *         ↓
 *   [CaliculatePressure]（calcPressure.ts）
 *     アナログ値の変化から打鍵を検出し、力学計算でニュートン値を算出。
 *     2 通りの発火タイミング:
 *       ① value == 1（底打ち）→ F = mv²/2d + endNewton [N]
 *       ② value が戻り始めた → (1-value)*startN + value*endN [N]
 *         │ PressureCallback(code: string, newtons: number)
 *         ↓
 *   [InputManager.normalizeNewtons]
 *     ニュートン値を 0.0〜1.0 に正規化
 *         │ KeyPressEvent { key, pressure, rawNewtons }
 *         ↓
 *   [ゲーム側コールバック（onKeyPress で登録）]
 *     Player.jump / IArea.onKeyPress など
 */

import { RequestDeviceIfNeeded, SetAnalogsenseCallback } from '../AnalogsenseHandler.ts';
import { CaliculatePressure, SetPressureCallback }       from '../calcPressure.ts';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/**
 * ゲーム側に渡す打鍵イベント。
 * CaliculatePressure が発火するたびに生成される。
 */
export interface KeyPressEvent {
  /** キー名（AnalogSense の scancodeToString が返す文字列）
   *  例: "A", "Space", "Enter", "K" など */
  key: string;

  /** 正規化された打鍵圧（0.0〜1.0）
   *  MIN_NEWTONS 以下 → 0.0、MAX_NEWTONS 以上 → 1.0 */
  pressure: number;

  /** 生のニュートン値（デバッグ・チューニング用）
   *  CaliculatePressure が算出した実際の力 [N] */
  rawNewtons: number;
}

// ──────────────────────────────────────────
// 正規化の基準値（キーボードや好みに合わせてチューニング）
// ──────────────────────────────────────────

/**
 * この値以下のニュートン値を 0.0（最弱）とする。
 * calcPressure.ts の startNewton(0.4N) がちょうど下限になるよう設定。
 */
const MIN_NEWTONS = 0.4;

/**
 * この値以上のニュートン値を 1.0（最強）とする。
 * 速い底打ち（~5ms）で約 1.2〜1.5N になるため上限を 1.5N に設定。
 * ユーザーが強打すると 1.0 になる設計。
 */
const MAX_NEWTONS = 3.0;

// ──────────────────────────────────────────
// InputManager クラス
// ──────────────────────────────────────────

export class InputManager {
  /** 登録されたコールバックのリスト */
  private callbacks: ((e: KeyPressEvent) => void)[];

  /**
   * @param connectButton - デバイス接続に使う HTMLButtonElement。
   *   WebHID はユーザー操作（クリック）がないと requestDevice できないため必要。
   *   既に接続済みのデバイスがある場合はボタンなしで自動接続する。
   */
  constructor(connectButton: HTMLButtonElement) {
    this.callbacks = [];

    // ── Step 1: PressureCallback を先に登録 ──
    // CaliculatePressure が発火したときに呼ばれる
    SetPressureCallback((code: string, newtons: number) => {
      this.handlePressure(code, newtons);
    });

    // ── Step 2: AnalogsenseCallback を登録 ──
    // AnalogsenseHandler から "キー名:値" 形式の文字列配列が届く
    SetAnalogsenseCallback((inputs: string[]) => {
      this.handleAnalogInputs(inputs);
    });

    // ── Step 3: デバイス接続（既接続なら自動、未接続ならボタン待ち）──
    RequestDeviceIfNeeded(connectButton);
  }

  // ──────────────────────────────────────────
  // 内部処理
  // ──────────────────────────────────────────

  /**
   * AnalogsenseHandler から受け取った文字列配列をパースし、
   * CaliculatePressure に渡す。
   *
   * 入力形式: ["A:0.75", "Space:0.30", ...]
   *   キー名  : コロン左側
   *   アナログ値: コロン右側（0.0〜1.0、閾値未満は 0 に丸め済み）
   *
   * @param inputs - "キー名:アナログ値" の文字列配列
   */
  private handleAnalogInputs(inputs: string[]): void {
    for (const input of inputs) {
      // "A:0.75" → code="A", value=0.75
      const colonIdx = input.lastIndexOf(':');
      if (colonIdx === -1) continue; // 不正な形式はスキップ

      const code  = input.slice(0, colonIdx);
      const value = parseFloat(input.slice(colonIdx + 1));

      if (isNaN(value)) continue; // 数値変換失敗はスキップ

      // CaliculatePressure に渡す
      // → キーが底打ちまたは戻り始めたとき PressureCallback が発火する
      CaliculatePressure(code, value);
    }
  }

  /**
   * CaliculatePressure からニュートン値を受け取り、
   * 0.0〜1.0 に正規化して KeyPressEvent を発火する。
   *
   * ── 正規化の計算 ──
   *   pressure = clamp((newtons - MIN) / (MAX - MIN), 0, 1)
   *
   *   例:
   *     0.4N（ゆっくり半押し）→ 0.0
   *     0.95N（普通の打鍵）   → 約 0.5
   *     1.5N（強い底打ち）    → 1.0
   *
   * @param code    - キー名（"A", "Space" など）
   * @param newtons - CaliculatePressure が算出した力 [N]
   */
  private handlePressure(code: string, newtons: number): void {
    // MIN〜MAX の範囲を 0〜1 に線形マッピング
    const normalized = (newtons - MIN_NEWTONS) / (MAX_NEWTONS - MIN_NEWTONS);


    // 0.0〜1.0 にクランプ（範囲外の値を丸める）
    //const pressure = Math.max(0.0, Math.min(1.0, normalized));
    // 人の感覚に合わせるため，ヴェーバー・フェヒナーの法則を適用する
    const pressure = Math.log10(1 + 9 * normalized);

    const event: KeyPressEvent = {
      key:       code,
      pressure,
      rawNewtons: newtons,
    };

    // 登録されたコールバックを全て呼ぶ
    for (const cb of this.callbacks) {
      cb(event);
    }
  }

  // ──────────────────────────────────────────
  // 公開 API
  // ──────────────────────────────────────────

  /**
   * 打鍵イベントのコールバックを登録する。
   * 複数回呼ぶと複数のコールバックが登録される（全て発火する）。
   *
   * 使用例:
   *   inputManager.onKeyPress((e) => {
   *     console.log(e.key, e.pressure); // "A", 0.72
   *   });
   *
   * @param callback - キーが押されたときに呼ばれる関数
   */
  onKeyPress(callback: (e: KeyPressEvent) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * 登録済みの全コールバックを解除する。
   * ゲーム終了やシーン遷移時に呼ぶ。
   */
  dispose(): void {
    this.callbacks = [];
  }
}
