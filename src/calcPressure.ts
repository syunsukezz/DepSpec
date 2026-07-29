let PressedKeys: Set<string> = new Set();
let StartTime: Map<string, number> = new Map();
let PreviousKeyValues: Map<string, number> = new Map();
let StartKeyValues: Map<string, number> = new Map();
let PressureCallback: (code: string, value: number) => void = () => {
    //console.log(`Key ${code} pressed with value ${value}`);
}
//const startNewton = 0.4; //キーの押し始めのニュートン数
//const endNewton = 0.6; //キーの押し終わりのニュートン数
//const d = 0.001; // 仮の距離（メートル）
const stroke_mm = 4; // キーのストローク距離（ミリメートル）
//const m = 0.001; // キーと指の質量（キログラム）
const ReleaseThreshold = 0.2; // キーが戻ったとみなす値の閾値
const isVelocity=true; //打鍵圧の代わりに速度を出力する
const fallbackNewton = 0.81; // 開始を取り逃した高速打鍵の既定値（速度0相当＝ v*係数+0.81 の切片）
function CaliculatePressure(code: string, value: number)
{
  console.log(`Received input: code=${code}, value=${value}`);
  const previousValue = PreviousKeyValues.get(code) || 0;
  if (value < ReleaseThreshold && previousValue >= ReleaseThreshold) {
    // キーが戻り切ったので,そのキーのデータをリセットする
    PressedKeys.delete(code);
    StartTime.delete(code);
    PreviousKeyValues.delete(code);
    StartKeyValues.delete(code);
    console.log(`Key ${code} released`);

  }

  if (value > ReleaseThreshold && previousValue > ReleaseThreshold) {
    // キーが押され続けているので、現在の値を更新する
    PreviousKeyValues.set(code, value);
  }
  if (!PressedKeys.has(code) && value == 1) {
    // キーが底を打ったので、押されたとみなす
    /*
    速度 = ストローク距離 / 経過時間（全区間の平均）
    F_average = mv^2 / (2d)
    */
    const startTime = StartTime.get(code);
    if (startTime === undefined) {
      // 開始(作動点通過)を取り逃した高速打鍵。入力＝底打ちで確定する構成のため、
      // ここで既定値を出さないと入力そのものが落ちる。
      PressureCallback(code, fallbackNewton);
      PreviousKeyValues.set(code, value);
      PressedKeys.add(code);
      return;
    }

    const ms = performance.now() - startTime;
    // if (ms <= 0) {
    //   PressureCallback(code, endNewton);
    //   PressedKeys.add(code);
    //   return;
    // }
    if (isVelocity) {
      // 開始位置(StartKeyValues)からボトム(=1)までの距離 / 経過時間
      const v = (stroke_mm - StartKeyValues.get(code)! * stroke_mm) / ms; // 平均速度（mm/ms = m/s）
      PressureCallback(code, v*0.529136+0.81);
      PressedKeys.add(code);
      return;
    }
    // const v = stroke_mm / ms; // 平均速度（mm/ms = m/s）
    // const F_average = (m * v * v) / (2 * d);
    // PressureCallback(code, F_average + endNewton);
    // PressedKeys.add(code);
    // console.log(`Key ${code} pressed with force ${F_average + endNewton}N (ms=${ms})`);
  }
  else if (value > ReleaseThreshold && previousValue < ReleaseThreshold) {
    // キーが押されたので、開始時間を記録する
    StartTime.set(code, performance.now());
    StartKeyValues.set(code, value);
    PreviousKeyValues.set(code, value);
  }
  // if (!PressedKeys.has(code) && value < previousValue && value > ReleaseThreshold)
  // {
  //   // キーが戻り始めたので、押されたとみなす
  //   const newton = (1 - value) * startNewton + value * endNewton;
  //   if (isVelocity) {
  //     const startTime = StartTime.get(code);
  //     if (startTime === undefined) {
  //       return;
  //     }
  //     const ms = performance.now() - startTime;
  //     const mm = value *stroke_mm-StartKeyValues.get(code)! *stroke_mm;// キーが押された距離（mm）
  //     const v = mm / ms;
  //     PressureCallback(code, v*0.529136+0.81);
  //     PressedKeys.add(code);
  //     return;
  //   }
  //   PressureCallback(code, newton);
  //   PressedKeys.add(code);
  //   console.log(`Key ${code} half pressed with force ${newton}N`);
  // }
}

function SetPressureCallback(callback: (code: string, value: number) => void) {
  PressureCallback = callback;
}

export { CaliculatePressure, SetPressureCallback };
