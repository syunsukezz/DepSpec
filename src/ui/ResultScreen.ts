/**
 * ResultScreen.ts
 * リザルト画面の Canvas 2D オーバーレイ。
 *
 * ── 画面構成 ──
 *
 *   ┌──────────────────────────────────────────┐
 *   │                                          │
 *   │          STAGE  CLEAR !                  │  ← 金色タイトル
 *   │                                          │
 *   │       SCORE    012345                    │
 *   │       TIME     02:34                     │
 *   │                                          │
 *   │      PRESS SPACE TO RETRY  ← 点滅        │
 *   │                                          │
 *   └──────────────────────────────────────────┘
 *
 * ── 使い方 ──
 *   1. コンストラクタで canvas 生成
 *   2. element を DOM に追加（z-index:2 で HUD の上に重なる）
 *   3. ゲームクリア時に show(score, elapsedSec) を呼ぶ
 *   4. 毎フレーム render(dt) を呼ぶ
 *   5. リトライ時に hide() を呼ぶ
 */

export class ResultScreen {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  /** 点滅・入場アニメーション用カウンタ (秒) */
  private timer: number = 0;

  /** 表示するスコア */
  private score: number = 0;

  /** 表示するクリアタイム (秒) */
  private elapsedSec: number = 0;

  /**
   * @param w - 初期キャンバス幅
   * @param h - 初期キャンバス高さ
   */
  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width  = w;
    this.canvas.height = h;
    this.canvas.style.cssText =
      'position:absolute; top:0; left:0; pointer-events:none; z-index:2; display:none;';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** DOM に追加するための canvas 要素 */
  get element(): HTMLCanvasElement { return this.canvas; }

  /**
   * リザルト画面を表示する（ゲームクリア時に呼ぶ）。
   * @param score      - 最終スコア
   * @param elapsedSec - クリアタイム（秒）
   */
  show(score: number, elapsedSec: number): void {
    this.score      = score;
    this.elapsedSec = elapsedSec;
    this.timer      = 0;
    this.canvas.style.display = 'block';
  }

  /** 非表示にする（リトライ時に呼ぶ） */
  hide(): void {
    this.canvas.style.display = 'none';
  }

  /** リサイズ対応 */
  resize(w: number, h: number): void {
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  /**
   * リザルト画面を描画する。毎フレーム呼ぶこと。
   * @param dt - 経過時間（アニメーションに使う）
   */
  render(dt: number): void {
    this.timer += dt;

    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // ── 背景 ──
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(5, 8, 25, 0.94)');
    grad.addColorStop(1, 'rgba(15, 10, 35, 0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // ── 入場アニメーション: 最初の 0.5 秒で Y がスライドイン ──
    const slideIn = Math.min(1, this.timer / 0.5); // 0→1

    // ── STAGE CLEAR! ──
    const titleY = h * 0.28 - (1 - slideIn) * h * 0.08;
    ctx.font        = `bold ${Math.round(h * 0.095)}px Audiowide, monospace`;
    ctx.fillStyle   = '#FFE84D';
    ctx.shadowColor = 'rgba(255, 220, 50, 0.5)';
    ctx.shadowBlur  = 28;
    ctx.globalAlpha = slideIn;
    ctx.fillText('STAGE  CLEAR !', w / 2, titleY);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1.0;

    // ── スコア / タイム（0.3 秒後にフェードイン）──
    const statsAlpha = Math.max(0, Math.min(1, (this.timer - 0.3) / 0.4));
    ctx.globalAlpha  = statsAlpha;

    // ── レイアウト: ラベル（小）を上、値（大）を下に並べた2列 ──
    //   左列: SCORE / 値   右列: TIME / 値
    const colL = w / 2 - w * 0.18;
    const colR = w / 2 + w * 0.18;

    const labelFont = `${Math.round(h * 0.026)}px Audiowide, monospace`;
    const valueFont = `bold ${Math.round(h * 0.052)}px Audiowide, monospace`;

    // スコア（左列）
    const scoreStr = String(this.score).padStart(6, '0');
    ctx.font      = labelFont;
    ctx.fillStyle = '#AAAACC';
    ctx.fillText('SCORE', colL, h * 0.48);
    ctx.font      = valueFont;
    ctx.fillStyle = '#4FC3F7';
    ctx.fillText(scoreStr, colL, h * 0.57);

    // タイム（右列）
    const mm      = Math.floor(this.elapsedSec / 60);
    const ss      = Math.floor(this.elapsedSec % 60);
    const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    ctx.font      = labelFont;
    ctx.fillStyle = '#AAAACC';
    ctx.fillText('TIME', colR, h * 0.48);
    ctx.font      = valueFont;
    ctx.fillStyle = '#81C784';
    ctx.fillText(timeStr, colR, h * 0.57);

    ctx.globalAlpha = 1.0;

    // ── PRESS SPACE TO RETRY (点滅, 0.8 秒後から表示) ──
    if (this.timer > 0.8) {
      const blink     = 0.55 + 0.45 * Math.sin((this.timer - 0.8) * 2.8);
      ctx.globalAlpha = blink;
      ctx.font        = `bold ${Math.round(h * 0.028)}px Audiowide, monospace`;
      ctx.fillStyle   = '#AAAACC';
      ctx.fillText('PRESS  SPACE  TO  RETRY', w / 2, h * 0.80);
      ctx.globalAlpha = 1.0;
    }
  }
}
