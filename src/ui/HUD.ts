/**
 * HUD.ts
 * スコア・タイマー・打鍵文字・打鍵圧バーを描画するヘッドアップディスプレイ。
 *
 * ── 実装方式: Canvas 2D オーバーレイ ──
 *   WebGL の描画（ゲーム画面）は `Renderer` が管理する HTMLCanvasElement で行われる。
 *   HUD は別の HTMLCanvasElement（2D コンテキスト）を WebGL キャンバスの上に重ねることで、
 *   Canvas 2D の豊富なテキスト・図形 API を使いながら WebGL 描画を邪魔しない。
 *
 *   z-index:   WebGL canvas (z=0) < HUD canvas (z=1)
 *   両 canvas: position:absolute で同じ位置に重ねる
 *   HUD canvas: pointer-events:none で入力を透過させる
 *
 * ── 画面レイアウト ──
 *
 *   ┌──────────────────────────────────────────┐
 *   │ ⏱ 01:23                   SCORE: 001200 │  ← 上部バー
 *   │                                          │
 *   │              (WebGL ゲーム画面)           │
 *   │                                          │
 *   │         ┌────────────────────────┐       │
 *   │         │  にほ んご             │       │  ← 打鍵パネル
 *   │         │       → ngo           │       │  ← 次キー（黄）
 *   │         └────────────────────────┘       │
 *   │  ██████████████░░░░░░░░  0.72           │  ← 打鍵圧バー
 *   └──────────────────────────────────────────┘
 *
 * ── 打鍵圧バーのフェードアウト ──
 *   notifyKeyPress(pressure) を呼ぶと pressureDisplay にセットされ、
 *   render(state, dt) を毎フレーム呼ぶと指数減衰でフェードアウトする。
 *   これにより「打った瞬間はピーク、徐々に消える」視覚効果が得られる。
 */

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/**
 * render() に渡すゲーム状態のスナップショット。
 * 毎フレーム Game/Stage から最新の値を渡す。
 */
export interface HUDState {
  /** 現在のスコア（整数） */
  score: number;

  /** ゲーム開始からの経過時間（秒） */
  elapsedSec: number;

  /** 打ち終わったひらがな（keygraph.seq_done()） */
  seqDone: string;

  /** 残りひらがな（keygraph.seq_candidates()） */
  seqCandidates: string;

  /**
   * 次に打つキーを含む残りローマ字列（keygraph.key_candidate()）。
   * 例: "ngo" → 最初の "n" が次に押すキー、"go" はその後
   */
  keyCandidate: string;
}

// ──────────────────────────────────────────
// レイアウト定数
// ──────────────────────────────────────────

/** 上部バーの高さ (px) */
const TOP_BAR_H = 48;

/** 上部バーのテキスト Y 位置 */
const TOP_TEXT_Y = 32;

/** 打鍵パネルの幅 (px) */
const PANEL_W = 460;

/** 打鍵パネルの高さ (px) */
const PANEL_H = 110;

/** 打鍵パネルの下端から画面下端へのマージン (px) */
const PANEL_BOTTOM_MARGIN = 56;

/** 打鍵圧バーの高さ (px) */
const PRESSURE_BAR_H = 10;

/** 打鍵圧バーのサイドマージン (px) */
const PRESSURE_BAR_MARGIN = 80;

/** 打鍵圧フェードアウトの時定数（大きいほど早く消える） */
const PRESSURE_DECAY = 2.5;

// ──────────────────────────────────────────
// HUD クラス
// ──────────────────────────────────────────

export class HUD {
  /** Canvas 2D コンテキスト */
  private ctx: CanvasRenderingContext2D;

  /** HUD 描画用 canvas（DOM に追加して WebGL canvas の上に重ねる）*/
  private _canvas: HTMLCanvasElement;

  /**
   * 現在表示中の打鍵圧（0.0〜1.0）。
   * notifyKeyPress() で打鍵圧にセットされ、render() 毎フレームで減衰する。
   */
  private pressureDisplay = 0;

