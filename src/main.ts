/**
 * main.ts
 * エントリーポイント。ゲーム全体のステート管理・ループ。
 *
 * ── ゲームの流れ ──
 *
 *   start ─[Space]→ playing ─[全エリアクリア]→ result ─[Space]→ playing（リトライ）
 *
 * ── エリア順序 ──
 *
 *   Stage が管理する:
 *     1. ObstacleArea（障害物エリア）: autoMove=true、高さで障害物を回避
 *     2. ValleyArea  （谷越えエリア）: autoMove=false、距離で穴を越える
 *     3. NailArea    （釘打ちエリア）: autoMove=false、高さで釘を打ち込む
 *
 * ── getGroundY / autoMove の役割 ──
 *   各エリアは getGroundY(playerX) を実装する。
 *   main.ts はこれを使って player.update() に渡す地面 Y を決める。
 *   ValleyArea: 穴の上では -Infinity → プレイヤーが落下
 *   ObstacleArea: 常に floorY → 平坦な地面
 */

import { Renderer }       from './core/Renderer.ts';
import { Camera }         from './core/Camera.ts';
import { InputManager }   from './core/InputManager.ts';
import { Player }         from './game/Player.ts';
import { TypingManager }  from './game/TypingManager.ts';
import { Stage }          from './game/Stage.ts';
import { HUD }            from './ui/HUD.ts';
import { StartScreen }    from './ui/StartScreen.ts';
import { ResultScreen }   from './ui/ResultScreen.ts';

// ──────────────────────────────────────────
// DOM 構築
// ──────────────────────────────────────────

const app = document.getElementById('app')!;

const container = document.createElement('div');
container.style.cssText = 'position:relative; width:100vw; height:100vh; overflow:hidden;';
app.appendChild(container);

const glCanvas = document.createElement('canvas');
glCanvas.width  = window.innerWidth;
glCanvas.height = window.innerHeight;
glCanvas.style.cssText = 'position:absolute; top:0; left:0; display:block;';
container.appendChild(glCanvas);

const connectButton = document.createElement('button');
connectButton.textContent = 'アナログキーボードを接続';
connectButton.style.cssText = `
  position: fixed; top: 12px; left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px; font-size: 14px;
  background: rgba(0,0,0,0.7); color: #fff;
  border: 1px solid #555; border-radius: 6px;
  cursor: pointer; z-index: 10;
`;
container.appendChild(connectButton);

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** 地面の上面 Y 座標（Y 上向き座標系: プレイヤーの足元） */
const FLOOR_Y   = 40;

/** 天井の Y 座標（ObstacleArea で使用） */
const CEILING_Y = FLOOR_Y + 280;

// ──────────────────────────────────────────
// コアシステム（ゲーム全体で共有）
// ──────────────────────────────────────────

const renderer     = new Renderer(glCanvas);
const camera       = new Camera(glCanvas.width, glCanvas.height);
const inputManager = new InputManager(connectButton);
const typingMgr    = new TypingManager();

// ── Canvas 2D オーバーレイ ──
const hudOverlay    = new HUD(window.innerWidth, window.innerHeight);
const startScreen   = new StartScreen(window.innerWidth, window.innerHeight);
const resultScreen  = new ResultScreen(window.innerWidth, window.innerHeight);
container.appendChild(hudOverlay.element);
container.appendChild(startScreen.element);
container.appendChild(resultScreen.element);

// ──────────────────────────────────────────
// ゲームステート
// ──────────────────────────────────────────

type GameState = 'start' | 'playing' | 'result';
let gameState: GameState = 'start';

// ゲームごとにリセットされる変数
let player:     Player;
let stage:      Stage;
let score:      number;
let elapsedSec: number;
let wordIdx:    number;

const words = [
  'にほん', 'さくら', 'てんき', 'かいだん', 'はしる',
  'たいよう', 'みずうみ', 'こうえん', 'やまびこ', 'そらいろ',
];

function nextWord(): void {
  typingMgr.loadWord(words[wordIdx % words.length]);
  wordIdx++;
}

