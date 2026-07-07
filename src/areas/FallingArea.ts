/**
 * FallingArea.ts
 * 落下物のエリアの実装。
 *
 * ── ルール（README より） ──
 *   ・プレイヤーは自動で右へ進む（autoMove = true）
 *   ・天井からドーナツ・木箱・アンビルが落下してくる
 *   ・各落下物には「硬さ」範囲 [minP, maxP] がある
 *   ・キーを正しく打ち、圧力が範囲内   → 落下物に乗って安全に着地（成功）
 *   ・圧力が範囲より弱い               → 受け止められず押し潰される（die）
 *   ・圧力が範囲より強い               → 落下物を破壊するが自分も潰れる（die）
 *   ・落下物を避けずに受けると押し潰される（die）
 *   ・die 後は最後に成功した地点にリスポーン
 *
 * ── 他エリアとの違い ──
 *
 *   ObstacleArea             ValleyArea            FallingArea
 *   ─────────────            ─────────────         ─────────────────
 *   autoMove = true          autoMove = false       autoMove = true
 *   jump = 'height'          jump = 'distance'      なし（直接乗る）
 *   圧力 → 高さ              圧力 → 距離            圧力 → 硬さ判定
 *   地面は平坦               地面に穴あり            落下物に乗る
 *
 * ── インタラクションの仕組み ──
 *
 *   落下物は CEILING_HEIGHT の高さから FLOOR_Y まで一定速度で落下し続ける。
 *   底面 Y が INTERACT_Y_MAX を下回ると「インタラクションウィンドウ」に入る。
 *
 *   プレイヤーが落下物の X ゾーン内でキーを打つと:
 *     1. 落下物が窓内にある場合 → 硬さ判定
 *     2. 落下物がない場合       → 通常 height ジャンプ（障害物回避用）
 *
 *   成功（圧力 in [minP, maxP]):
 *     プレイヤーを落下物の上面に即座に配置し、riding 状態にする。
 *     以降 update() が毎フレームプレイヤーの Y を落下物上面に追従させる。
 *     落下物が FLOOR_Y に到達するとプレイヤーを床に降ろし、チェックポイント更新。
 *
 *   失敗・弱すぎ（pressure < minP）:
 *     player.die() を呼ぶ（押し潰し）。
 *
 *   失敗・強すぎ（pressure > maxP）:
 *     落下物を 'broken' 状態にして非表示にし、player.die() を呼ぶ。
 *
 * ── 座標系 ──
 *
 *   ↑ Y（上が正）
 *   │
 *   │  FLOOR_Y + CEILING_HEIGHT   ← 落下物スポーン
 *   │           ┌──────┐
 *   │           │ obj  │  ← bottomY が FLOOR_Y へ近づいていく
 *   │           └──────┘
 *   │  FLOOR_Y + OBJ_H            ← 乗ったときのプレイヤー足元 Y
 *   │  ─────────────────────────  FLOOR_Y（地面）
 *   └──────────────────────────────────────── X
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

/** 落下物の幅 (px) */
const OBJ_W = 64;

/** 落下物の高さ (px) */
const OBJ_H = 32;

/** 落下物のスポーン高さ（FLOOR_Y からの距離 px） */
const CEILING_HEIGHT = 380;

/** 落下物の落下速度 (px/s) */
const FALL_SPEED = 90;

/** 落下物の X 間隔 (px) */
const OBJ_SPACING = 360;

/**
 * インタラクションウィンドウ（FLOOR_Y からの距離 px）。
 * 落下物の底面がこの範囲に入ったときだけキー打鍵による判定を行う。
 *
 *   INTERACT_Y_MIN ≦ (obj.bottomY - FLOOR_Y) ≦ INTERACT_Y_MAX
 */
const INTERACT_Y_MIN = 25;
const INTERACT_Y_MAX = 190;

/**
 * プレイヤーの X 中心に対して落下物 X ゾーンを判定するときの横方向マージン (px)。
 * 少し余裕を持たせることで「ギリギリ間に合った」感を出す。
 */
