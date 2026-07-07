/**
 * Player.ts
 * プレイヤーの状態・物理演算・描画を管理するクラス。
 *
 * ── ジャンプの2モード ──
 *   各エリアによって打鍵圧の使われ方が異なる。
 *
 *   'height' モード（障害物エリア / 落下物エリア）:
 *     → プレイヤーは自動で右へ進む（一定速度）
 *     → キーを打つとジャンプ。打鍵圧 → ジャンプの「高さ」が変わる
 *     → 弱く打つ = 低いジャンプ（低い障害物を越え、天井は避ける）
 *     → 強く打つ = 高いジャンプ（高い障害物を越えるが天井に当たる）
 *
 *   'distance' モード（谷のエリア）:
 *     → プレイヤーは自動移動せずその場に立つ
 *     → キーを打つと一定高度でジャンプ。打鍵圧 → ジャンプの「距離（水平）」が変わる
 *     → 弱く打つ = 近くに着地（小さい穴しか越えられない）
 *     → 強く打つ = 遠くに着地（大きな穴も越えられる）
 *
 * ── 物理演算 ──
 *   重力加速度を毎フレーム vel.y に足し、pos.y を更新する。
 *   地面に触れたら pos.y をリセットして vel.y = 0 にする。
 *
 * ── 状態遷移 ──
 *
 *   grounded ──[jump()]──→ jumping
 *   jumping  ──[vel.y<0]──→ falling
 *   falling  ──[地面到達]──→ grounded
 *   grounded/jumping/falling ──[die()]──→ dead
 *   dead ──[deadTimer終了]──→ grounded（リスポーン）
 */

import type { Vec2 } from '../core/Vec2.ts';
import type { Renderer } from '../core/Renderer.ts';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** 重力加速度 (px/s²)。Y 上向き座標系なので負の値 */
const GRAVITY = -1400;

/**
 * height モード: 打鍵圧 1.0 のときのジャンプ初速 (px/s)。
 * pressure * MAX_JUMP_VY が実際のジャンプ初速になる。
 */
const MAX_JUMP_VY = 750;

/**
 * distance モード: 打鍵圧 1.0 のときの水平速度 (px/s)。
 * pressure * MAX_JUMP_VX が水平ジャンプ速度になる。
 */
const MAX_JUMP_VX = 700;

/** distance モード: ジャンプ高さは固定（px/s） */
const FIXED_JUMP_VY = 500;

/** 障害物エリアでのプレイヤー自動移動速度 (px/s) */
const AUTO_MOVE_VX = 180;

/** プレイヤーの幅 (px) */
export const PLAYER_WIDTH = 30;

/** プレイヤーの高さ (px) */
export const PLAYER_HEIGHT = 45;

/** 死亡後にリスポーンするまでの待機時間 (秒) */
const DEAD_DURATION = 1.5;

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/**
 * プレイヤーの状態。
 *   grounded - 地面に立っている（ジャンプ可能）
 *   jumping  - 上昇中（vel.y > 0）
 *   falling  - 下降中（vel.y <= 0）
 *   dead     - 死亡中（一定時間後にリスポーン）
 */
export type PlayerState = 'grounded' | 'jumping' | 'falling' | 'dead';

/**
 * ジャンプモード。エリアごとに切り替える。
 *   height   - 高さが打鍵圧に比例（障害物・落下物エリア）
 *   distance - 水平距離が打鍵圧に比例（谷のエリア）
 */
export type JumpMode = 'height' | 'distance';

/** 軸整合境界ボックス（AABB）。衝突判定に使う */
export type AABB = {
  x: number; // 左下 X
  y: number; // 左下 Y
  w: number; // 幅
  h: number; // 高さ
};

// ──────────────────────────────────────────
// Player クラス
// ──────────────────────────────────────────

export class Player {
  /**
   * プレイヤーの左下座標（ワールド座標）。
   * Y は上向きなので、足元が pos.y、頭が pos.y + PLAYER_HEIGHT。
   */
  pos: Vec2;

  /** 現在の速度 (px/s)。vel.x: 右が正、vel.y: 上が正 */
  vel: Vec2;

