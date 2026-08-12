// 打鍵圧(Newton相当値)の推定。
// キーの押下量(0〜1の生値)から、作動点通過〜底打ちまでの平均速度を求め、
// 経験式 v*0.529136+0.81 でNewton相当値に変換する。「底打ち＝入力確定」という
// 構成のため、作動点通過を取り逃した高速打鍵には既定値(fallbackNewton)を返す。
import { shiftPairs } from "./shiftpair";

let PressedKeys: Set<string> = new Set();
let StartTime: Map<string, number> = new Map();
let PreviousKeyValues: Map<string, number> = new Map();
let StartKeyValues: Map<string, number> = new Map();
let PressureCallback: (code: string, value: number) => void = () => {};

const stroke_mm = 4; // キーのストローク距離（ミリメートル）
const ReleaseThreshold = 0.2; // キーが戻ったとみなす値の閾値
const fallbackNewton = 0.81; // 開始を取り逃した高速打鍵の既定値（速度0相当＝ v*係数+0.81 の切片）
const SpeedToNewtonSlope = 0.529136; // 速度(m/s)→Newton相当値の変換係数



function CaliculatePressure(code: string, value: number, shiftPressed: boolean) 
{
  const modifiedCode = shiftPressed && shiftPairs[code] ? shiftPairs[code] : code;
  const previousValue = PreviousKeyValues.get(code) || 0;
  if (value < ReleaseThreshold && previousValue >= ReleaseThreshold) {
    // キーが戻り切ったので,そのキーのデータをリセットする
    PressedKeys.delete(code);
    StartTime.delete(code);
    PreviousKeyValues.delete(code);
    StartKeyValues.delete(code);
  }

  if (value > ReleaseThreshold && previousValue > ReleaseThreshold) {
    // キーが押され続けているので、現在の値を更新する
    PreviousKeyValues.set(code, value);
  }
  if (!PressedKeys.has(code) && value == 1) {
    // キーが底を打ったので、押されたとみなす
    const startTime = StartTime.get(code);
    if (startTime === undefined) {
      // 開始(作動点通過)を取り逃した高速打鍵。入力＝底打ちで確定する構成のため、
      // ここで既定値を出さないと入力そのものが落ちる。
      PressureCallback(modifiedCode, fallbackNewton);
      PreviousKeyValues.set(code, value);
      PressedKeys.add(code);
      return;
    }

    const ms = performance.now() - startTime;
    // 開始位置(StartKeyValues)からボトム(=1)までの距離 / 経過時間
    const v = (stroke_mm - StartKeyValues.get(code)! * stroke_mm) / ms; // 平均速度（mm/ms = m/s）
    PressureCallback(modifiedCode, v*SpeedToNewtonSlope+fallbackNewton);
    PressedKeys.add(code);
    return;
  }
  else if (value > ReleaseThreshold && previousValue < ReleaseThreshold) {
    // キーが押されたので、開始時間を記録する
    StartTime.set(code, performance.now());
    StartKeyValues.set(code, value);
    PreviousKeyValues.set(code, value);
  }
}

function SetPressureCallback(callback: (code: string, value: number) => void) {
  PressureCallback = callback;
}

export {
  CaliculatePressure,
  SetPressureCallback,
  stroke_mm,
  ReleaseThreshold,
  fallbackNewton,
  SpeedToNewtonSlope,
};