const INTERACT_X_MARGIN = 18;

/** 'broken' 状態から天井へリセットするまでの待機時間 (秒) */
const BROKEN_DURATION = 1.8;

/** エリア末尾のゴールマージン (px) */
const GOAL_MARGIN = 320;

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/** 落下物の種類 */
type FallingObjectKind = 'donut' | 'crate' | 'anvil';

/**
 * 落下物の状態遷移:
 *   falling → riding  （成功）
 *   falling → broken  （強すぎ失敗）
 *   riding  → falling （床到達後リセット）
 *   broken  → falling （brokenTimer 経過後リセット）
 */
type FallingObjectState = 'falling' | 'riding' | 'broken';

/** 1個の落下物 */
type FallingObject = {
  kind: FallingObjectKind;
  /** 落下物の左端 X（固定） */
  x: number;
  /** 落下物の下面 Y。スポーン時は FLOOR_Y + CEILING_HEIGHT、FLOOR_Y へ向かって減少 */
  bottomY: number;
  state: FallingObjectState;
  /** 'broken' 状態の経過時間 (秒) */
  brokenTimer: number;
};

/**
 * 各落下物の種類ごとの定義。
 *   minP / maxP : 成功となる打鍵圧の範囲
 *   r / g / b   : 描画色（[0,1]）
 *
 * ── 硬さ設定の意図 ──
 *   donut: やわらかいので軽いタッチ [0.10, 0.45] でキャッチ可能。
 *   crate: 中程度 [0.35, 0.70]。
 *   anvil: とても硬い [0.60, 1.00]。強く叩かないと受け止められない。
 */
const KIND_DEFS: Record<FallingObjectKind, {
  minP: number;
  maxP: number;
  r: number; g: number; b: number;
}> = {
  donut: { minP: 0.10, maxP: 0.45, r: 0.88, g: 0.72, b: 0.48 }, // ベージュ・クリーム色
  crate: { minP: 0.35, maxP: 0.70, r: 0.62, g: 0.42, b: 0.22 }, // こげ茶（木箱）
  anvil: { minP: 0.60, maxP: 1.00, r: 0.28, g: 0.28, b: 0.33 }, // 濃い青灰（鉄）
};

// ──────────────────────────────────────────
// FallingArea クラス
// ──────────────────────────────────────────

export class FallingArea implements IArea {
  // ── IArea 必須プロパティ ──
  readonly startX: number;
  readonly endX: number;

  /**
   * 落下物エリアではプレイヤーが自動前進する（ObstacleArea と同じ）。
   * Player.update() に autoMove=true を渡すことで AUTO_MOVE_VX での右移動が有効になる。
   */
  readonly autoMove = true;

  // ── エリア設定 ──
  private readonly floorY: number;

  // ── ゲーム状態 ──
  private objects: FallingObject[];
  private player: Player;
  private respawnPoint: Vec2;

  /**
   * @param player   - プレイヤーへの参照
   * @param startX   - エリア開始 X 座標
   * @param objCount - 落下物の総数
   * @param floorY   - 地面の上面 Y 座標
   */
  constructor(
    player: Player,
    startX: number,
    objCount: number,
    floorY: number,
  ) {
    this.player  = player;
    this.startX  = startX;
    this.floorY  = floorY;

    this.objects = this.generateObjects(startX, objCount);

    // 初期リスポーン地点: エリア開始位置から少し右
    this.respawnPoint = { x: startX + 60, y: floorY };

    // エリア終端: 最後の落下物右端 + ゴールマージン
    const last = this.objects[this.objects.length - 1];
    this.endX = last.x + OBJ_W + GOAL_MARGIN;
  }

  // ──────────────────────────────────────────
  // 落下物生成
  // ──────────────────────────────────────────

