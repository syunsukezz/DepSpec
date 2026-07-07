/**
 * ObstacleArea.ts
 * 障害物エリアの実装。
 *
 * ── ルール（README より） ──
 *   ・プレイヤーは自動で右へ進む（一定速度）
 *   ・キーを打つとジャンプ。打鍵圧 → ジャンプの高さが変わる
 *   ・障害物は「下から生える柱」と「上から垂れる柱」がペアで出現
 *   ・弱く打つ = 低ジャンプ（下の柱を越えられない）
 *   ・強く打つ = 高ジャンプ（上の柱に当たる）
 *   ・ちょうどいい圧力でギャップを通り抜けるのがコツ
 *   ・障害物に当たると、当たった障害物の手前でリスポーン
 *   ・キーを押し間違えたらジャンプしない
 *
 * ── 座標系 ──
 *
 *   CEILING_Y ──────────────────────────────────
 *               ████  ← 上の障害物（天井から垂れる）
 *               ████
 *               （gap: ここをくぐる）
 *               ████  ← 下の障害物（床から生える）
 *   FLOOR_Y  ──────────────────────────────────
 *
 *   Y 上向き座標系:
 *     下の障害物: y = FLOOR_Y, height = bottomH
 *     上の障害物: y = FLOOR_Y + bottomH + gapH, height = topH
 *
 * ── ジャンプ圧力のガイドライン ──
 *
 *   pressure 0.0 → ジャンプなし（そのまま衝突）
 *   pressure 低め → 低いジャンプ（下の障害物に当たる可能性）
 *   pressure 適正 → ギャップを通り抜ける
 *   pressure 高め → 高すぎて上の障害物に当たる
 */

import type { IArea }    from './IArea.ts';
import type { Player }   from '../game/Player.ts';
import type { Renderer } from '../core/Renderer.ts';
import type { Camera }   from '../core/Camera.ts';
import type { Vec2 }     from '../core/Vec2.ts';
import type { AABB }     from '../game/Player.ts';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** 障害物の幅 (px) */
const OBSTACLE_WIDTH = 32;

/** 障害物ペアの間隔 (px)。プレイヤーが準備できる距離 */
const OBSTACLE_SPACING = 320;

/** 最初の障害物までの余裕距離 (px)。ゲーム開始直後の猶予 */
const FIRST_OBSTACLE_OFFSET = 400;

/** 最後の障害物を越えた後のゴールまでの距離 (px) */
const GOAL_MARGIN = 300;

/** リスポーン地点と障害物の間の余白 (px) */
const RESPAWN_MARGIN = 80;

/** ギャップの最小高さ (px)。プレイヤー高さ(45) + 余白 */
const GAP_MIN = 105;

/** ギャップの最大高さ (px)。大きいほど通りやすい */
const GAP_MAX = 145;

/** 下の障害物の最小高さ (px) */
const BOTTOM_H_MIN = 60;

/** 下の障害物の最大高さ (px) */
const BOTTOM_H_MAX = 180;

// ──────────────────────────────────────────
// 障害物ペアの内部データ型
// ──────────────────────────────────────────

/**
 * 障害物ペア1つ分のデータ。
 * 「下の柱」と「上の柱」が1セットで、間にギャップがある。
 */
type ObstaclePair = {
  /** 障害物の左端 X 座標（ワールド座標） */
  x: number;

  /**
   * 下の障害物の高さ (px)。
   * 床 (FLOOR_Y) から FLOOR_Y + bottomH まで描画される。
   */
  bottomH: number;

  /**
   * ギャップの高さ (px)。
   * プレイヤーはここを通り抜けなければならない。
   */
  gapH: number;

  /**
   * プレイヤーがこの障害物を通過済みかどうか。
   * true になったらチェックポイントをこの障害物の右側に更新する。
   */
  cleared: boolean;
};

// ──────────────────────────────────────────
// ランダム生成ユーティリティ
// ──────────────────────────────────────────

/**
 * [min, max] の範囲で一様乱数を返す。
 */
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ──────────────────────────────────────────
// ObstacleArea クラス
// ──────────────────────────────────────────

export class ObstacleArea implements IArea {
  // ── IArea 必須プロパティ ──
  readonly startX: number;
  readonly endX: number;

  /** 障害物エリアは常に自動前進 */
  readonly autoMove = true;

  /**
   * 障害物エリアの地面は平坦（常に floorY を返す）。
   * 障害物は地面より上に立っているので、地面衝突は通常通り。
   */
  getGroundY(_playerX: number): number {
    return this.floorY;
  }

  // ── エリア設定 ──
  /** 床の Y 座標（プレイヤーが立つ面）*/
  private readonly floorY: number;

  /** 天井の Y 座標（上の障害物の上端）*/
  private readonly ceilingY: number;

  // ── ゲーム状態 ──
  /** 生成した障害物ペアの配列 */
  private obstacles: ObstaclePair[];

