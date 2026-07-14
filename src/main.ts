import "./analogsense.js";
import { type AnalogSenseInput,RequestDeviceIfNeeded,SetAnalogsenseCallback } from "./AnalogsenseHandler";
import {CaliculatePressure,SetPressureCallback} from "./calcPressure";

const app = document.getElementById("app") as HTMLDivElement;
if (!app) {
  throw new Error("App element not found");
}
const button = document.createElement("button");
button.textContent = "Connect AnalogSense Device";
app.appendChild(button);

SetAnalogsenseCallback((inputs: AnalogSenseInput[]) => {
  inputs.forEach(input => {
    CaliculatePressure(input.key, input.value);
  });
});

SetPressureCallback((code: string, value: number) => {
  console.log(`Pressure callback: code=${code}, value=${value}`);
});

RequestDeviceIfNeeded(button);

