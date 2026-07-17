import * as Tone from 'tone';
import { normalizeN } from './phrases';

// 「ウ」のフォルマント周波数 (F1, F2, F3)
const U_FORMANTS = [600, 800, 2000];
// 「ワ」のフォルマント周波数
const WA_FORMANTS = [800, 1200, 2600];



let initialized = false;
let filters: Tone.Filter[] = [];
let envelope: Tone.AmplitudeEnvelope;

function init() {
    if (initialized) return;
    initialized = true;

    // ホワイトノイズ源 + 矩形波源
    const noise = new Tone.PulseOscillator('E2', 0.75).start();
    const square = new Tone.PulseOscillator('G2',0.25).start();
    const triangle = new Tone.Oscillator('C2', 'sine').start();
    

    // 各ソースのゲイン（0.0〜1.0 で比率を調整）
    const NOISE_GAIN  = 0.1;
    const SQUARE_GAIN = 0.5;
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
        sustain: 0,
        release: 0.15,
    }).toDestination();

    // 3本のバンドパスフィルタを並列に接続（フォルマント模倣）
    // mixGain → filters → envelope → destination
    filters = U_FORMANTS.map(freq =>
        new Tone.Filter({ frequency: freq, type: 'bandpass', Q: 10 })
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
        
        const t = normalizeN(newtonValue);

        filters.forEach((f, i) => {
            f.frequency.value = U_FORMANTS[i] + (WA_FORMANTS[i] - U_FORMANTS[i]) * t;
        });

        envelope.triggerAttackRelease('8n');
    } catch {
        // AudioContext が初期化されていない場合など無視
    }
}