  /** プレイヤーへの参照（onKeyPress でジャンプさせるために保持）*/
  private player: Player;

  /**
   * 現在のリスポーン地点。
   * プレイヤーが障害物を越えるたびに右へ更新される。
   */
  private respawnPoint: Vec2;

  /**
   * @param player         - プレイヤーの参照
   * @param startX         - エリアの開始 X 座標
   * @param obstacleCount  - 生成する障害物ペアの数
   * @param floorY         - 床の上面 Y 座標
   * @param ceilingY       - 天井の Y 座標
   */
  constructor(
    player: Player,
    startX: number,
    obstacleCount: number,
    floorY: number,
    ceilingY: number,
  ) {
    this.player    = player;
    this.startX    = startX;
    this.floorY    = floorY;
    this.ceilingY  = ceilingY;

    // エリアの終端（最後の障害物 + GOAL_MARGIN）
    this.endX = startX
      + FIRST_OBSTACLE_OFFSET
      + obstacleCount * OBSTACLE_SPACING
      + GOAL_MARGIN;

    // 最初のリスポーン地点はエリア開始地点
    this.respawnPoint = { x: startX, y: floorY };

    // 障害物を生成
    this.obstacles = this.generateObstacles(startX, obstacleCount);
  }

  // ──────────────────────────────────────────
  // 障害物生成
  // ──────────────────────────────────────────

  /**
   * ランダムな高さの障害物ペアを N 個生成する。
   *
   * 各ペアは以下の制約を満たす:
   *   - ギャップ高さ: GAP_MIN 〜 GAP_MAX
   *   - 下の障害物高さ: BOTTOM_H_MIN 〜 BOTTOM_H_MAX
   *   - 下の障害物 + ギャップ < プレイエリア高さ
   *     （上の障害物が最低でも 20px 残るように）
   *
   * @param startX - 最初の障害物の X 位置の基準
   * @param count  - 生成数
   */
  private generateObstacles(startX: number, count: number): ObstaclePair[] {
    const playAreaH = this.ceilingY - this.floorY; // プレイエリアの高さ
    const obstacles: ObstaclePair[] = [];

    for (let i = 0; i < count; i++) {
      const x = startX + FIRST_OBSTACLE_OFFSET + i * OBSTACLE_SPACING;

      // ギャップ高さをランダムに決定
      const gapH = randBetween(GAP_MIN, GAP_MAX);

      // 下の障害物の高さをランダムに決定
      // 上の障害物に最低 20px が残るよう制約
      const maxBottomH = Math.min(BOTTOM_H_MAX, playAreaH - gapH - 20);
      const bottomH    = randBetween(BOTTOM_H_MIN, maxBottomH);

      obstacles.push({ x, bottomH, gapH, cleared: false });
    }

    return obstacles;
  }

  // ──────────────────────────────────────────
  // IArea 実装
  // ──────────────────────────────────────────

  /**
   * 打鍵イベントを受け取りプレイヤーをジャンプさせる。
   *
   *   correct=true  → player.jump(pressure, 'height')
   *                    打鍵圧が高いほど高くジャンプ
   *   correct=false → 何もしない（ジャンプ不可）
   */
  onKeyPress(pressure: number, correct: boolean): void {
    if (!correct) return; // 打ち間違い: ジャンプしない
    this.player.jump(pressure, 'height');
  }

  /**
   * 衝突判定・チェックポイント更新・クリア判定を行う。
   *
   * ── 衝突判定の仕組み ──
   *   各障害物ペアについて、プレイヤーの AABB と
   *   「下の障害物 AABB」「上の障害物 AABB」を比較する。
   *   重なりがあれば player.die() を呼ぶ。
   *
   *   player.overlaps(aabb) が使えるのは Player.ts で定義済みのため。
   *
   * ── チェックポイント更新の仕組み ──
   *   プレイヤーが障害物の右端を越えた（通過した）瞬間に
   *   その障害物の左端 - RESPAWN_MARGIN をリスポーン地点にする。
   *   こうすることで「当たった障害物の手前」が常に最新のリスポーンになる。
   *
   *   例: 障害物 A, B, C を順に越えていく場合
   *     A を越えた → respawnPoint = A の手前
   *     B を越えた → respawnPoint = B の手前
   *     C に当たった → B の手前へリスポーン（直前の安全地点）
   *
   * @param _dt    - 経過時間（このエリアでは未使用）
   * @param player - プレイヤーの参照
   */
  update(_dt: number, player: Player): void {
    // 死亡中は衝突判定しない（リスポーン中にめり込むのを防ぐ）
    if (player.isDead) return;

    for (const obs of this.obstacles) {
      // ── チェックポイント更新 ──
      // プレイヤーの右端が障害物の右端を越えたら「通過」とみなす
      const playerRight = player.pos.x + 30; // PLAYER_WIDTH = 30
      const obsRight    = obs.x + OBSTACLE_WIDTH;

      if (!obs.cleared && playerRight > obsRight) {
        obs.cleared = true;
        // この障害物の直前を新たなリスポーン地点に更新
        this.respawnPoint = {
          x: obs.x - RESPAWN_MARGIN,
          y: this.floorY,
        };
        // Player のチェックポイントも同期
        player.setCheckpoint(this.respawnPoint);
      }

      // ── 衝突判定 ──
      // 通過済みの障害物とは衝突しない（めり込み防止）
      if (obs.cleared) continue;

      // 下の障害物 AABB
      const bottomAABB: AABB = {
        x: obs.x,
        y: this.floorY,
        w: OBSTACLE_WIDTH,
        h: obs.bottomH,
      };

      // 上の障害物 AABB
      // 上端は ceilingY。下端は ギャップの上端 (floorY + bottomH + gapH)。
      const topStart = this.floorY + obs.bottomH + obs.gapH;
      const topAABB: AABB = {
        x: obs.x,
        y: topStart,
        w: OBSTACLE_WIDTH,
        h: this.ceilingY - topStart,
      };

      // プレイヤーと障害物が重なっていたら死亡
      if (player.overlaps(bottomAABB) || player.overlaps(topAABB)) {
        player.die();
        return; // 同フレームで複数衝突しても1度だけ die() を呼ぶ
      }
    }
  }