  /**
   * @param width  - 初期幅 (px)
   * @param height - 初期高さ (px)
   */
  constructor(width: number, height: number) {
    // ── Canvas 要素を生成 ──
    this._canvas = document.createElement('canvas');
    this._canvas.width  = width;
    this._canvas.height = height;

    // WebGL キャンバスと完全に重なるよう position:absolute
    this._canvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
      z-index: 1;
    `;

    // 2D コンテキストを取得
    const ctx = this._canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D コンテキストの取得に失敗しました');
    this.ctx = ctx;
  }

  // ──────────────────────────────────────────
  // 公開 API
  // ──────────────────────────────────────────

  /**
   * キーが押されたときに呼ぶ。
   * pressureDisplay に打鍵圧をセットし、フェードアウトを開始する。
   *
   * @param pressure - 打鍵圧 0.0〜1.0
   */
  notifyKeyPress(pressure: number): void {
    this.pressureDisplay = pressure;
  }

  /**
   * 毎フレーム呼ぶ。HUD 全体を再描画する。
   *
   * @param state - ゲームの現在状態
   * @param dt    - 前フレームからの経過時間（秒）。打鍵圧フェードアウトに使う
   */
  render(state: HUDState, dt: number): void {
    const { ctx } = this;
    const W = this._canvas.width;
    const H = this._canvas.height;

    // ── 前フレームの描画をクリア ──
    ctx.clearRect(0, 0, W, H);

    // 打鍵圧を指数減衰させる
    // exp(-k*dt) で dt に依存した減衰率になり、フレームレートに非依存
    this.pressureDisplay *= Math.exp(-PRESSURE_DECAY * dt);

    // ── 各パーツを描画 ──
    this.drawTopBar(state, W);
    this.drawTypingPanel(state, W, H);
    this.drawPressureBar(W, H);
  }

  /**
   * ウィンドウリサイズ時に呼ぶ。
   * Canvas のサイズを更新し、次フレームから新しいサイズで描画される。
   */
  resize(width: number, height: number): void {
    this._canvas.width  = width;
    this._canvas.height = height;
  }

  /** DOM に追加するための canvas 要素 */
  get element(): HTMLCanvasElement {
    return this._canvas;
  }

  // ──────────────────────────────────────────
  // 描画サブルーチン
  // ──────────────────────────────────────────

  /**
   * 上部バーを描画する。
   * 左側にタイマー、右側にスコアを表示。
   *
   * @param state - HUDState
   * @param W     - canvas 幅
   */
  private drawTopBar(state: HUDState, W: number): void {
    const { ctx } = this;

    // ── バー背景（半透明の暗い帯）──
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W, TOP_BAR_H);

    ctx.font      = '20px "Audiowide", monospace';
    ctx.fillStyle = '#ffffff';

    // ── タイマー（左端）──
    // 経過時間を MM:SS 形式にフォーマット
    const minutes = Math.floor(state.elapsedSec / 60);
    const seconds = Math.floor(state.elapsedSec % 60);
    const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`⏱ ${timerText}`, 20, TOP_TEXT_Y);

    // ── スコア（右端）──
    // 6桁ゼロ埋めで表示（例: 001200）
    const scoreText = `SCORE  ${String(state.score).padStart(6, '0')}`;
    ctx.textAlign = 'right';
    ctx.fillText(scoreText, W - 20, TOP_TEXT_Y);
  }

  /**
   * 打鍵文字パネルを描画する。
   * 画面下部中央に半透明パネルを置き、ひらがなとキー候補を表示する。
   *
   * ── ひらがな表示 ──
   *   seqDone      → 薄い白（打ち終わりは目立たなくする）
   *   seqCandidates → 明るい白・太字（これから打つ部分を目立たせる）
   *
   * ── キー候補表示（ローマ字）──
   *   keyCandidate[0]  → 黄色・大きめ（次の1文字を強調）
   *   keyCandidate[1:] → 薄い黄色（続きのキーは控えめに）
   *
   * @param state - HUDState
   * @param W     - canvas 幅
   * @param H     - canvas 高さ
   */
  private drawTypingPanel(state: HUDState, W: number, H: number): void {
    const { ctx } = this;

    // パネルの左上座標
    const px = (W - PANEL_W) / 2;
    const py = H - PANEL_BOTTOM_MARGIN - PANEL_H;

    // ── パネル背景 ──
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    this.roundRect(px, py, PANEL_W, PANEL_H, 12);
    ctx.fill();

    // ── ひらがな表示 ──
    // seqDone + seqCandidates を中央揃えで描画
    const hiraganaY = py + 46;
    const HIRA_SIZE = 30;

    ctx.font         = `bold ${HIRA_SIZE}px "Noto Sans JP", "Hiragino Sans", sans-serif`;
    ctx.textBaseline = 'alphabetic';

    // 全体幅を計測して中央に配置
    ctx.font = `${HIRA_SIZE}px sans-serif`;
    const doneW = ctx.measureText(state.seqDone).width;
    const candW = ctx.measureText(state.seqCandidates).width;
    const totalHiraW = doneW + candW;
    let hiraX = px + (PANEL_W - totalHiraW) / 2;

    // 打ち終わり部分（薄い白）
    ctx.font      = `${HIRA_SIZE}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(state.seqDone, hiraX, hiraganaY);
    hiraX += doneW;

    // 残り部分（明るい白・太字）
    ctx.font      = `bold ${HIRA_SIZE}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.seqCandidates, hiraX, hiraganaY);

    // ── キー候補（ローマ字）──
    // 次の1文字を黄色・大きめ、続きを薄い黄で表示
    const KEY_SIZE     = 22;
    const KEY_SIZE_BIG = 28; // 次の1文字のフォントサイズ
    const keyY         = py + PANEL_H - 18;

    if (state.keyCandidate.length > 0) {
      const nextKey  = state.keyCandidate[0];             // 次に打つ1文字
      const restKeys = state.keyCandidate.slice(1);       // その後の文字列

      // 全体幅を計算して中央揃え
      ctx.font = `bold ${KEY_SIZE_BIG}px "Audiowide", monospace`;
      const nextW = ctx.measureText(nextKey).width;
      ctx.font = `${KEY_SIZE}px "Audiowide", monospace`;
      const restW = ctx.measureText(restKeys).width;
      // "→ " プレフィックス
      ctx.font = `${KEY_SIZE}px monospace`;
      const arrowW = ctx.measureText('→ ').width;

      const totalKeyW = arrowW + nextW + restW;
      let keyX = px + (PANEL_W - totalKeyW) / 2;

      // 矢印プレフィックス
      ctx.font      = `${KEY_SIZE}px monospace`;
      ctx.fillStyle = 'rgba(255, 232, 77, 0.6)';
      ctx.textAlign = 'left';
      ctx.fillText('→ ', keyX, keyY);
      keyX += arrowW;

      // 次の1文字（黄色・大・太字）
      ctx.font      = `bold ${KEY_SIZE_BIG}px "Audiowide", monospace`;
      ctx.fillStyle = '#FFE84D';
      ctx.fillText(nextKey, keyX, keyY);
      keyX += nextW;

      // 続きの文字（薄い黄）
      if (restKeys.length > 0) {
        ctx.font      = `${KEY_SIZE}px "Audiowide", monospace`;
        ctx.fillStyle = 'rgba(255, 232, 77, 0.45)';
        ctx.fillText(restKeys, keyX, keyY);
      }
    }
  }

  /**
   * 打鍵圧バーを描画する。
   * 画面最下部に横幅いっぱいのバーを表示。
   *
   * ── 色のグラデーション（圧力に応じて変化）──
   *   低 (0.0〜0.4): 青緑（軽い打鍵）
   *   中 (0.4〜0.7): 黄色（適切な圧力）
   *   高 (0.7〜1.0): 赤（強い打鍵）
   *
   * ── フェードアウト ──
   *   render() 内で pressureDisplay を指数減衰させているため、
   *   打鍵直後はフルで表示され、徐々に消えていく。
   *
   * @param W - canvas 幅
   * @param H - canvas 高さ
   */
  private drawPressureBar(W: number, H: number): void {
    const { ctx } = this;

    const barY = H - PRESSURE_BAR_H - 4;
    const barW = W - PRESSURE_BAR_MARGIN * 2;

    // ── バー背景（暗いグレー）──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.roundRect(PRESSURE_BAR_MARGIN, barY, barW, PRESSURE_BAR_H, 5);
    ctx.fill();

    // 打鍵圧が極小のときはバーを描画しない
    if (this.pressureDisplay < 0.02) return;

    // ── 打鍵圧に応じた色を計算 ──
    // 0.0 → 青緑(#00CFCF)、0.5 → 黄(#FFE84D)、1.0 → 赤(#FF4D4D)
    const p    = this.pressureDisplay;
    const col  = this.pressureColor(p);

    // バーの透明度も pressureDisplay に連動させ、フェードアウトを強調
    const alpha = Math.min(1.0, this.pressureDisplay * 2);
    ctx.globalAlpha = alpha;

    // ── 打鍵圧バー本体（塗り）──
    ctx.fillStyle = col;
    const fillW   = barW * p;
    this.roundRect(PRESSURE_BAR_MARGIN, barY, fillW, PRESSURE_BAR_H, 5);
    ctx.fill();

    // ── 圧力数値ラベル ──
    ctx.font         = '12px "Audiowide", monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      p.toFixed(2),
      PRESSURE_BAR_MARGIN + barW + 44,
      barY + PRESSURE_BAR_H / 2,
    );

    ctx.globalAlpha = 1.0; // アルファをリセット
  }

  // ──────────────────────────────────────────
  // ユーティリティ
  // ──────────────────────────────────────────

  /**
   * 打鍵圧（0〜1）に応じた色文字列（CSS カラー）を返す。
   *
   * 圧力が低い → 青緑（安全・軽い）
   * 圧力が中程度 → 黄色（適切）
   * 圧力が高い → 赤（強打・危険）
   *
   * 実装: 2段階の線形補間（lerp）で色を計算する。
   *   [0, 0.5]: 青緑 → 黄色
   *   [0.5, 1]: 黄色 → 赤
   */
  private pressureColor(p: number): string {
    // 色の3ステップ（RGB 0〜255）
    const low    = [  0, 207, 207]; // 青緑 #00CFCF
    const mid    = [255, 232,  77]; // 黄色 #FFE84D
    const high   = [255,  77,  77]; // 赤   #FF4D4D

    let r: number, g: number, b: number;

    if (p <= 0.5) {
      // 青緑 → 黄色 に lerp
      const t = p / 0.5;
      r = lerp(low[0], mid[0], t);
      g = lerp(low[1], mid[1], t);
      b = lerp(low[2], mid[2], t);
    } else {
      // 黄色 → 赤 に lerp
      const t = (p - 0.5) / 0.5;
      r = lerp(mid[0], high[0], t);
      g = lerp(mid[1], high[1], t);
      b = lerp(mid[2], high[2], t);
    }

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  /**
   * 角丸矩形のパスを作成する（ctx.fill() / ctx.stroke() で使う）。
   * Canvas 2D の roundRect() が使えない環境のためアーク版で実装。
   *
   * @param x - 左上 X
   * @param y - 左上 Y
   * @param w - 幅
   * @param h - 高さ
   * @param r - 角丸の半径
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    // 幅または高さが半径の2倍より小さい場合はクランプ
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y,     x + w, y + rad,     rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }
}

// ──────────────────────────────────────────
// モジュールユーティリティ
// ──────────────────────────────────────────

/** 線形補間（a から b を t(0〜1) で補間）*/
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
