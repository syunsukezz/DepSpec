/**
 * Camera.ts
 * 横スクロール用カメラ。
 *
 * 役割:
 *   1. プレイヤーを X 方向に追従する（横スクロール）
 *   2. WebGL に渡す正射影行列（orthographic projection matrix）を生成する
 *
 * 座標系:
 *   ワールド空間は「Y 上向き」を採用。
 *     - X: 右が正
 *     - Y: 上が正（地面 Y=0、ジャンプで Y が増加）
 *
 * ┌──────────────────────────────┐
 * │  ワールド空間（Y 上向き）     │
 * │                              │
 * │  Y                           │
 * │  ↑                           │
 * │  └── X →                     │
 * └──────────────────────────────┘
 */

import type { Vec2 } from './Vec2.ts';

export class Camera {
  /** カメラ中心のワールド座標 */
  position: Vec2;

  /** ビューポートの幅（px） */
  private viewportWidth: number;

  /** ビューポートの高さ（px） */
  private viewportHeight: number;

  /**
   * @param viewportWidth  - 描画領域の幅（canvas.width と合わせる）
   * @param viewportHeight - 描画領域の高さ（canvas.height と合わせる）
   */
  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth  = viewportWidth;
    this.viewportHeight = viewportHeight;
    // 初期位置: 画面の中央がワールド原点になるように設定
    this.position = {
      x: viewportWidth  / 2,
      y: viewportHeight / 2,
    };
  }

  /**
   * プレイヤーの位置にカメラをなめらかに追従させる（横スクロール）。
   *
   * ── 追従の仕組み ──
   *   目標 X = プレイヤー X - 画面幅 / 3
   *              └── プレイヤーを画面の左1/3に配置することで
   *                  「前方（右側）の空間」を多く見せる演出になる
   *
   *   実際の移動は線形補間（lerp）で滑らか追従:
   *     current += (target - current) * (1 - exp(-smoothing * dt))
   *     dt が小さい（高FPS）ほど少しずつ近づき、フレームレート非依存になる
   *
   * @param target    - 追従対象の座標（プレイヤーの中心座標を渡す）
   * @param dt        - 前フレームからの経過時間（秒）
   * @param smoothing - 追従速度。大きいほど素早く追従（デフォルト 5.0）
   */
  follow(target: Vec2, dt: number, smoothing = 5.0): void {
    // ── X 方向: プレイヤーを画面左1/3の位置に追従 ──
    const targetX = target.x + this.viewportWidth / 3;

    // ── Y 方向: 固定（縦スクロールなし）──
    // 地面を画面下20%付近に置くよう固定
    const targetY = this.viewportHeight * 0.35;

    // フレームレート非依存の lerp 係数
    // dt が変わっても「1秒あたりの移動量」が一定になる
    const alpha = 1.0 - Math.exp(-smoothing * dt);

    this.position.x += (targetX - this.position.x) * alpha;
    this.position.y += (targetY - this.position.y) * alpha;
  }

  /**
   * WebGL に渡す正射影行列（4×4）を生成して返す。
   *
   * ── 正射影行列とは ──
   *   3D 空間の点を「平行投影」で 2D 画面座標（NDC）に変換する行列。
   *   2D ゲームでは奥行きを無視してそのまま画面に貼り付けたいので
   *   透視投影（遠くが小さくなる）ではなくこちらを使う。
   *
   * ── 変換の流れ ──
   *   ワールド座標 (x, y)
   *     → カメラ範囲 [left, right] × [bottom, top] を
   *       NDC（正規化デバイス座標）[-1, +1] × [-1, +1] に線形変換
   *
   *   left   = camera.x - W/2  ← 画面左端のワールド X
   *   right  = camera.x + W/2  ← 画面右端のワールド X
   *   bottom = camera.y - H/2  ← 画面下端のワールド Y（Y 上向き = 小さい値）
   *   top    = camera.y + H/2  ← 画面上端のワールド Y
   *
   * ── 行列の形（列優先 / column-major）──
   *   WebGL は列優先でメモリに並べるため、数学表記と転置した順で渡す。
   *
   *   数学表記（行優先）:
   *   | 2/(r-l)   0         0         -(r+l)/(r-l) |
   *   | 0         2/(t-b)   0         -(t+b)/(t-b) |
   *   | 0         0        -2/(f-n)   -(f+n)/(f-n) |
   *   | 0         0         0          1           |
   *
   * @returns Float32Array(16) - 列優先の 4×4 行列
   */
  getProjectionMatrix(): Float32Array {
    const hw = this.viewportWidth  / 2; // half width
    const hh = this.viewportHeight / 2; // half height

    // カメラが映すワールド空間の範囲
    const left   = this.position.x - hw;
    const right  = this.position.x + hw;
    const bottom = this.position.y - hh;
    const top    = this.position.y + hh;

    // near/far は 2D なので薄くて良い（Z 軸は使わない）
    const near = -1.0;
    const far  =  1.0;

    // スケーリング係数（各軸を [-1, 1] に正規化するための分母）
    const rl = right - left;   // 幅
    const tb = top   - bottom; // 高さ
    const fn = far   - near;   // 奥行き

    // 列優先 (column-major) で Float32Array に並べる
    // インデックスの並び:
    //   [col0_row0, col0_row1, col0_row2, col0_row3,
    //    col1_row0, col1_row1, col1_row2, col1_row3,
    //    col2_row0, col2_row1, col2_row2, col2_row3,
    //    col3_row0, col3_row1, col3_row2, col3_row3]
    return new Float32Array([
      // 列 0
      2 / rl,  0,       0,        0,
      // 列 1
      0,       2 / tb,  0,        0,
      // 列 2
      0,       0,      -2 / fn,   0,
      // 列 3（平行移動成分）
      -(right + left) / rl,
      -(top + bottom) / tb,
      -(far + near)   / fn,
      1,
    ]);
  }

  /**
   * canvas のリサイズ時にビューポートサイズを更新する。
   * これを呼ばないと縦横比がずれたまま描画される。
   */
  resize(width: number, height: number): void {
    this.viewportWidth  = width;
    this.viewportHeight = height;
  }

  /** 現在のビューポート幅を返す */
  get width(): number { return this.viewportWidth; }

  /** 現在のビューポート高さを返す */
  get height(): number { return this.viewportHeight; }
}
