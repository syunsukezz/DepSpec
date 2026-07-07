/**
 * NailArea.ts
 * 釘打ちエリアの実装。
 *
 * ── ルール ──
 *   ・床にランダムな長さの釘が一定間隔（NAIL_SPACING）で配置されている
 *   ・プレイヤーは自動前進しない（autoMove = false）
 *   ・キーを打つと「前の釘から次の釘」へ固定水平距離だけジャンプする
 *   ・打鍵圧 → ジャンプ高さ（height モード）
 *   ・釘の長さ = 「適切なジャンプ高さ」の視覚的手がかり
 *
 *   ジャンプの最大高さ（maxH）と釘の長さ（L）の比較:
 *     L - TOLERANCE ≦ maxH ≦ L + TOLERANCE  → 成功: 釘を打ち込む
 *     maxH < L - TOLERANCE                   → 弱すぎ: バウンスバック（元の位置へ戻る）
 *     maxH > L + TOLERANCE                   → 強すぎ: die + 釘は打ち込まれ次の釘へ
 *
 * ── 全釘を打ち込んだらクリア ──
 *
 * ── 座標系 ──
 *
 *   ↑ Y                        nail.length
 *   │                               │
 *   │    釘の先端 → FLOOR_Y + nail.length
 *   │               ┃  ← shaft（細い）
 *   │    ╔══════╗ ← head（横に広いキャップ）
 *   │  ──────────────────── FLOOR_Y（地面）
 *   └──────────────────────────────── X
 *
 * ── ジャンプの水平速度計算 ──
 *
 *   固定水平距離 = NAIL_SPACING を毎ジャンプ正確に飛ぶため、
 *   vel.x を vel.y（打鍵圧から決まる）に合わせて計算する。
 *
 *     飛行時間 T = 2 * vel.y / GRAVITY_ABS
 *     vel.x = (nail.x - player.pos.x) / T
 *
 *   これにより高いジャンプほど vel.x が小さくなり（ゆっくり飛ぶ高い弧）、
 *   低いジャンプほど vel.x が大きくなる（速く飛ぶ低い弧）。
 */

import type { IArea }    from './IArea.ts';
import type { Player }   from '../game/Player.ts';
import type { Renderer } from '../core/Renderer.ts';
import type { Camera }   from '../core/Camera.ts';
import type { Vec2 }     from '../core/Vec2.ts';
import { PLAYER_WIDTH }  from '../game/Player.ts';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/**
 * 1回のジャンプで前方向に進む固定水平距離 (px)。
 * プレイヤーは毎ジャンプこの距離だけ右に移動し、次の釘の上に着地する。
 */
const NAIL_SPACING = 120;

/** 釘の最小の長さ（床から突き出る高さ px）→ 低いジャンプで到達可能 */
const NAIL_LENGTH_MIN = 25;

/** 釘の最大の長さ（床から突き出る高さ px）→ 高いジャンプが必要 */
const NAIL_LENGTH_MAX = 165;

/**
 * 成功判定の高さ許容幅 (px)。
 * maxH ∈ [nail.length - TOLERANCE, nail.length + TOLERANCE] なら成功。
 */
const NAIL_TOLERANCE = 28;

/** 釘のシャフト（軸）幅 (px) */
const NAIL_SHAFT_W = 8;

/** 釘の頭（キャップ）幅 (px) */
const NAIL_HEAD_W = 24;

/** 釘の頭（キャップ）高さ (px) */
const NAIL_HEAD_H = 9;

/**
 * Player.ts の GRAVITY 定数の絶対値。
 * ジャンプ最大高さの計算 maxH = vel.y² / (2 * GRAVITY_ABS) に使う。
 * Player.ts の GRAVITY = -1400 と一致させること。
 */
const GRAVITY_ABS = 1400;

/**
 * Player.ts の MAX_JUMP_VY と一致させること。
 * onKeyPress で vel.y = pressure * MAX_JUMP_VY を設定する際に使う。
 */
const MAX_JUMP_VY = 750;

/**
 * ジャンプ初速の下限 (px/s)。
 * 0 に近い圧力では vel.x が非常に大きくなるため、最低限の上昇速度を保証する。
 */
