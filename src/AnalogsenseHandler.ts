import "./analogsense.js";

interface AnalogSenseInput {
    key: string;
    value: number;
    timestamp: number;
}



function RequestDeviceIfNeeded(button: HTMLButtonElement) {
    if (!window.analogsense) {
        throw new Error("AnalogSense API is not available.");
    }
    window.analogsense.getDevices().then((devices) => {
        if (devices.length === 0) {
            button.addEventListener('click', async () => {
                const device = await window.analogsense.requestDevice();
                if (device) {
                    console.log(`Device selected: ${device.getProductName()}`);
                    device.startListening((inputs) => {
                        //console.log("Received inputs:", inputs);
                        const inputAndTimestamp = inputs.map(input => ({ key: window.analogsense.scancodeToString(input.scancode), value: input.value<0.1?0:input.value, timestamp: performance.now() }));
                        AnalogsenseCallback(inputAndTimestamp);
                    });
                    button.disabled = true;
                } else {
                    console.log("No device selected.");
                }
                
            });
        }
        else
        {
            const device = devices[0];
            console.log(`Device already connected: ${device.getProductName()}`);
            device.startListening((inputs) => {
                //console.log("Received inputs:", inputs);
                const inputAndTimestamp = inputs.map(input => ({ key: window.analogsense.scancodeToString(input.scancode), value: input.value<0.1?0:input.value, timestamp: performance.now() }));
                AnalogsenseCallback(inputAndTimestamp);
            });
            button.disabled = true;
        }
    });
}
let AnalogsenseCallback:(inputs: AnalogSenseInput[])=>void = (inputs: AnalogSenseInput[]) => {
  console.log("Received inputs:", inputs);
};

function SetAnalogsenseCallback(callback:(inputs: AnalogSenseInput[])=>void)
{
  AnalogsenseCallback = callback;
}


export { RequestDeviceIfNeeded, SetAnalogsenseCallback ,type AnalogSenseInput};

