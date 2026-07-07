/**
 * ValleyArea.ts
 * 谷のエリアの実装。
 *
 * ── ルール（README より） ──
 *   ・キーを打つとプレイヤーは一定高度でジャンプする
 *   ・キーを打つ強さによって、ジャンプする距離が変わる
 *   ・地面に空いているランダムな大きさの穴をジャンプによって越えていく
 *   ・穴に落ちたら穴の手前の陸地にリスポーン
 *   ・キーを押し間違えたらジャンプできない
 *
 * ── ObstacleArea との違い ──
 *
 *   ObstacleArea             ValleyArea
 *   ─────────────────         ─────────────────────
 *   autoMove = true          autoMove = false（その場で立ち止まる）
 *   jump mode = 'height'     jump mode = 'distance'
 *   圧力 → ジャンプ高さ       圧力 → ジャンプ水平距離
 *   地面は平坦               地面に穴がある（getGroundY が変わる）
 *   死因: 障害物に接触         死因: 穴に落下
 *
 * ── 物理の仕組み ──
 *
 *   プレイヤーが「穴の上」にいるとき、getGroundY() は -Infinity を返す。
 *   main.ts が player.update(dt, area.getGroundY(x), false) と呼ぶため、
 *   地面衝突が起きずプレイヤーが落下し続ける。
 *   一定深さまで落ちたら player.die() を呼んでリスポーンさせる。
 *
 * ── 座標系 ──
 *
 *   プラットフォーム  穴          プラットフォーム
 *   ────────────    　            ────────────
 *               │←pit_width→│
 *               │            │
 *               │  (奈落)    │   ← PIT_DEPTH まで落ちると die()
 *               └────────────┘   ← FLOOR_Y - PIT_DEPTH
 */

import type { IArea }    from './IArea.ts';
import type { Player }   from '../game/Player.ts';
import type { Renderer } from '../core/Renderer.ts';
import type { Camera }   from '../core/Camera.ts';
import type { Vec2 }     from '../core/Vec2.ts';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** プラットフォームの最小幅 (px)。プレイヤーが着地して止まれる余裕 */
const PLATFORM_W_MIN = 140;

/** プラットフォームの最大幅 (px) */
const PLATFORM_W_MAX = 220;

/**
 * 穴の最小幅 (px)。
 * Player の distance ジャンプで MAX_JUMP_VX=700, FIXED_JUMP_VY=500 のとき
 * 飛距離は pressure * MAX_VX * (2*vy/g) ≈ pressure * 700 * 0.71 ≈ pressure * 500px
 * 穴幅 150px → pressure 0.3 で越えられる
 */
const PIT_W_MIN = 150;

/** 穴の最大幅 (px)。pressure ≈ 0.8 が必要 */
const PIT_W_MAX = 400;

/** 穴の深さ (px)。FLOOR_Y から下方向 */
const PIT_DEPTH = 140;

/**
 * 死亡判定ライン。FLOOR_Y - PIT_DEPTH より少し上で die() を呼ぶ。
 * 視覚的に「底に近づいたら死亡」となる。
 */
const DEATH_OFFSET = 20;

/** リスポーン時のプラットフォームとプレイヤーの右端からの余白 */
const RESPAWN_MARGIN = 50;

/** エリア最後のプラットフォーム通過後の余裕距離 */
const GOAL_MARGIN = 200;

// ──────────────────────────────────────────
// 内部データ型
// ──────────────────────────────────────────

/**
 * 1枚のプラットフォーム（陸地）。
 * 穴と穴の間に存在し、プレイヤーが着地できる足場。
 */
type Platform = {
  /** プラットフォームの左端 X */
  x: number;
  /** プラットフォームの幅 */
  width: number;
};

// ──────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────

/** [min, max] の範囲で一様乱数を返す */
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ──────────────────────────────────────────
// ValleyArea クラス
// ──────────────────────────────────────────

export class ValleyArea implements IArea {
  // ── IArea 必須プロパティ ──
  readonly startX: number;
  readonly endX: number;

  /**
   * 谷エリアではプレイヤーは自動前進しない。
   * キーを打ってジャンプし、飛距離で穴を越える。
   */
  readonly autoMove = false;

  // ── エリア設定 ──
  private readonly floorY: number;

  /** 死亡判定ライン（FLOOR_Y - PIT_DEPTH + DEATH_OFFSET） */
  private readonly deathY: number;