const MIN_JUMP_VY = 75;

/**
 * バウンスバック（弱すぎで戻るとき）の固定初速 (px/s)。
 * 前のジャンプと同じ飛行時間で vel.x を逆算し、元の位置に正確に戻る。
 */
const BOUNCE_VY = 380;

/** エリア終端の余裕距離 (px) */
const GOAL_MARGIN = 220;

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/** 1本の釘 */
type Nail = {
  /** 釘の中心 X 座標（プレイヤーの着地目標位置） */
  x: number;
  /** 床から突き出ている高さ (px)。適切なジャンプ高さの指標になる */
  length: number;
  /** true = 打ち込み済み（成功 or 強すぎ死亡どちらでも true になる） */
  driven: boolean;
};

/**
 * このエリアのジャンプ状態。
 *   idle      - 地面にいる（次のジャンプを待っている）
 *   forward   - 前方の釘へ向かってジャンプ中
 *   returning - 弱すぎて跳ね返り、元の位置へ戻っている最中
 */
type JumpPhase = 'idle' | 'forward' | 'returning';

/** [min, max] の範囲で一様乱数を返す */
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ──────────────────────────────────────────
// NailArea クラス
// ──────────────────────────────────────────

export class NailArea implements IArea {
  // ── IArea 必須プロパティ ──
  readonly startX: number;
  readonly endX: number;

  /**
   * 釘打ちエリアはプレイヤーが自動前進しない。
   * 1回のキー打鍵 = 1本の釘への固定距離ジャンプ。
   */
  readonly autoMove = false;

  // ── エリア設定 ──
  private readonly floorY: number;

  // ── ゲーム状態 ──
  private nails: Nail[];
  private player: Player;
  private respawnPoint: Vec2;

  /** 現在の飛行状態 */
  private phase: JumpPhase = 'idle';

  /**
   * ジャンプ開始時のプレイヤー X 座標。
   * バウンスバックで戻る先として使う。
   */
  private jumpStartX: number = 0;

  /**
   * 今のジャンプで打った打鍵の初速 (px/s)。
   * 着地時に「理論的な最大高さ」を vel.y² / (2 * GRAVITY_ABS) で計算するために保存。
   */
  private jumpVY: number = 0;

  /**
   * 今向かっている釘のインデックス。
   * forward / returning 中に参照し、着地時の判定に使う。
   */
  private pendingNailIdx: number = 0;

  /**
   * 前フレームのプレイヤー着地状態。
   * false → true に変化した瞬間を「着地」として検出する。
   */
  private wasGrounded: boolean = true;

  /**
   * @param player    - プレイヤーへの参照
   * @param startX    - エリア開始 X 座標
   * @param nailCount - 釘の本数
   * @param floorY    - 地面の上面 Y 座標
   */
  constructor(
    player: Player,
    startX: number,
    nailCount: number,
    floorY: number,
  ) {
    this.player  = player;
    this.startX  = startX;
    this.floorY  = floorY;

    this.nails = this.generateNails(startX, nailCount);

    // 初期リスポーン地点: 最初の釘の手前
    // ※ コンストラクタでは setCheckpoint を呼ばない。
    //   Stage が全エリア生成後に最初のエリアのリスポーン地点を設定する。
    this.respawnPoint = { x: startX + 30, y: floorY };

    // エリア終端: 最後の釘 + ゴールマージン
    const last = this.nails[this.nails.length - 1];
    this.endX = last.x + GOAL_MARGIN;
  }

  // ──────────────────────────────────────────
  // 釘生成
  // ──────────────────────────────────────────

  /**
   * ランダムな長さの釘を等間隔に生成する。
   *
   * @param startX    - 最初の釘の中心 X
   * @param nailCount - 本数
   */
  private generateNails(startX: number, nailCount: number): Nail[] {
    const nails: Nail[] = [];
    for (let i = 0; i < nailCount; i++) {
      nails.push({
        x:      startX + NAIL_SPACING + i * NAIL_SPACING,
        length: randBetween(NAIL_LENGTH_MIN, NAIL_LENGTH_MAX),
        driven: false,
      });
    }
    return nails;
  }