  /**
   * 障害物・天井・床を描画する。
   *
   * ── カメラカリング ──
   *   カメラの左端 (camera.position.x - camera.width/2) より
   *   右端が左にある障害物と、右端より左端が右にある障害物は描画をスキップする。
   *   これにより画面外の障害物の drawRect 呼び出しを省略できる。
   *
   * ── 色 ──
   *   通常の障害物: 茶色 (0.5, 0.28, 0.06)
   *   通過済みの障害物: 暗い茶色（視覚的に「越えた」感を出す）
   *   天井バー: 濃いグレー
   */
  render(renderer: Renderer, camera: Camera): void {
    const camLeft  = camera.position.x - camera.width  / 2;
    const camRight = camera.position.x + camera.width  / 2;

    // ── 地面 ──
    const groundTilesX = camera.width / this.floorY; // floorY を 1 タイルの幅とみなす
    if (renderer.hasTexture('ground')) {
      renderer.drawImage('ground', camLeft, 0, camera.width, this.floorY, groundTilesX, 1);
    } else {
      renderer.drawRect(camLeft, 0, camera.width, this.floorY, 0.25, 0.62, 0.18);
    }

    // ── 天井バー ──
    renderer.drawRect(camLeft, this.ceilingY, camera.width, 20, 0.25, 0.25, 0.25);

    for (const obs of this.obstacles) {
      if (obs.x + OBSTACLE_WIDTH < camLeft) continue;
      if (obs.x > camRight) break;

      const topStart = this.floorY + obs.bottomH + obs.gapH;
      const topH     = this.ceilingY - topStart;

      if (renderer.hasTexture('wood')) {
        // 通過済みは半透明で表示
        const alpha = obs.cleared ? 0.45 : 1.0;

        // ── 下の障害物（wood テクスチャ） ──
        renderer.drawImage('wood', obs.x, this.floorY, OBSTACLE_WIDTH, obs.bottomH);
        if (obs.cleared) {
          renderer.drawRect(obs.x, this.floorY, OBSTACLE_WIDTH, obs.bottomH, 0, 0, 0, 1 - alpha);
        }

        // ── 上の障害物（wood テクスチャ、上下反転して縦に積む） ──
        renderer.drawImage('wood', obs.x, topStart, OBSTACLE_WIDTH, topH);
        if (obs.cleared) {
          renderer.drawRect(obs.x, topStart, OBSTACLE_WIDTH, topH, 0, 0, 0, 1 - alpha);
        }
      } else {
        const r = obs.cleared ? 0.30 : 0.50;
        const g = obs.cleared ? 0.15 : 0.28;
        const b = obs.cleared ? 0.03 : 0.06;
        renderer.drawRect(obs.x, this.floorY, OBSTACLE_WIDTH, obs.bottomH, r, g, b);
        renderer.drawRect(obs.x, topStart, OBSTACLE_WIDTH, topH, r, g, b);
      }
    }
  }

  /**
   * プレイヤーがエリアの終端を越えたらクリアとみなす。
   * 全障害物を越えた後に GOAL_MARGIN 分だけ進んだ地点。
   */
  isCleared(): boolean {
    return this.player.pos.x >= this.endX;
  }

  /**
   * 現在のリスポーン地点を返す。
   * 最後に通過した障害物の手前が返される。
   * まだ1つも越えていない場合はエリア開始地点。
   */
  getRespawnPoint(): Vec2 {
    return { ...this.respawnPoint };
  }
}
