import * as Tone from 'tone';
import { normalizeN } from './phrases';

// 「ウ」のフォルマント周波数 (F1, F2, F3)
const U_FORMANTS = [200, 400, 800];
// 「ワ」のフォルマント周波数
const WA_FORMANTS = [800, 1200, 2600];

// フォルマント合成の元の音（録音した「あー」）
const SOURCE_URL = encodeURI('/a.mp3');
// 音の高さ（再生レート）: 1.0=原音, 2.0=1オクターブ上
const PITCH_RATE = 1.0;

let initialized = false;
let filters: Tone.Filter[] = [];
let envelope: Tone.AmplitudeEnvelope;
let player: Tone.Player;

function init() {
    if (initialized) return;
    initialized = true;

    // 元の音源: 「あー」をループ再生し、フォルマントフィルタの励振源にする
    player = new Tone.Player({
        url: SOURCE_URL,
        loop: true,
        autostart: true,
        playbackRate: PITCH_RATE,
    });

    // 音源のゲイン（大きすぎる場合はここで下げる）
    const srcGain = new Tone.Gain(1.0);
    player.connect(srcGain);

    // 振幅エンベロープ → 出力（打鍵ごとに開く）
    envelope = new Tone.AmplitudeEnvelope({
        attack: 0.01,
        decay: 1,
        sustain: 0,
        release: 0.15,
    }).toDestination();

    // 3本のバンドパスフィルタを並列に接続（フォルマント模倣）
    // player → srcGain → filters → envelope → destination
    filters = U_FORMANTS.map(freq =>
        new Tone.Filter({ frequency: freq, type: 'bandpass', Q: 2 })
    );

    filters.forEach(f => {
        srcGain.connect(f);
        f.connect(envelope);
    });
}

/**
 * 打鍵圧(Newton値)に応じてフォルマント合成音を出す
 * t=0 (弱打鍵) → 「ウ」 , t=1 (強打鍵) → 「ワ」
 */
export function playFormant(newtonValue: number): void {
    try {
        init();

        const t = normalizeN(newtonValue);

        filters.forEach((f, i) => {
            f.frequency.value = U_FORMANTS[i] + (WA_FORMANTS[i] - U_FORMANTS[i]) * t;
        });

        envelope.triggerAttackRelease('8n');
    } catch {
        // AudioContext が初期化されていない場合など無視
    }
}
