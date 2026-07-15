import * as Tone from 'tone';

// 「ウ」のフォルマント周波数 (F1, F2, F3)
const U_FORMANTS = [100, 500, 2100];
// 「ワ」のフォルマント周波数
const WA_FORMANTS = [800, 1200, 2600];

// 打鍵圧の正規化範囲 (Newton) — 対数スケールで正規化
const LOG_MIN = Math.log(0.6);
const LOG_MAX = Math.log(3.0);

let initialized = false;
let filters: Tone.Filter[] = [];
let envelope: Tone.AmplitudeEnvelope;

function init() {
    if (initialized) return;
    initialized = true;

    // ホワイトノイズ源 + 矩形波源
    const noise = new Tone.Noise('white').start();
    const square = new Tone.Oscillator('A3', 'square').start();
    const triangle = new Tone.Oscillator('B3', 'triangle').start();
    

    // 各ソースのゲイン（0.0〜1.0 で比率を調整）
    const NOISE_GAIN  = 0.2;
    const SQUARE_GAIN = 0.4;
    const TRIANGLE_GAIN = 0.4;

    const noiseGain  = new Tone.Gain(NOISE_GAIN);
    const squareGain = new Tone.Gain(SQUARE_GAIN);
    const triangleGain = new Tone.Gain(TRIANGLE_GAIN);
    const mixGain    = new Tone.Gain(1.0);

    noise.connect(noiseGain);
    square.connect(squareGain);
    triangle.connect(triangleGain);
    noiseGain.connect(mixGain);
    squareGain.connect(mixGain);
    triangleGain.connect(mixGain);

    // 振幅エンベロープ → 出力
    envelope = new Tone.AmplitudeEnvelope({
        attack: 0.01,
        decay: 1,
        sustain: 1,
        release: 0.15,
    }).toDestination();

    // 3本のバンドパスフィルタを並列に接続（フォルマント模倣）
    // mixGain → filters → envelope → destination
    filters = U_FORMANTS.map(freq =>
        new Tone.Filter({ frequency: freq, type: 'bandpass', Q: 12 })
    );

    filters.forEach(f => {
        mixGain.connect(f);
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
        // 対数スケールで 0〜1 に正規化
        const t = Math.min(1, Math.max(0, (Math.log(newtonValue) - LOG_MIN) / (LOG_MAX - LOG_MIN)));

        filters.forEach((f, i) => {
            f.frequency.value = U_FORMANTS[i] + (WA_FORMANTS[i] - U_FORMANTS[i]) * t;
        });

        envelope.triggerAttackRelease('8n');
    } catch {
        // AudioContext が初期化されていない場合など無視
    }
}