  /**
   * 落下物を等間隔に配置する。
   * 各オブジェクトには位相差（phase）を持たせ、全てが同時に落下してくることを防ぐ。
   *
   * 種類の順序: donut → crate → anvil → donut → ... （サイクル）
   * 位相差 : i 番目は (i / objCount) * CEILING_HEIGHT 分だけ先行落下済み扱いにする。
   *
   * @param startX   - 最初の落下物の左端 X
   * @param objCount - 落下物の数
   */
  private generateObjects(startX: number, objCount: number): FallingObject[] {
    const kinds: FallingObjectKind[] = ['donut', 'crate', 'anvil'];
    const objects: FallingObject[] = [];

    for (let i = 0; i < objCount; i++) {
      const kind = kinds[i % kinds.length];

      // 位相差: 均等に初期 Y をずらす
      const phase  = (i / objCount) * CEILING_HEIGHT;
      const bottomY = this.floorY + CEILING_HEIGHT - phase;

      objects.push({
        kind,
        x: startX + 120 + i * OBJ_SPACING,
        bottomY,
        state: 'falling',
        brokenTimer: 0,
      });
    }

    return objects;
  }

  // ──────────────────────────────────────────
  // IArea 実装
  // ──────────────────────────────────────────

  /**
   * プレイヤーの X 座標に対応する地面 Y を返す。
   *
   *   riding 状態の落下物がプレイヤーの真下にある → その落下物の上面 Y
   *   それ以外                                    → FLOOR_Y（通常の地面）
   *
   * Player.update() がこの値を地面衝突に使うため、
   * 落下物の上面を「仮の地面」として扱うことでプレイヤーが乗る挙動を実現している。
   *
   * @param playerX - プレイヤーの左端 X 座標
   */
  getGroundY(playerX: number): number {
    const cx = playerX + PLAYER_WIDTH / 2; // プレイヤー中心 X

    for (const obj of this.objects) {
      if (obj.state !== 'riding') continue;
      if (cx >= obj.x && cx < obj.x + OBJ_W) {
        return obj.bottomY + OBJ_H; // 落下物の上面が仮地面
      }
    }
    return this.floorY;
  }

  /**
   * 打鍵イベント: 落下物の硬さ判定またはジャンプを行う。
   *
   *   correct=false → 何もしない
   *   correct=true  →
   *     プレイヤーの X ゾーン内かつインタラクションウィンドウ内に
   *     落下中のオブジェクトがある場合 → 硬さ判定:
   *       圧力 in [minP, maxP]  : 成功。落下物に直接乗せる。チェックポイント更新。
   *       圧力 < minP           : 失敗（弱すぎ）。player.die()。
   *       圧力 > maxP           : 失敗（強すぎ）。落下物を破壊 + player.die()。
   *     落下物がなければ通常 height ジャンプ（障害物を避けるための跳躍）。
   *
   * @param pressure - 打鍵圧 0.0〜1.0
   * @param correct  - 正しいキーかどうか
   */
  onKeyPress(pressure: number, correct: boolean): void {
    if (!correct) return;

    const cx = this.player.pos.x + PLAYER_WIDTH / 2; // プレイヤー中心 X

    for (const obj of this.objects) {
      if (obj.state !== 'falling') continue;

      // ── X ゾーンチェック ──
      const inXZone = cx >= obj.x - INTERACT_X_MARGIN
                   && cx <  obj.x + OBJ_W + INTERACT_X_MARGIN;
      if (!inXZone) continue;

      // ── インタラクションウィンドウチェック ──
      // 落下物の底面が床から INTERACT_Y_MIN〜INTERACT_Y_MAX の範囲にあるか
      const relY = obj.bottomY - this.floorY;
      if (relY < INTERACT_Y_MIN || relY > INTERACT_Y_MAX) continue;

      // ── 硬さ判定 ──
      const def = KIND_DEFS[obj.kind];

      if (pressure >= def.minP && pressure <= def.maxP) {
        // ── 成功: 落下物に乗る ──
        obj.state = 'riding';
        // プレイヤーを落下物の上面に即座に配置する
        // （getGroundY が obj.bottomY + OBJ_H を返すことで Player.update が押し付ける）
        this.player.pos.y = obj.bottomY + OBJ_H;
        // ジャンプ中・落下中だった速度をキャンセル（安定して乗るため）
        this.player.vel.y = 0;
        // チェックポイント更新（次の die 時にここへリスポーン）
        this.respawnPoint = { x: this.player.pos.x, y: this.floorY };
        this.player.setCheckpoint(this.respawnPoint);

      } else if (pressure > def.maxP) {
        // ── 失敗（強すぎ）: 破壊して自滅 ──
        obj.state = 'broken';
        obj.brokenTimer = 0;
        this.player.die();

      } else {
        // ── 失敗（弱すぎ）: 押し潰される ──
        this.player.die();
      }

      return; // 最初に見つかった落下物だけ判定して終了
    }

    // 落下物が近くにない場合は通常の height ジャンプ
    // （低い障害物などを飛び越すための補助）
    this.player.jump(pressure, 'height');
  }