  // ──────────────────────────────────────────
  // IArea 実装
  // ──────────────────────────────────────────

  /**
   * このエリアは地面が常に floorY。
   * 釘自体はプレイヤーの足元を変えない（視覚的なターゲットとして機能する）。
   *
   * @param _playerX - 未使用
   */
  getGroundY(_playerX: number): number {
    return this.floorY;
  }

  /**
   * 打鍵イベント: 次の釘へのジャンプを開始する。
   *
   *   correct=false → 何もしない
   *   correct=true  →
   *     現在 idle かつ grounded なら、次の未打ち込み釘へジャンプ。
   *
   *   ── vel.x の計算 ──
   *   T = 2 * vy / GRAVITY_ABS（放物線の飛行時間）とすると
   *   vel.x = (nail.x - player.pos.x) / T
   *   → 圧力に関わらず、ちょうど nail.x に着地する。
   *
   * @param pressure - 打鍵圧 0.0〜1.0
   * @param correct  - 正しいキーかどうか
   */
  onKeyPress(pressure: number, correct: boolean): void {
    if (!correct) return;
    if (!this.player.isGrounded) return;   // 空中ではジャンプ不可
    if (this.phase !== 'idle') return;      // バウンス中は受け付けない

    // 次の未打ち込み釘を探す
    const nextIdx = this.nails.findIndex(n => !n.driven);
    if (nextIdx === -1) return; // 全て打ち込み済み

    const nail = this.nails[nextIdx];
    const dist = nail.x - this.player.pos.x; // 進む水平距離

    // ジャンプ初速（下限をクランプして vel.x が巨大になるのを防ぐ）
    const vy = Math.max(pressure * MAX_JUMP_VY, MIN_JUMP_VY);
    const flightTime = 2 * vy / GRAVITY_ABS;
    const vx = dist / flightTime;

    // 状態を保存
    this.jumpStartX    = this.player.pos.x;
    this.jumpVY        = pressure * MAX_JUMP_VY; // 判定には実際の圧力を使う
    this.pendingNailIdx = nextIdx;
    this.phase          = 'forward';

    // プレイヤーのジャンプを直接設定
    // （Player.jump() は vel.y のみ設定するため、vel.x も手動設定）
    this.player.vel.x  = vx;
    this.player.vel.y  = vy;
    this.player.state  = 'jumping';
  }

  /**
   * 1フレーム分の状態を更新する。
   *
   * 処理内容:
   *   1. 着地検出（wasGrounded: false → true の瞬間）
   *   2. 着地時に onLanded() を呼んで判定・バウンス・死亡を処理
   *
   * @param _dt    - 経過時間（このエリアはプレイヤーの物理は Player が担うため未使用）
   * @param player - プレイヤーへの参照
   */
  update(_dt: number, player: Player): void {
    // 死亡中はフェーズをリセット（die 後のリスポーンで idle に戻す）
    if (player.isDead) {
      this.wasGrounded = true;
      return;
    }

    // 着地検出
    const nowGrounded = player.isGrounded;
    if (!this.wasGrounded && nowGrounded) {
      this.onLanded(player);
    }
    this.wasGrounded = nowGrounded;
  }