  /** 現在の状態 */
  state: PlayerState;

  /**
   * チェックポイント座標。
   * 死亡時にここへリスポーンする。
   * エリアが障害物を越えるたびに更新する。
   */
  private checkpoint: Vec2;

  /**
   * 死亡後の経過時間 (秒)。
   * DEAD_DURATION を超えたらリスポーン。
   */
  private deadTimer: number;

  /**
   * @param startX - 初期 X 座標
   * @param groundY - 最初に立つ地面の Y 座標（地面の上面）
   */
  constructor(startX: number, groundY: number) {
    this.pos       = { x: startX, y: groundY };
    this.vel       = { x: 0, y: 0 };
    this.state     = 'grounded';
    this.checkpoint = { x: startX, y: groundY };
    this.deadTimer  = 0;
  }

  // ──────────────────────────────────────────
  // 毎フレーム更新
  // ──────────────────────────────────────────

  /**
   * プレイヤーの物理状態を1フレーム進める。
   *
   * @param dt      - 前フレームからの経過時間（秒）
   * @param groundY - 現在の地面の上面 Y 座標（落下物や坂では変動しうる）
   * @param autoMove - true のとき AUTO_MOVE_VX で右へ自動移動（障害物/落下物エリア）
   *                   false のとき X 方向の自動移動なし（谷のエリア）
   */
  update(dt: number, groundY: number, autoMove = true): void {
    // 死亡中はリスポーン待機のみ
    if (this.state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer >= DEAD_DURATION) {
        this.respawn();
      }
      return;
    }

    // ── 水平移動 ──
    if (autoMove) {
      // 障害物/落下物エリア: 一定速度で右へ進む
      this.vel.x = AUTO_MOVE_VX;
    }
    // distance モードでジャンプ後の水平速度は vel.x に残っているのでそのまま

    // ── 重力 ──
    // grounded のときは重力を加えない（地面をすり抜けないように）
    if (this.state !== 'grounded') {
      this.vel.y += GRAVITY * dt;
    }

    // ── 位置更新 ──
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // ── 地面との衝突 ──
    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;

      // distance モード着地後は水平速度もリセット
      if (!autoMove) {
        this.vel.x = 0;
      }

