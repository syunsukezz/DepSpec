let PressedKeys: Set<string> = new Set();
let StartTime: Map<string, number> = new Map();
let CurrentKeyValues: Map<string, number> = new Map();
let PressureCallback: (code: string, value: number) => void = (code: string, value: number) => {
    console.log(`Key ${code} pressed with value ${value}`);
}
const startNewton = 0.4; //キーの押し始めのニュートン数
const endNewton = 0.6; //キーの押し終わりのニュートン数
const d = 0.001; // 仮の距離（メートル）
const stroke_mm = 4; // キーのストローク距離（ミリメートル）
const m = 0.002; // キーと指の質量（キログラム）
const ReleaseThreshold = 0.2; // キーが戻ったとみなす値の閾値
function CaliculatePressure(code: string, value: number) 
{
    console.log(`Received input: code=${code}, value=${value}`);
  const previousValue = CurrentKeyValues.get(code) || 0;
  if (value < ReleaseThreshold && previousValue >= ReleaseThreshold) {
    // キーが戻り切ったので,そのキーのデータをリセットする
    PressedKeys.delete(code);
    StartTime.delete(code);
    CurrentKeyValues.delete(code);
    console.log(`Key ${code} released`);
  }
  if (value > ReleaseThreshold && previousValue < ReleaseThreshold) {
    // キーが押されたので、開始時間を記録する
    StartTime.set(code, performance.now());
    //console.log(`Key ${code} pressed with value ${value}`);
    CurrentKeyValues.set(code, value);
  }
  if (value > ReleaseThreshold && previousValue > ReleaseThreshold) {
    // キーが押され続けているので、現在の値を更新する
    CurrentKeyValues.set(code, value);
  }
  if (!PressedKeys.has(code) && value == 1) {
    // キーが底を打ったので、押されたとみなす
    /*
    数式
    $$
    F_{average} = \frac{mv^2}{2d}
    $$
    */
    const ms = performance.now() - (StartTime.get(code) || performance.now());
    const v = stroke_mm /ms; // 平均速度（メートル/秒）(両方ミリなので相殺できる)
    const F_average = (m * v * v) / (2 * d);// 平均力（ニュートン）
    PressureCallback(code, F_average+endNewton);
    PressedKeys.add(code);
    console.log(`Key ${code} pressed with force ${F_average+endNewton}N`);
  }
  if(!PressedKeys.has(code) && value < previousValue&& value > ReleaseThreshold)
  {
    // キーが戻り始めたので、押されたとみなす
    const newton = (1-value)*startNewton+value*endNewton;
    PressureCallback(code, newton);
    PressedKeys.add(code);
    console.log(`Key ${code} half pressed with force ${newton}N`);
  }
  

}

function SetPressureCallback(callback: (code: string, value: number) => void) {
  PressureCallback = callback;
}

export { CaliculatePressure, SetPressureCallback };