  /**
   * 着地したときに釘判定・バウンス・死亡を処理する（内部ヘルパー）。
   *
   * ── phase === 'returning' ──
   *   バウンスバックで元の位置に戻ってきた → X を jumpStartX にスナップして idle へ。
   *
   * ── phase === 'forward' ──
   *   釘へのジャンプが着地した → 最大高さを計算して判定:
   *     成功: nail.driven = true, チェックポイント更新, idle へ
   *     弱すぎ: バウンスバックジャンプを開始
   *     強すぎ: die, nail.driven = true, 次の釘の手前にリスポーン設定
   *
   * @param player - 着地したプレイヤー
   */
  private onLanded(player: Player): void {
    if (this.phase === 'returning') {
      // バウンスバックで戻ってきた → 元の位置にスナップして終了
      player.pos.x = this.jumpStartX;
      player.vel.x = 0;
      this.phase = 'idle';
      return;
    }

    if (this.phase !== 'forward') return;

    const nail = this.nails[this.pendingNailIdx];

    // プレイヤーの X を釘の位置にスナップ（浮動小数点誤差を排除）
    player.pos.x = nail.x;
    player.vel.x = 0;

    // ── 理論的な最大ジャンプ高さを計算 ──
    // maxH = vel.y² / (2 * GRAVITY_ABS)（初速が jumpVY のときの頂点高さ）
    const maxH = (this.jumpVY * this.jumpVY) / (2 * GRAVITY_ABS);

    const minH = nail.length - NAIL_TOLERANCE;
    const maxOk = nail.length + NAIL_TOLERANCE;

    if (maxH >= minH && maxH <= maxOk) {
      // ── 成功: 釘を打ち込む ──
      nail.driven = true;
      // チェックポイントを現在位置（次の釘へのジャンプ起点）に更新
      this.respawnPoint = { x: nail.x, y: this.floorY };
      player.setCheckpoint(this.respawnPoint);
      this.phase = 'idle';

    } else if (maxH < minH) {
      // ── 弱すぎ: バウンスバック ──
      // 前のジャンプの水平距離（= nail.x - jumpStartX）を同じ時間で逆方向に飛ぶ。
      // バウンス飛行時間 T = 2 * BOUNCE_VY / GRAVITY_ABS
      // vx = -(nail.x - jumpStartX) / T
      const dist = nail.x - this.jumpStartX;
      const bounceFlightTime = 2 * BOUNCE_VY / GRAVITY_ABS;
      const bounceVX = -dist / bounceFlightTime; // 負値（左方向）

      this.phase = 'returning';
      player.vel.x  = bounceVX;
      player.vel.y  = BOUNCE_VY;
      player.state  = 'jumping'; // Player.update が次フレームから重力を適用

    } else {
      // ── 強すぎ: 釘は打ち込まれるが死亡 ──
      nail.driven = true;

      // 次の釘の手前にリスポーン地点を設定（"次の釘へリスポーン"）
      const nextIdx = this.pendingNailIdx + 1;
      if (nextIdx < this.nails.length) {
        // 次の釘へのジャンプ起点 = 次の釘の X - NAIL_SPACING
        this.respawnPoint = {
          x: this.nails[nextIdx].x - NAIL_SPACING,
          y: this.floorY,
        };
      } else {
        // 最後の釘を強すぎで打った場合 → 最後の釘の上にリスポーン
        this.respawnPoint = { x: nail.x, y: this.floorY };
      }
      player.setCheckpoint(this.respawnPoint);
      this.phase = 'idle';
      player.die();
    }
  }

