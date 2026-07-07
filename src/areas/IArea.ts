/**
 * IArea.ts
 * 全エリアが実装するインターフェース。
 *
 * ゲームは 4 つのエリアを順番に通過する構成:
 *   ObstacleArea → ValleyArea → FallingArea → SlopeArea
 *
 * Stage クラスはこのインターフェースを通してエリアを操作するため、
 * 各エリアの内部実装が異なっても同じループコードで扱える。
 *
 * ── ゲームループでの呼び出し順 ──
 *
 *   1. onKeyPress(pressure, correct)   ← 打鍵イベント（InputManager → TypingManager経由）
 *   2. update(dt, player)              ← 物理・衝突・チェックポイント更新
 *   3. render(renderer, camera)        ← 描画
 *   4. isCleared()                     ← 次エリアへ進むか確認
 */

import type { Player } from '../game/Player.ts';
import type { Renderer } from '../core/Renderer.ts';
import type { Camera } from '../core/Camera.ts';
import type { Vec2 } from '../core/Vec2.ts';

export interface IArea {
  /**
   * 打鍵イベントを受け取り、エリアのルールに従ってプレイヤーに作用する。
   * TypingManager の input() の結果を元に Game/Stage から呼ばれる。
   *
   * @param pressure - 打鍵圧 0.0〜1.0（CaliculatePressure で正規化済み）
   * @param correct  - true: 正しいキーを打った / false: 打ち間違い
   *
   * エリア別の挙動:
   *   障害物エリア: correct=true  → player.jump(pressure, 'height')
   *               correct=false → 何もしない（ジャンプ不可）
   *   谷のエリア:  correct=true  → player.jump(pressure, 'distance')
   *               correct=false → 何もしない
   *   落下物エリア: correct=true  → player.jump(pressure, 'height')（硬さ判定付き）
   *               correct=false → 何もしない
   *   坂のエリア:  correct=true  → 橋桁を伸ばす
   *               correct=false → 何もしない（坂は死なない）
   */
  onKeyPress(pressure: number, correct: boolean): void;

  /**
   * 1フレーム分の状態を更新する。
   * 衝突判定・チェックポイント更新・エリア固有の物理演算を行う。
   *
   * @param dt     - 前フレームからの経過時間（秒）
   * @param player - プレイヤーの参照（衝突判定・die()・setCheckpoint() に使う）
   */
  update(dt: number, player: Player): void;

  /**
   * エリアを描画する。
   * renderer.setCamera(camera) は呼び出し元（Game/Stage）が事前に済ませること。
   *
   * @param renderer - WebGL描画クラス
   * @param camera   - 視錐台カリング（画面外の描画をスキップ）に使う
   */
  render(renderer: Renderer, camera: Camera): void;

  /**
   * エリアをクリアしたかどうかを返す。
   * true になったら Stage が次のエリアへ遷移する。
   */
  isCleared(): boolean;

  /**
   * 現在のリスポーン地点を返す。
   * player.die() 後に player.setCheckpoint() へ渡す値として使う。
   * エリア内を進むにつれて更新される。
   */
  getRespawnPoint(): Vec2;

  /**
   * プレイヤーの X 座標に応じた地面の Y 座標を返す。
   * 平坦な地面のエリアは常に floorY を返す。
   * 谷エリアのように穴がある場合は、穴の上では -Infinity を返すことで
   * Player.update() の地面衝突をスキップさせ、プレイヤーを落下させる。
   *
   * @param playerX - プレイヤーの現在 X 座標
   */
  getGroundY(playerX: number): number;

  /**
   * プレイヤーが自動で右移動するか。
   *   true  - 障害物/落下物エリアのように常に前進
   *   false - 谷/坂エリアのようにキー入力で飛び越す
   */
  readonly autoMove: boolean;

  /** エリアの開始 X 座標 */
  readonly startX: number;

  /** エリアの終了 X 座標（次エリアへの接続点） */
  readonly endX: number;
}
