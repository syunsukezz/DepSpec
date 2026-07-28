// BGM / 効果音の集中管理。
// - メインBGM(タイトル / 各選択画面 / ゲーム / リザルト)と、チュートリアル専用BGMを切り替える。
// - リザルト画面では効果音(resultSE)を鳴らし終えてからメインBGMを流す。
// 同じ曲への切り替え要求は途切れさせず継続するので、タイトル→ゲーム間は1曲が繋がって流れる。
// 注意: ブラウザの自動再生制限のため、最初のユーザー操作までは再生が保留されることがある
//       （armAutoplayUnlock で最初の操作時に復帰させる）。

const MAIN_BGM = '/title&game&result.mp3';
const TUTORIAL_BGM = '/tutorial.mp3';
const RESULT_SE = '/resultSE.mp3';

const BGM_VOLUME = 0.4; // BGMは控えめに（打鍵音・効果音を邪魔しない）
const SE_VOLUME = 0.8;

let bgm: HTMLAudioElement | null = null;
let bgmSrc = '';

function startBgm(src: string): void {
    // 既に同じ曲が流れているなら途切れさせず継続する
    if (bgmSrc === src && bgm && !bgm.paused) return;
    stopBgm();
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    bgm = audio;
    bgmSrc = src;
    audio.play().catch(() => {}); // 自動再生ブロック時は無視（最初のユーザー操作で復帰）
}

/** 再生中のBGMを停止する */
export function stopBgm(): void {
    if (bgm) {
        bgm.pause();
        bgm = null;
        bgmSrc = '';
    }
}

/** タイトル / 選択画面 / ゲームで流すメインBGM */
export function playMainBgm(): void {
    startBgm(MAIN_BGM);
}

/** チュートリアル専用BGM */
export function playTutorialBgm(): void {
    startBgm(TUTORIAL_BGM);
}

/** リザルト: 効果音を鳴らし、鳴り終わってからメインBGMを流す */
export function playResultSEThenBgm(): void {
    stopBgm(); // ゲームのBGMを一旦止めて効果音を目立たせる
    const se = new Audio(RESULT_SE);
    se.volume = SE_VOLUME;
    se.addEventListener('ended', () => playMainBgm(), { once: true });
    se.play().catch(() => {
        // 効果音が鳴らせなかった場合でもBGMは流す
        playMainBgm();
    });
}

// 自動再生ブロック対策: 最初のユーザー操作で、保留中のBGMを再開する。
let unlockArmed = false;
export function armAutoplayUnlock(): void {
    if (unlockArmed) return;
    unlockArmed = true;
    const resume = () => {
        if (bgm && bgm.paused) bgm.play().catch(() => {});
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
}