  /**
   * 1フレーム分の状態を更新する。
   *
   * 処理内容:
   *   1. 各落下物を FALL_SPEED で下方向（y 減少）に移動
   *   2. riding: プレイヤーの Y を落下物上面に毎フレーム追従させる
   *      → プレイヤーが X ゾーンを外れたら自然落下に任せる
   *      → 落下物が FLOOR_Y に到達したらプレイヤーを床に降ろしてリセット
   *   3. falling: 落下物が FLOOR_Y に到達 + プレイヤーが X ゾーン内 → die（押し潰し）
   *   4. broken: タイマーが BROKEN_DURATION を超えたらリセット（天井へ戻す）
   *
   * @param dt     - 経過時間（秒）
   * @param player - プレイヤーへの参照
   */
  update(dt: number, player: Player): void {
    for (const obj of this.objects) {
      // ── broken: タイマー消化してリセット ──
      if (obj.state === 'broken') {
        obj.brokenTimer += dt;
        if (obj.brokenTimer >= BROKEN_DURATION) {
          this.resetObject(obj);
        }
        continue;
      }

      // ── 落下 ──（falling / riding 共通）
      obj.bottomY -= FALL_SPEED * dt;

      if (obj.state === 'riding') {
        // ── riding: プレイヤーを落下物上面に追従させる ──
        if (!player.isDead) {
          const cx = player.pos.x + PLAYER_WIDTH / 2;
          const onObject = cx >= obj.x && cx < obj.x + OBJ_W;

          if (onObject) {
            // 落下物と同じ速度で下降させる
            player.pos.y = obj.bottomY + OBJ_H;
          }
          // X ゾーン外に出た場合: 追従しない。
          // getGroundY が FLOOR_Y を返すため Player.update が自然落下させる。
        }

        // 落下物が床に到達
        if (obj.bottomY <= this.floorY) {
          obj.bottomY = this.floorY; // 床に合わせてクランプ
          if (!player.isDead) {
            const cx = player.pos.x + PLAYER_WIDTH / 2;
            if (cx >= obj.x && cx < obj.x + OBJ_W) {
              // 乗ったままなら安全に床へ降ろす
              player.pos.y = this.floorY;
              player.vel.y = 0;
            }
          }
          this.resetObject(obj);
        }

      } else {
        // state === 'falling': 誰も乗っていない落下中

        // 床に到達したとき
        if (obj.bottomY <= this.floorY) {
          // プレイヤーが X ゾーン内にいれば押し潰す
          if (!player.isDead) {
            const cx = player.pos.x + PLAYER_WIDTH / 2;
            const inXZone = cx >= obj.x - INTERACT_X_MARGIN
                         && cx <  obj.x + OBJ_W + INTERACT_X_MARGIN;
            if (inXZone) {
              player.die();
            }
          }
          this.resetObject(obj);
        }
      }
    }
  }

  /**
   * 落下物を天井位置へリセットする（内部ヘルパー）。
   * 破壊・床到達・どちらの場合も同じリセット処理。
   *
   * @param obj - リセットする落下物
   */
  private resetObject(obj: FallingObject): void {
    obj.bottomY     = this.floorY + CEILING_HEIGHT;
    obj.state       = 'falling';
    obj.brokenTimer = 0;
  }