  // ── ゲーム状態 ──
  private platforms: Platform[];
  private player: Player;
  private respawnPoint: Vec2;

  /**
   * 前フレームのプレイヤー着地状態。
   * false → true に切り替わった瞬間を「着地」として検出し、
   * どのプラットフォームに乗ったかを判定してチェックポイントを更新する。
   */
  private wasGrounded: boolean;

  /**
   * @param player    - プレイヤーへの参照
   * @param startX    - エリア開始 X 座標
   * @param pitCount  - 穴の数（プラットフォーム数 = pitCount + 1）
   * @param floorY    - 地面の上面 Y 座標
   */
  constructor(
    player: Player,
    startX: number,
    pitCount: number,
    floorY: number,
  ) {
    this.player  = player;
    this.startX  = startX;
    this.floorY  = floorY;
    this.deathY  = floorY - PIT_DEPTH + DEATH_OFFSET;

    this.platforms   = this.generatePlatforms(startX, pitCount);
    this.wasGrounded = true;

    // 最初のリスポーン地点: 最初のプラットフォームの右端手前
    const first = this.platforms[0];
    this.respawnPoint = {
      x: first.x + first.width - RESPAWN_MARGIN,
      y: floorY,
    };

    // エリア終端: 最後のプラットフォームの右端 + ゴールマージン
    const last = this.platforms[this.platforms.length - 1];
    this.endX = last.x + last.width + GOAL_MARGIN;
  }

  // ──────────────────────────────────────────
  // プラットフォーム生成
  // ──────────────────────────────────────────

  /**
   * ランダムな幅のプラットフォームと穴を交互に配置する。
   *
   *   [Platform 0] [Pit 0] [Platform 1] [Pit 1] ... [Platform N]
   *
   * @param startX   - 最初のプラットフォームの左端 X
   * @param pitCount - 穴の数
   */
  private generatePlatforms(startX: number, pitCount: number): Platform[] {
    const platforms: Platform[] = [];
    let x = startX;

    for (let i = 0; i <= pitCount; i++) {
      const w = randBetween(PLATFORM_W_MIN, PLATFORM_W_MAX);
      platforms.push({ x, width: w });
      x += w;

      if (i < pitCount) {
        // 穴: プラットフォーム間のすき間
        x += randBetween(PIT_W_MIN, PIT_W_MAX);
      }
    }

    return platforms;
  }

  // ──────────────────────────────────────────
  // IArea 実装
  // ──────────────────────────────────────────

  /**
   * プレイヤーの X 座標が「プラットフォームの上」か「穴の上」かを判定し、
   * 対応する地面 Y を返す。
   *
   *   プラットフォームの上 → floorY（通常の地面衝突）
   *   穴の上               → -Infinity（地面衝突なし → 落下）
   *
   * main.ts が毎フレーム `player.update(dt, area.getGroundY(x), area.autoMove)`
   * を呼ぶことで、穴の上ではプレイヤーが落下するようになる。
   *
   * @param playerX - プレイヤーの左端 X 座標
   */
  getGroundY(playerX: number): number {
    // プレイヤーの中心 X で判定（足元が穴にかかっているかどうか）
    const cx = playerX + 15; // PLAYER_WIDTH / 2 = 15

    for (const p of this.platforms) {
      if (cx >= p.x && cx < p.x + p.width) {
        return this.floorY; // プラットフォームの上
      }
    }
    return -Infinity; // 穴の上 → 落下
  }

  /**
   * 打鍵イベント: プレイヤーをジャンプさせる。
   *
   *   correct=true  → player.jump(pressure, 'distance')
   *     打鍵圧が高い → 遠くへ飛ぶ（大きな穴を越えられる）
   *     打鍵圧が低い → 近くに着地（小さな穴しか越えられない）
   *
   *   correct=false → 何もしない（ジャンプ不可）
   *
   * Player.jump() が内部で `state === 'grounded'` チェックをするため、
   * 空中にいるときは自動的に無視される。
   */
  onKeyPress(pressure: number, correct: boolean): void {
    if (!correct) return;
    this.player.jump(pressure, 'distance');
  }

