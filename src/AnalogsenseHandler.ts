import "./Analogsense.js";




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
                        const inputStrings = inputs.map(input => `${window.analogsense.scancodeToString(input.scancode)}:${input.value<0.1?0:input.value}`);
                        AnalogsenseCallback(inputStrings);
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
                const inputStrings = inputs.map(input => `${window.analogsense.scancodeToString(input.scancode)}:${input.value<0.1?0:input.value}`);
                AnalogsenseCallback(inputStrings);
            });
            button.disabled = true;
        }
    });
}
let AnalogsenseCallback:(inputs:string[])=>void = (inputs: string[]) => {
  console.log("Received inputs:", inputs);
};

function SetAnalogsenseCallback(callback:(inputs:string[])=>void)
{
  AnalogsenseCallback = callback;
}

export { RequestDeviceIfNeeded, SetAnalogsenseCallback };

