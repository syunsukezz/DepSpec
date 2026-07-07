interface Key
{
    code: string;
    display: string;
    width: number;
    value: number;
}

let wooting60heplus : Key[][] = [
    [
        { code: "Escape", display: "Esc", width: 1, value: 0 },
        {code: "1", display: "1", width: 1, value: 0},
        {code: "2", display: "2", width: 1, value: 0},
        {code: "3", display: "3", width: 1, value: 0},
        {code: "4", display: "4", width: 1, value: 0},
        {code: "5", display: "5", width: 1, value: 0},
        {code: "6", display: "6", width: 1, value: 0},
        {code: "7", display: "7", width: 1, value: 0},
        {code: "8", display: "8", width: 1, value: 0},
        {code: "9", display: "9", width: 1, value: 0},
        {code: "0", display: "0", width: 1, value: 0},
        {code: "-", display: "-", width: 1, value: 0},
        {code: "=", display: "=", width: 1, value: 0},
        {code: "Backspace", display: "Backspace", width: 2, value: 0}
    ],
    [
        {code: "Tab", display: "Tab", width: 1.5, value: 0},
        {code: "Q", display: "Q", width: 1, value: 0},
        {code: "W", display: "W", width: 1, value: 0},
        {code: "E", display: "E", width: 1, value: 0},
        {code: "R", display: "R", width: 1, value: 0},
        {code: "T", display: "T", width: 1, value: 0},
        {code: "Y", display: "Y", width: 1, value: 0},
        {code: "U", display: "U", width: 1, value: 0},
        {code: "I", display: "I", width: 1, value: 0},
        {code: "O", display: "O", width: 1, value: 0},
        {code: "P", display: "P", width: 1, value: 0},
        {code: "[", display: "[", width: 1, value: 0},
        {code: "]", display: "]", width: 1, value: 0},
        {code: "\\", display: "\\", width: 1.5, value: 0}
    ],
    [
        {code: "CapsLock", display: "CapsLock", width: 1.75, value: 0},
        {code: "A", display: "A", width: 1, value: 0},
        {code: "S", display: "S", width: 1, value: 0},
        {code: "D", display: "D", width: 1, value: 0},
        {code: "F", display: "F", width: 1, value: 0},
        {code: "G", display: "G", width: 1, value: 0},
        {code: "H", display: "H", width: 1, value: 0},
        {code: "J", display: "J", width: 1, value: 0},
        {code: "K", display: "K", width: 1, value: 0},
        {code: "L", display: "L", width: 1, value: 0},
        {code: ";", display: ";", width: 1, value: 0},
        {code: "'", display: "'", width: 1, value: 0},
        {code: "Enter", display: "Enter", width: 2.25, value: 0}
    ],
    [
        {code: "ShiftLeft", display: "Shift", width: 2.25, value: 0},
        {code: "Z", display: "Z", width: 1, value: 0},
        {code: "X", display: "X", width: 1, value: 0},
        {code: "C", display: "C", width: 1, value: 0},
        {code: "V", display: "V", width: 1, value: 0},
        {code: "B", display: "B", width: 1, value: 0},
        {code: "N", display: "N", width: 1, value: 0},
        {code: "M", display: "M", width: 1, value: 0},
        {code: ",", display: ",", width: 1, value: 0},
        {code: ".", display: ".", width: 1, value: 0},
        {code: "/", display: "/", width: 1, value: 0},
        {code: "ShiftRight", display: "Shift", width: 2.75, value: 0}
    ],
    [
        {code: "ControlLeft", display: "Ctrl", width: 1.25, value: 0},
        {code: "MetaLeft", display: "ш", width: 1.25, value: 0},
        {code: "AltLeft", display: "Alt", width: 1.25, value: 0},
        {code: "Space", display: "Space", width: 6.25, value: 0},
        {code: "AltRight", display: "Alt", width: 1.25, value: 0},
        {code: "ContextMenu", display: "Menu", width: 1.25, value: 0},
        {code: "ControlRight", display: "Ctrl", width: 1.25, value: 0},
        {code: "fn", display: "fn", width: 1.25, value: 0}
    ]
];

function keyboard(element: HTMLElement, layout: Key[][]): (code: string, value: number) => void
{
    element.innerHTML = '';
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.gap = '5px';
    element.style.padding = '10px';
    element.style.border = '1px solid #ccc';
    element.style.borderRadius = '5px';
    element.style.backgroundColor = '#f9f9f9';
    element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '14px';
    element.style.color = '#333';
    element.style.width= 'fit-content';
    let currentLayout = layout;
    for (let row of currentLayout)
    {
        const rowElement = document.createElement('div');
        rowElement.className = 'keyboard-row';
        rowElement.style.display = 'flex';
        rowElement.style.gap = '5px';
        rowElement.style.width = '100%';
        element.appendChild(rowElement);
    
        for (let key of row)
        {
            const keyElement = document.createElement('div');
            keyElement.className = 'keyboard-key';
            keyElement.style.flex = key.width.toString();
            keyElement.textContent = key.display;
            keyElement.style.display = 'flex';
            keyElement.style.alignItems = 'center';
            keyElement.style.justifyContent = 'center';
            keyElement.style.height = '40px';
            keyElement.style.width = `${40 * key.width}px`;
            keyElement.style.cursor = 'pointer';
            
            keyElement.style.border = '1px solid #ccc';
            keyElement.style.borderRadius = '3px';
            keyElement.style.backgroundColor = `hsl(${key.value * 120+240}, 100%, 50%)`;
            
            rowElement.appendChild(keyElement);
        
            
        }
    }
    return function updateKeyValue(code: string, value: number): void
    {
        for (let row of currentLayout)
        {
            for (let key of row)
            {
                if (key.code === code)
                {
                    key.value = value;
                    const keyElements = element.getElementsByClassName('keyboard-key');
                    for (let i = 0; i < keyElements.length; i++)
                    {
                        const keyElement = keyElements[i] as HTMLElement;
                        if (keyElement.textContent === key.display)
                        {
                            keyElement.style.backgroundColor = `hsl(${value * 120+240}, 100%, 50%)`;
                            
                            break;
                        }
                    }
                    return;
                }
            }
        }
    };
}

export { keyboard, wooting60heplus, type Key };