  /**
   * 1フレーム分の状態を更新する。
   *
   * 処理内容:
   *   1. 落下死亡チェック: pos.y < deathY なら player.die()
   *   2. 着地検出: wasGrounded=false→true の瞬間を検出
   *   3. 着地プラットフォーム特定 → チェックポイント更新
   *
   * @param _dt    - 経過時間（このエリアでは物理演算は Player が行うため未使用）
   * @param player - プレイヤーへの参照
   */
  update(_dt: number, player: Player): void {
    // 死亡中は判定しない
    if (player.isDead) {
      this.wasGrounded = true; // リスポーン後すぐ着地扱いにしないため
      return;
    }

    // ── 1. 落下死亡チェック ──
    if (player.pos.y < this.deathY) {
      player.die();
      return;
    }

    // ── 2. 着地検出（wasGrounded: false → true）──
    const nowGrounded = player.isGrounded;

    if (!this.wasGrounded && nowGrounded) {
      // 着地した瞬間 → どのプラットフォームに乗ったか特定
      this.onLanded(player);
    }

    this.wasGrounded = nowGrounded;
  }

  /**
   * 着地したときにチェックポイントを更新する（内部ヘルパー）。
   *
   * 着地したプラットフォームのインデックスを求め、
   * そのプラットフォームの左端付近をリスポーン地点にする。
   * これにより「穴に落ちたら穴の手前の陸地にリスポーン」が実現される。
   *
   * @param player - 着地したプレイヤー
   */
  private onLanded(player: Player): void {
    const cx = player.pos.x + 15; // プレイヤー中心 X

    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (cx >= p.x && cx < p.x + p.width) {
        // このプラットフォームに着地
        // リスポーン地点 = プラットフォームの右端から RESPAWN_MARGIN 手前
        // （プラットフォームの中央付近に戻る）
        const rx = Math.max(p.x + 10, p.x + p.width - RESPAWN_MARGIN);
        this.respawnPoint = { x: rx, y: this.floorY };
        player.setCheckpoint(this.respawnPoint);
        return;
      }
    }
  }

  /**
   * プラットフォームと穴を描画する。
   *
   * ── 描画要素 ──
   *   プラットフォーム表面（緑）: drawRect(x, 0, w, floorY)
   *   プラットフォーム側面（茶）: 左右にわずかな立体感
   *   穴の背景（暗い）: 穴の下に深さを表す暗い矩形
   *   穴の縁（影）: 穴の両端を少し暗くして「崖」感を演出
   *
   * @param renderer - WebGL描画クラス
   * @param camera   - カリング用
   */
  render(renderer: Renderer, camera: Camera): void {
    const camLeft  = camera.position.x - camera.width  / 2;
    const camRight = camera.position.x + camera.width  / 2;

    // ── 穴の背景（奈落）を先に描画 ──
    // プラットフォームで覆われるので、全体にわたって暗い帯を引く
    renderer.drawRect(
      camLeft,
      this.floorY - PIT_DEPTH,
      camera.width,
      PIT_DEPTH,
      0.06, 0.04, 0.10, // 暗い紫がかった黒
    );

    // ── プラットフォームを手前に描画 ──
    for (const p of this.platforms) {
      // 画面外はスキップ（カリング）
      if (p.x + p.width < camLeft) continue;
      if (p.x > camRight) break;

      // プラットフォーム本体
      if (renderer.hasTexture('ground')) {
        const tilesX = p.width / this.floorY;
        renderer.drawImage('ground', p.x, 0, p.width, this.floorY, tilesX, 1);
      } else {
        renderer.drawRect(p.x, 0, p.width, this.floorY, 0.25, 0.62, 0.18);
        // プラットフォーム上面（明るい緑の草）
        renderer.drawRect(p.x, this.floorY - 8, p.width, 8, 0.35, 0.80, 0.25);
      }

      // ── 崖の縁（穴側の影）──
      // 左崖: プラットフォームの左端に暗い帯
      renderer.drawRect(
        p.x, this.floorY - PIT_DEPTH,
        12, PIT_DEPTH,
        0.15, 0.10, 0.05, 0.7,
      );
      // 右崖: プラットフォームの右端に暗い帯
      renderer.drawRect(
        p.x + p.width - 12, this.floorY - PIT_DEPTH,
        12, PIT_DEPTH,
        0.15, 0.10, 0.05, 0.7,
      );
    }
  }

  /**
   * プレイヤーが最後のプラットフォームを越えてエリア終端に到達したらクリア。
   */
  isCleared(): boolean {
    return this.player.pos.x >= this.endX;
  }

  /** 最後に着地したプラットフォームの手前位置を返す */
  getRespawnPoint(): Vec2 {
    return { ...this.respawnPoint };
  }
}
