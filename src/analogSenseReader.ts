

let devicename = ""; 

async function requestDevice(): Promise<boolean> {
    if("hid"in navigator){
        console.log("HID API is supported.");
    } else {
        console.error("HID API is not supported in this browser.");
            document.getElementById("app")!.textContent = "HID API is not supported in this browser.WebHID がサポートされていないブラウザです。ブラウザを変更してください。（推奨：Google Chrome）";
         return false;
    }
    if("analogsense"in window){
        let found=false;
        await window.analogsense.getDevices().then((devices) => {
            if (devices.length > 0) {
                const device = devices[0];
                devicename = device.getProductName();
                console.log("Device found:", devicename);
                found=true;
                return;
            } else {
                console.log("No AnalogSense devices found.");
            }
        }).catch((error) => {
            console.error("Error accessing AnalogSense devices:", error);
        });
        if(found)return true;
        console.log("AnalogSense API is supported.");
        await window.analogsense.requestDevice().then((device) => {
            if (!device) {
                console.log("No device selected.");
                return false;
            }
            devicename = device.getProductName();
            console.log("Device selected:", devicename);
            return true;
        }).catch((error) => {
            console.error("Error selecting device:", error);
            return false;
        });
    } else {
        console.error("AnalogSense API is not supported in this browser.");
        document.getElementById("app")!.textContent = "AnalogSense API is not supported in this browser.";
        return false;
    }
    return false;
}
//onkeypressedはキーが押されたときに呼び出されるコールバック関数、onInputReceivedは入力が受信されたときに呼び出されるコールバック関数、depthは深さの情報を扱うかどうかを指定するフラグ
function StartAnalogSenseReader(onKeyPressed: (data: OnPressedKeyData ,depth: number) => void,onInputReceived?: (data: {scancode: number, value: number}) => void ,depth = false) {
    const analogSense = window.analogsense;
    if("hid"in navigator){
        console.log("HID API is supported.");
    } else {
        console.error("HID API is not supported in this browser.");
         return;
    }
    
    analogSense.getDevices().then((devices) => {
        if (devices.length > 0) {
            const device = devices[0];
            devicename = device.getProductName();
            device.startListening((inputs) => {
                if(onInputReceived){
                    inputs.forEach((input) => {
                        onInputReceived(input);
                    });
                }
                inputs.forEach((input) => {
                    keyPressLogic(input, onKeyPressed, depth);
                });
            }
        );
            
            
        } else {
            console.log("No AnalogSense devices found.");
            
        }
    }).catch((error) => {
        console.error("Error accessing AnalogSense devices:", error);
    });
}
export default StartAnalogSenseReader;
export {requestDevice};

export interface depthTimeData {
    time: number;
    depth: number;
}
export interface OnPressedKeyData {
    key: string
    data: depthTimeData[];
}



let keymap: Record<string, OnPressedKeyData> = {};
let plessingKeys: Set<string> = new Set();//現在押されているキーのスキャンコードを保持するセット
const lowthreshold = 0.1;//キーが押されたとみなす深さの閾値
function keyPressLogic(input: { scancode: number; value: number }, onKeyPressed: (data: OnPressedKeyData, depth: number) => void, depth: boolean) {
    const currentTime = performance.now();
    
    if(input.value==1||(input.value<keymap[input.scancode]?.data[keymap[input.scancode].data.length-1].depth)&&!plessingKeys.has(input.scancode.toString())&&depth)
    {
        if(plessingKeys.has(input.scancode.toString()))
        {            
            return;
        }
        if(!keymap[input.scancode]){//keymapに存在しない場合は新しく追加する
            keymap[input.scancode] = {key: window.analogsense.scancodeToString(input.scancode), data: []};
        }
        keymap[input.scancode].data.push({time: currentTime, depth: input.value});
        onKeyPressed(keymap[input.scancode], 1);//キーが押されたときにコールバック関数を呼び出す
        plessingKeys.add(input.scancode.toString());
    }
    else if(input.value < lowthreshold)
    {
        if(keymap[input.scancode]){
            delete keymap[input.scancode];
            plessingKeys.delete(input.scancode.toString());
        }
    }
    else
    {

        if(!keymap[input.scancode]){//keymapに存在しない場合は新しく追加する
            keymap[input.scancode] = {key: window.analogsense.scancodeToString(input.scancode), data: []};
            
        }
        keymap[input.scancode].data.push({time: currentTime, depth: input.value});
    }
    

    
}









