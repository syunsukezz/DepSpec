/**
 * Stage.ts
 * 複数エリアを順番に管理するステージクラス。
 *
 * ── エリア順序 ──
 *   1. ObstacleArea（障害物エリア）: autoMove=true、ジャンプ高さで障害物を回避
 *   2. ValleyArea  （谷越えエリア）: autoMove=false、ジャンプ距離で穴を越える
 *   3. NailArea    （釘打ちエリア）: autoMove=false、ジャンプ高さで釘を打ち込む
 *
 * ── エリアのチェーン ──
 *   各エリアは startX を持つ。
 *   area[i+1].startX = area[i].endX となるように生成することで、
 *   プレイヤーがエリアを通り抜けたときに次のエリアへシームレスに移行できる。
 *
 * ── 遷移の仕組み ──
 *   update() の中で currentArea.isCleared() を毎フレーム確認する。
 *   クリア検出 → エリアインデックスをインクリメント。
 *   autoMove が true→false に切り替わるタイミングでプレイヤーの横速度をリセット
 *   （ObstacleArea から ValleyArea への遷移でプレイヤーが勝手に進まないようにする）。
 *
 * ── エリア名称 ──
 *   AREA_NAMES 配列にエリア名が格納されており、HUD やスタート画面の表示に使える。
 *
 * ── 遷移アニメーション ──
 *   エリア遷移直後は TRANSITION_DURATION 秒の間、
 *   画面中央に「AREA n / N エリア名」を表示する簡易オーバーレイを描画する。
 *   Canvas 2D ctx を受け取って描画するため、main.ts 側で HUD canvas の ctx を渡す。
 */

import { ObstacleArea } from '../areas/ObstacleArea.ts';
import { ValleyArea }   from '../areas/ValleyArea.ts';
import { NailArea }     from '../areas/NailArea.ts';
import type { IArea }   from '../areas/IArea.ts';
import type { Player }  from './Player.ts';
import type { Renderer } from '../core/Renderer.ts';
import type { Camera }  from '../core/Camera.ts';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** エリア遷移時に名前を表示し続ける時間 (秒) */
const TRANSITION_DURATION = 2.0;

// ──────────────────────────────────────────
// Stage クラス
// ──────────────────────────────────────────

export class Stage {
  /** エリアの表示名（UI 表示用） */
  static readonly AREA_NAMES: readonly string[] = [
    '障害物エリア',
    '谷越えエリア',
    '釘打ちエリア',
  ];

  /** 全エリアのリスト（インデックス順に遷移） */
  private readonly areas: IArea[];

  /** 現在アクティブなエリアのインデックス */
  private idx: number = 0;

  /**
   * エリア遷移直後のタイマー (秒)。
   * 0 より大きい間は遷移アニメーションを描画する。
   */
  private transitionTimer: number = 0;

  /**
   * @param player    - プレイヤーへの参照（各エリアに渡す）
   * @param floorY    - 地面の上面 Y 座標
   * @param ceilingY  - 天井の Y 座標（ObstacleArea で使用）
   */
  constructor(player: Player, floorY: number, ceilingY: number) {
    const a0 = new ObstacleArea(player, 0, 5, floorY, ceilingY);
    const a1 = new ValleyArea(player, a0.endX, 10, floorY);
    const a2 = new NailArea(player, a1.endX, 20, floorY);
    this.areas = [a0, a1, a2];

    // 全エリアを生成した後で最初のエリアのリスポーン地点をプレイヤーに設定する。
    // 各エリアのコンストラクタで setCheckpoint を呼ぶと最後に生成したエリアの
    // 座標で上書きされてしまうため、ここで一度だけ正しい初期値を設定する。
    player.setCheckpoint(a0.getRespawnPoint());
  }

  // ──────────────────────────────────────────
  // IArea に準じたデリゲートプロパティ
  // ──────────────────────────────────────────

  /** 現在エリアの autoMove を透過する */
  get autoMove(): boolean { return this.current.autoMove; }

  /** 現在エリアの getGroundY を透過する */
  getGroundY(x: number): number { return this.current.getGroundY(x); }

