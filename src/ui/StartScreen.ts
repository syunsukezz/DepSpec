/**
 * StartScreen.ts
 * スタート画面の Canvas 2D オーバーレイ。
 *
 * ── 画面構成 ──
 *
 *   ┌──────────────────────────────────────────┐
 *   │                                          │
 *   │             DepSpec                      │  ← ゲームタイトル
 *   │   アナログキーボードで打つ                 │  ← サブタイトル
 *   │   タイピングアクションゲーム               │
 *   │                                          │
 *   │  [障害物エリア] → [谷越えエリア] → [釘打ちエリア]  │  ← エリア紹介
 *   │                                          │
 *   │      PRESS SPACE TO START  ← 点滅        │
 *   │                                          │
 *   └──────────────────────────────────────────┘
 *
 * ── 使い方 ──
 *   1. コンストラクタで canvas 生成
 *   2. element を DOM に追加（z-index:2 で HUD の上に重なる）
 *   3. 毎フレーム render(dt) を呼ぶと点滅アニメーションが動く
 *   4. hide() を呼ぶとゲーム開始時に非表示になる
 */

export class StartScreen {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  /** 点滅用の経過時間カウンタ (秒) */
  private timer: number = 0;

  /**
   * @param w - 初期キャンバス幅（window.innerWidth を渡す）
   * @param h - 初期キャンバス高さ（window.innerHeight を渡す）
   */
  constructor(w: number, h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width  = w;
    this.canvas.height = h;
    this.canvas.style.cssText =
      'position:absolute; top:0; left:0; pointer-events:none; z-index:2;';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** DOM に追加するための canvas 要素 */
  get element(): HTMLCanvasElement { return this.canvas; }

  /** 表示する（デフォルトで表示済み） */
  show(): void { this.canvas.style.display = 'block'; }

  /** 非表示にする（ゲーム開始時に呼ぶ） */
  hide(): void { this.canvas.style.display = 'none'; }

  /** リサイズ対応 */
  resize(w: number, h: number): void {
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  /**
   * スタート画面を描画する。毎フレーム呼ぶこと。
   * @param dt - 経過時間（点滅アニメーションに使う）
   */
  render(dt: number): void {
    this.timer += dt;

    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // ── 背景: 暗いグラデーション ──
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(5, 8, 25, 0.95)');
    grad.addColorStop(1, 'rgba(10, 20, 50, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // ── タイトル: DepSpec ──
    ctx.font      = `bold ${Math.round(h * 0.12)}px Audiowide, monospace`;
    ctx.fillStyle = '#FFFFFF';
    // 薄いシャドウで立体感
    ctx.shadowColor   = 'rgba(100, 160, 255, 0.6)';
    ctx.shadowBlur    = 20;
    ctx.fillText('DepSpec', w / 2, h * 0.26);
    ctx.shadowBlur = 0;

    // ── サブタイトル ──
    ctx.font      = `${Math.round(h * 0.026)}px Noto Sans JP, sans-serif`;
    ctx.fillStyle = '#99AACC';
    ctx.fillText('アナログキーボードで打つ タイピングアクションゲーム', w / 2, h * 0.38);

    // ── エリア紹介 ──
    const areas = [
      { label: '障害物エリア', color: '#4FC3F7' },
      { label: '谷越えエリア', color: '#81C784' },
      { label: '釘打ちエリア', color: '#FFB74D' },
    ];
    const areaY   = h * 0.52;
    const spacing = Math.min(w / 4.5, 200);

    areas.forEach((area, i) => {
      const x = w / 2 + (i - 1) * spacing;

      // エリア枠
      const boxW = spacing * 0.72;
      const boxH = h * 0.065;
      ctx.fillStyle = `${area.color}22`; // とても薄い色
      this.roundRect(ctx, x - boxW / 2, areaY - boxH / 2, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = area.color;
      ctx.lineWidth   = 1.5;
      this.roundRect(ctx, x - boxW / 2, areaY - boxH / 2, boxW, boxH, 6);
      ctx.stroke();

      // エリア名
      ctx.font      = `bold ${Math.round(h * 0.022)}px Noto Sans JP, sans-serif`;
      ctx.fillStyle = area.color;
      ctx.fillText(area.label, x, areaY);

      // 矢印（最後以外）
      if (i < areas.length - 1) {
        ctx.font      = `${Math.round(h * 0.022)}px monospace`;
        ctx.fillStyle = '#555577';
        ctx.fillText('→', x + spacing / 2, areaY);
      }
    });

    // ── 操作説明 ──
    ctx.font      = `${Math.round(h * 0.020)}px Noto Sans JP, sans-serif`;
    ctx.fillStyle = '#778899';
    ctx.fillText('正しいキーを正しい力で打ってステージを進め！', w / 2, h * 0.65);

    // ── PRESS SPACE TO START (点滅) ──
    const blink = 0.55 + 0.45 * Math.sin(this.timer * 2.8);
    ctx.globalAlpha = blink;
    ctx.font        = `bold ${Math.round(h * 0.030)}px Audiowide, monospace`;
    ctx.fillStyle   = '#FFFFFF';
    ctx.fillText('PRESS  SPACE  TO  START', w / 2, h * 0.78);
    ctx.globalAlpha = 1.0;
  }

  // ── ユーティリティ ──

  /** 角丸矩形のパスを作成（fill/stroke は呼び出し側で行う） */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