  /**
   * 地面・落下物を描画する。
   *
   * ── 描画要素 ──
   *   地面本体（緑の土台）  : 画面全体に敷く
   *   地面上面（草の緑）    : 上面だけ明るい緑
   *   落下中オブジェクト    : 種類に応じた色
   *   乗っているオブジェクト: 少し明るくしてハイライト
   *   broken               : 描画なし（消滅演出）
   *
   * @param renderer - WebGL描画クラス
   * @param camera   - 視錐台カリング用
   */
  render(renderer: Renderer, camera: Camera): void {
    const camLeft  = camera.position.x - camera.width  / 2;
    const camRight = camera.position.x + camera.width  / 2;

    // ── 地面 ──
    renderer.drawRect(
      camLeft, 0,
      camera.width, this.floorY,
      0.25, 0.62, 0.18, // 緑（土台）
    );
    renderer.drawRect(
      camLeft, this.floorY - 6,
      camera.width, 6,
      0.35, 0.80, 0.25, // 明るい緑（草）
    );

    // ── 落下物 ──
    for (const obj of this.objects) {
      // broken は描画しない
      if (obj.state === 'broken') continue;

      // カリング: 画面外をスキップ
      if (obj.x + OBJ_W < camLeft) continue;
      if (obj.x > camRight) continue;

      const def = KIND_DEFS[obj.kind];
      let r = def.r, g = def.g, b = def.b;

      // riding 中は少し明るくしてハイライト（「乗っている」フィードバック）
      if (obj.state === 'riding') {
        r = Math.min(1.0, r + 0.18);
        g = Math.min(1.0, g + 0.18);
        b = Math.min(1.0, b + 0.18);
      }

      // ── 本体 ──
      renderer.drawRect(
        obj.x, obj.bottomY,
        OBJ_W, OBJ_H,
        r, g, b,
      );

      // ── 上面ハイライト（明るい帯で立体感） ──
      renderer.drawRect(
        obj.x + 3, obj.bottomY + OBJ_H - 7,
        OBJ_W - 6, 6,
        Math.min(1.0, r + 0.22), Math.min(1.0, g + 0.22), Math.min(1.0, b + 0.22),
      );

      // ── 下面シャドウ（暗い帯） ──
      renderer.drawRect(
        obj.x + 3, obj.bottomY + 1,
        OBJ_W - 6, 6,
        r * 0.55, g * 0.55, b * 0.55,
      );

      // ── 種類別の追加装飾 ──
      if (obj.kind === 'donut') {
        // ドーナツ: 中央に穴のような暗い楕円を模した矩形
        renderer.drawRect(
          obj.x + OBJ_W * 0.3, obj.bottomY + OBJ_H * 0.25,
          OBJ_W * 0.4, OBJ_H * 0.5,
          r * 0.65, g * 0.65, b * 0.65,
        );
      } else if (obj.kind === 'crate') {
        // 木箱: 十字の板目（縦線・横線）
        renderer.drawRect(
          obj.x + OBJ_W * 0.5 - 2, obj.bottomY + 7,
          4, OBJ_H - 14,
          r * 0.70, g * 0.70, b * 0.70,
        );
        renderer.drawRect(
          obj.x + 7, obj.bottomY + OBJ_H * 0.5 - 2,
          OBJ_W - 14, 4,
          r * 0.70, g * 0.70, b * 0.70,
        );
      } else {
        // アンビル: 底部に台形を模した暗い帯
        renderer.drawRect(
          obj.x + OBJ_W * 0.15, obj.bottomY + 1,
          OBJ_W * 0.7, OBJ_H * 0.35,
          r * 0.50, g * 0.50, b * 0.50,
        );
      }
    }
  }

  /**
   * プレイヤーがエリア終端に到達したらクリア。
   */
  isCleared(): boolean {
    return this.player.pos.x >= this.endX;
  }

  /** 最後に更新されたリスポーン地点を返す */
  getRespawnPoint(): Vec2 {
    return { ...this.respawnPoint };
  }
}