  /** 現在エリアに打鍵イベントを渡す */
  onKeyPress(pressure: number, correct: boolean): void {
    this.current.onKeyPress(pressure, correct);
  }

  // ──────────────────────────────────────────
  // 更新
  // ──────────────────────────────────────────

  /**
   * 1フレーム分の更新。
   *
   *   1. 現在エリアを更新
   *   2. エリアクリア判定 → 次のエリアへ遷移
   *   3. autoMove 遷移時のプレイヤー横速度リセット
   *   4. 遷移タイマーの更新
   *
   * @param dt     - 経過時間（秒）
   * @param player - プレイヤーへの参照
   */
  update(dt: number, player: Player): void {
    this.current.update(dt, player);

    // エリア遷移チェック（最終エリアは遷移しない）
    if (!this.isFinished() && this.current.isCleared()) {
      const prevAutoMove = this.current.autoMove;
      this.idx++;
      this.transitionTimer = TRANSITION_DURATION;

      // autoMove(true → false) 遷移: 横方向ドリフトをリセット
      if (prevAutoMove && !this.current.autoMove) {
        player.vel.x = 0;
      }

      // 新エリアの初期リスポーン地点をプレイヤーに設定する。
      // これをしないと、前エリアのチェックポイント（遠く後方）に
      // リスポーンしてしまうバグが発生する。
      player.setCheckpoint(this.current.getRespawnPoint());
    }

    // 遷移タイマー
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt;
    }
  }

  // ──────────────────────────────────────────
  // 描画
  // ──────────────────────────────────────────

  /**
   * 現在エリアを WebGL で描画する。
   *
   * @param renderer - WebGL描画クラス
   * @param camera   - カメラ
   */
  render(renderer: Renderer, camera: Camera): void {
    this.current.render(renderer, camera);
  }

  /**
   * エリア遷移アニメーションを Canvas 2D で描画する。
   * 遷移から TRANSITION_DURATION 秒間は画面中央にエリア名を表示。
   * 呼び出し元（main.ts）は毎フレーム必ず呼ぶこと（timer=0 のときは即 return）。
   *
   * @param ctx - 描画先の Canvas2D コンテキスト（HUD canvas 等）
   * @param w   - キャンバス幅
   * @param h   - キャンバス高さ
   */
  renderTransition(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.transitionTimer <= 0) return;

    // フェードイン・フェードアウト: 端で 0、中央で 1
    const t = this.transitionTimer / TRANSITION_DURATION; // 1→0
    const a = Math.min(1, Math.min(t, 1 - t) * 4);

    ctx.save();
    ctx.globalAlpha = a;

    // 半透明の帯
    ctx.fillStyle = 'rgba(5, 8, 20, 0.80)';
    ctx.fillRect(0, h * 0.38, w, h * 0.24);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // エリア番号
    ctx.font = 'bold 16px Audiowide, monospace';
    ctx.fillStyle = '#AAAACC';
    ctx.fillText(
      `AREA  ${this.idx + 1} / ${this.areas.length}`,
      w / 2,
      h * 0.44,
    );

    // エリア名
    ctx.font = 'bold 36px Noto Sans JP, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(Stage.AREA_NAMES[this.idx] ?? '', w / 2, h * 0.54);

    ctx.restore();
  }

  // ──────────────────────────────────────────
  // 状態問い合わせ
  // ──────────────────────────────────────────

  /**
   * 全エリアをクリアしたかどうかを返す。
   * true になったら main.ts がリザルト画面へ遷移する。
   */
  isFinished(): boolean {
    return this.idx >= this.areas.length - 1 && this.current.isCleared();
  }

  /** 現在のエリアインデックス（0 始まり） */
  get currentAreaIndex(): number { return this.idx; }

  /** エリアの総数 */
  get totalAreas(): number { return this.areas.length; }

  /** 現在のエリア名（日本語） */
  get currentAreaName(): string {
    return Stage.AREA_NAMES[this.idx] ?? '';
  }

  /** 現在アクティブなエリア（内部アクセス用） */
  private get current(): IArea { return this.areas[this.idx]; }
}
