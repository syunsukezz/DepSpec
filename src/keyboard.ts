
const keys = [
    ['escape','1','2','3','4','5','6','7','8','9','0','-','=','backspace'],
    ['tab','q','w','e','r','t','y','u','i','o','p','[',']','\\'],
    ['capslock','a','s','d','f','g','h','j','k','l',';',"'",'enter'],
    ['shiftleft','z','x','c','v','b','n','m',',','.','/'],
    ['controlleft','metaleft','altleft','space','altright','metaright','controlright','fn']
];
let keyboardDiv: HTMLDivElement;

export function Keyboard(): HTMLDivElement {
    keyboardDiv = document.createElement("div");
    keyboardDiv.style.fontSize = "clamp(10px, 1.8vh, 16px)";
    keyboardDiv.id = "keyboard";
    keyboardDiv.style.display = "flex";
    keyboardDiv.style.flexDirection = "column";
    keys.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "key-row";
        rowDiv.style.display = "flex";
        rowDiv.style.justifyContent = "center";
        rowDiv.style.flexDirection = "row";
        row.forEach(key => {
            const keyDiv = document.createElement("div");
            keyDiv.className = "key";
            keyDiv.textContent = key;
            keyDiv.style.border = "1px solid #ccc";
            keyDiv.style.borderRadius = "4px";
            keyDiv.style.padding = "10px";
            keyDiv.style.margin = "2px";
            keyDiv.style.textAlign = "center";
            keyDiv.style.color = "#fff";
            rowDiv.appendChild(keyDiv);
        });
        keyboardDiv.appendChild(rowDiv);
    });
    return keyboardDiv;
}
export function highlightKey(key: string, value: number) {
    const keyDivs = keyboardDiv.getElementsByClassName("key");
    for (let i = 0; i < keyDivs.length; i++) {
        const keyDiv = keyDivs[i] as HTMLDivElement;
        if (keyDiv.textContent?.toLowerCase() === key.toLowerCase()) {
            const intensity = Math.min(1, value);
            keyDiv.style.backgroundColor = `rgba(255, 0, 0, ${intensity})`;
            if (intensity < 0.1) {
                keyDiv.style.backgroundColor = "transparent";
            }
        }
    }
}