  /**
   * エリアを描画する。
   *
   * ── 描画要素 ──
   *   地面本体（緑）       : 画面全幅
   *   地面上面（草の緑）   : 上面だけ明るい帯
   *   未打ち込みの釘       : シャフト（茶〜灰）+ ヘッド（暗い）+ 長さヒント
   *   打ち込み済みの釘     : ヘッドだけが床面にわずかに残る（打ち込み完了の視覚）
   *
   * @param renderer - WebGL描画クラス
   * @param camera   - 視錐台カリング用
   */
  render(renderer: Renderer, camera: Camera): void {
    const camLeft  = camera.position.x - camera.width  / 2;
    const camRight = camera.position.x + camera.width  / 2;

    // ── 地面 ──
    if (renderer.hasTexture('ground')) {
      const tilesX = camera.width / this.floorY;
      renderer.drawImage('ground', camLeft, 0, camera.width, this.floorY, tilesX, 1);
    } else {
      renderer.drawRect(camLeft, 0, camera.width, this.floorY, 0.25, 0.62, 0.18);
      renderer.drawRect(camLeft, this.floorY - 6, camera.width, 6, 0.35, 0.80, 0.25);
    }

    // ── 釘 ──
    for (const nail of this.nails) {
      const centerX = nail.x;

      // カリング
      if (centerX + NAIL_HEAD_W / 2 < camLeft) continue;
      if (centerX - NAIL_HEAD_W / 2 > camRight) continue;

      if (nail.driven) {
        // 打ち込み済み: ヘッドだけが地面にわずかに沈んで見える
        if (renderer.hasTexture('nail')) {
          renderer.drawImage(
            'nail',
            centerX - NAIL_HEAD_W / 2,
            this.floorY - NAIL_HEAD_H + 2,
            NAIL_HEAD_W, NAIL_HEAD_H,
          );
          // 暗いオーバーレイで「打ち込まれた」感を出す
          renderer.drawRect(
            centerX - NAIL_HEAD_W / 2,
            this.floorY - NAIL_HEAD_H + 2,
            NAIL_HEAD_W, NAIL_HEAD_H,
            0, 0, 0, 0.55,
          );
        } else {
          renderer.drawRect(
            centerX - NAIL_HEAD_W / 2,
            this.floorY - NAIL_HEAD_H + 2,
            NAIL_HEAD_W, NAIL_HEAD_H,
            0.30, 0.22, 0.15,
          );
        }
      } else {
        // ── 未打ち込みの釘 ──
        const nailH = nail.length + NAIL_HEAD_H;
        const nailY = this.floorY - NAIL_HEAD_H; // 頭の下端を基準に

        if (renderer.hasTexture('nail')) {
          renderer.drawImage('nail', centerX - NAIL_HEAD_W / 2, nailY, NAIL_HEAD_W, nailH);
        } else {
          // シャフト（軸）
          renderer.drawRect(
            centerX - NAIL_SHAFT_W / 2, this.floorY,
            NAIL_SHAFT_W, nail.length,
            0.62, 0.55, 0.45,
          );
          renderer.drawRect(centerX - NAIL_SHAFT_W / 2, this.floorY, 2, nail.length, 0.80, 0.75, 0.65);
          renderer.drawRect(centerX + NAIL_SHAFT_W / 2 - 2, this.floorY, 2, nail.length, 0.40, 0.34, 0.26);
          renderer.drawRect(centerX - 3, this.floorY + nail.length, 6, 6, 0.72, 0.65, 0.55);
          renderer.drawRect(
            centerX - NAIL_HEAD_W / 2, this.floorY - NAIL_HEAD_H,
            NAIL_HEAD_W, NAIL_HEAD_H,
            0.35, 0.28, 0.20,
          );
          renderer.drawRect(
            centerX - NAIL_HEAD_W / 2 + 2, this.floorY - 3,
            NAIL_HEAD_W - 4, 2,
            0.55, 0.48, 0.40,
          );
        }

        // ── 長さのヒント（細いゲージバー）──（テクスチャ有無に関わらず表示）
        const hintX = centerX + NAIL_HEAD_W / 2 + 4;
        renderer.drawRect(hintX, this.floorY, 2, nail.length, 1.0, 0.85, 0.20, 0.35);
        renderer.drawRect(hintX - 2, this.floorY + nail.length - 1, 6, 2, 1.0, 0.85, 0.20, 0.55);
      }

      // ── プレイヤーが向かっている釘のハイライト ──
      if (this.phase === 'forward' && this.pendingNailIdx === this.nails.indexOf(nail)) {
        // アクティブな釘を囲む薄い枠で「今ここが目標」と示す
        renderer.drawRect(
          centerX - NAIL_HEAD_W / 2 - 4,
          this.floorY - 4,
          NAIL_HEAD_W + 8, nail.length + 8,
          1.0, 1.0, 0.3, 0.15, // 薄い黄色のオーバーレイ
        );
      }
    }

    // ── 現在のジャンプ起点のマーカー ──
    // プレイヤーが idle のとき、次に飛ぶ始点を床にわずかな色で示す
    if (this.phase === 'idle') {
      renderer.drawRect(
        this.player.pos.x + PLAYER_WIDTH / 2 - 6,
        this.floorY - 3,
        12, 3,
        0.4, 0.8, 1.0, 0.5, // 薄い水色マーカー
      );
    }
  }

  /**
   * 全ての釘を打ち込んだらクリア。
   */
  isCleared(): boolean {
    return this.nails.every(n => n.driven);
  }

  /** 最後に更新されたリスポーン地点を返す */
  getRespawnPoint(): Vec2 {
    return { ...this.respawnPoint };
  }
}