      this.state = 'grounded';
    }

    // ── ジャンプ中の状態遷移 ──
    // vel.y が正から負に転じたら「上昇中」→「落下中」
    if (this.state === 'jumping' && this.vel.y <= 0) {
      this.state = 'falling';
    }
  }

  // ──────────────────────────────────────────
  // ジャンプ
  // ──────────────────────────────────────────

  /**
   * 打鍵圧に応じてジャンプさせる。
   * grounded 状態のときだけ有効（空中ではジャンプ不可）。
   *
   * @param pressure - 打鍵圧 0.0〜1.0（AnalogSense から受け取る値）
   * @param mode     - 'height': 高さ制御 / 'distance': 距離制御
   */
  jump(pressure: number, mode: JumpMode): void {
    // 空中や死亡中はジャンプ不可
    if (this.state !== 'grounded') return;

    // 圧力を 0〜1 の範囲にクランプ（念のため）
    const p = Math.max(0, Math.min(1, pressure));

    if (mode === 'height') {
      // ── 高さモード（障害物エリア / 落下物エリア）──
      // 打鍵圧が高い → 強く打つ → 高くジャンプ
      // 水平速度は変えない（AUTO_MOVE_VX のまま）
      this.vel.y = p * MAX_JUMP_VY;

    } else {
      // ── 距離モード（谷のエリア）──
      // 高さは固定、水平速度だけ打鍵圧で変える
      // 強く打つ → 遠くへ飛ぶ
      this.vel.y = FIXED_JUMP_VY;
      this.vel.x = p * MAX_JUMP_VX;
    }

    this.state = 'jumping';
  }

  // ──────────────────────────────────────────
  // 死亡・リスポーン
  // ──────────────────────────────────────────

  /**
   * プレイヤーを死亡状態にする。
   * DEAD_DURATION 秒後に checkpoint へリスポーンする。
   * エリア側が衝突判定の結果 die() を呼ぶ。
   */
  die(): void {
    if (this.state === 'dead') return; // 二重死亡防止
    this.state     = 'dead';
    this.deadTimer = 0;
    this.vel       = { x: 0, y: 0 };
  }

  /**
   * チェックポイントを更新する。
   * エリアが「安全な地点」を通過したときに呼ぶ。
   * （例: 障害物を越えた直後、穴を渡り切った直後）
   *
   * @param pos - 新しいリスポーン位置（地面上の左下座標）
   */
  setCheckpoint(pos: Vec2): void {
    this.checkpoint = { x: pos.x, y: pos.y };
  }

  /**
   * チェックポイントへリスポーンする（内部処理）。
   * die() が呼ばれてから DEAD_DURATION 秒後に自動で呼ばれる。
   */
  private respawn(): void {
    this.pos       = { x: this.checkpoint.x, y: this.checkpoint.y };
    this.vel       = { x: 0, y: 0 };
    this.state     = 'grounded';
    this.deadTimer = 0;
  }

  // ──────────────────────────────────────────
  // 衝突判定補助
  // ──────────────────────────────────────────

  /**
   * プレイヤーの AABB（軸整合境界ボックス）を返す。
   * エリア側の衝突判定で使う。
   *
   *   (pos.x, pos.y) ─────── (pos.x + W, pos.y)
   *         │                        │
   *   (pos.x, pos.y + H) ──── (pos.x + W, pos.y + H)
   */
  get bounds(): AABB {
    return {
      x: this.pos.x,
      y: this.pos.y,
      w: PLAYER_WIDTH,
      h: PLAYER_HEIGHT,
    };
  }

  /**
   * 別の AABB と重なっているかを調べる（汎用）。
   * 2つの矩形が「1点以上共有」していれば true を返す。
   *
   * @param other - 衝突を調べたい矩形
   */
  overlaps(other: AABB): boolean {
    const b = this.bounds;
    return (
      b.x < other.x + other.w &&
      b.x + b.w > other.x &&
      b.y < other.y + other.h &&
      b.y + b.h > other.y
    );
  }

  // ──────────────────────────────────────────
  // 描画
  // ──────────────────────────────────────────

  /**
   * プレイヤーを描画する。
   * 状態によって色を変えることで視覚的なフィードバックを提供する。
   *
   *   grounded - 白（通常）
   *   jumping  - 黄色（ジャンプ中）
   *   falling  - オレンジ（落下中）
   *   dead     - 赤（死亡中）
   *
   * @param renderer - 描画に使う Renderer（setCamera 済みであること）
   */
  render(renderer: Renderer): void {
    if (renderer.hasTexture('player') && this.state !== 'dead') {
      renderer.drawImage(
        'player',
        this.pos.x, this.pos.y,
        PLAYER_WIDTH, PLAYER_HEIGHT,
      );
    } else {
      // テクスチャ未ロード or 死亡中は色ベタ塗りフォールバック
      let r = 1.0, g = 1.0, b = 1.0;
      if (this.state === 'jumping') {
        r = 1.0; g = 0.95; b = 0.2;
      } else if (this.state === 'falling') {
        r = 1.0; g = 0.6; b = 0.1;
      } else if (this.state === 'dead') {
        const blink = Math.sin(this.deadTimer * 12) > 0 ? 1.0 : 0.3;
        r = blink; g = 0.1 * blink; b = 0.1 * blink;
      }
      renderer.drawRect(this.pos.x, this.pos.y, PLAYER_WIDTH, PLAYER_HEIGHT, r, g, b);
    }
  }

  // ──────────────────────────────────────────
  // 状態問い合わせ
  // ──────────────────────────────────────────

  /** 地面に立っている（ジャンプ受付可能）か */
  get isGrounded(): boolean { return this.state === 'grounded'; }

  /** 死亡中か */
  get isDead(): boolean { return this.state === 'dead'; }

  /** 現在のチェックポイント（デバッグや UI 表示用） */
  get currentCheckpoint(): Vec2 { return { ...this.checkpoint }; }
}