/**
 * ゲームを初期化する。
 * スタート時・リトライ時の両方で呼ぶ。
 * Player と Stage を新規生成してリセット状態にする。
 */
function initGame(): void {
  player     = new Player(0, FLOOR_Y);
  stage      = new Stage(player, FLOOR_Y, CEILING_Y);
  score      = 0;
  elapsedSec = 0;
  wordIdx    = 0;
  nextWord();
}

// 最初のゲームを生成（スタート画面の背景として使う）
initGame();

// ──────────────────────────────────────────
// 打鍵イベントのルーティング
// ──────────────────────────────────────────

inputManager.onKeyPress((e) => {
  // playing 中のみ打鍵を処理
  if (gameState !== 'playing') return;

  const result = typingMgr.input(e.key);
  hudOverlay.notifyKeyPress(e.pressure);

  if (result === 'incorrect') return;

  // 正しいキーを打った → エリアに通知
  stage.onKeyPress(e.pressure, true);

  if (result === 'finished') {
    // 単語完了ボーナス: 単語長 × 100 × (1 + 打鍵圧)
    const bonus = Math.round(
      words[(wordIdx - 1) % words.length].length * 100 * (1 + e.pressure),
    );
    score += bonus;
    nextWord();
  }
});

// ──────────────────────────────────────────
// スタート / リトライ入力
// ──────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;

  if (gameState === 'start') {
    initGame();
    gameState = 'playing';
    startScreen.hide();

  } else if (gameState === 'result') {
    initGame();
    gameState = 'playing';
    resultScreen.hide();
  }
});

// ──────────────────────────────────────────
// ゲームループ
// ──────────────────────────────────────────

let lastTime = 0;

/** HUD canvas の 2D コンテキスト（遷移アニメーションの描画に再利用） */
const hudCtx = hudOverlay.element.getContext('2d')!;

function loop(now: number): void {
  // dt をクランプ（タブ切り替え復帰時の大きな dt による物理破綻を防ぐ）
  const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // ── Update（playing 中のみ） ──
  if (gameState === 'playing') {
    elapsedSec += dt;

    player.update(dt, stage.getGroundY(player.pos.x), stage.autoMove);
    stage.update(dt, player);
    camera.follow(player.pos, dt);

    // 全エリアクリア → リザルト画面へ
    if (stage.isFinished()) {
      gameState = 'result';
      resultScreen.show(score, elapsedSec);
    }
  }

  // ── WebGL Render（常にゲーム世界を描画） ──
  renderer.clear(0.46, 0.73, 0.90); // 空色
  renderer.setCamera(camera);

  stage.render(renderer, camera);
  player.render(renderer);

  // ── HUD（playing 中のみ） ──
  if (gameState === 'playing') {
    hudOverlay.render(
      {
        score,
        elapsedSec,
        seqDone:       typingMgr.seqDone,
        seqCandidates: typingMgr.seqCandidates,
        keyCandidate:  typingMgr.keyCandidate,
      },
      dt,
    );

    // エリア遷移アニメーション（HUD canvas を共用）
    stage.renderTransition(hudCtx, glCanvas.width, glCanvas.height);
  }

  // ── オーバーレイ ──
  if (gameState === 'start') {
    startScreen.render(dt);
  } else if (gameState === 'result') {
    resultScreen.render(dt);
  }

  requestAnimationFrame(loop);
}

// ──────────────────────────────────────────
// リサイズ対応
// ──────────────────────────────────────────

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  glCanvas.width  = w;
  glCanvas.height = h;

  renderer.resize(w, h);
  camera.resize(w, h);
  hudOverlay.resize(w, h);
  startScreen.resize(w, h);
  resultScreen.resize(w, h);
});

// ──────────────────────────────────────────
// テクスチャのロード → ループ開始
// ──────────────────────────────────────────

renderer.loadTextures({
  player: '/player.drawio.png',
  nail:   '/Nail.png',
  ground: '/ground.png',
  wood:   '/wood.png',
}).catch(console.error).finally(() => {
  requestAnimationFrame(loop);
});
