
import "./style.css";
const _kuromojiModule = await import("./kuromoji");
let kuromoji: any = (_kuromojiModule && (_kuromojiModule as any).default) ? (_kuromojiModule as any).default : _kuromojiModule;
// Additional fallbacks for different bundling/UMD shapes
if (!kuromoji || typeof kuromoji.builder !== "function") {
    if (kuromoji && kuromoji.kuromoji) {
        kuromoji = kuromoji.kuromoji;
    } else if ((window as any).kuromoji) {
        kuromoji = (window as any).kuromoji;
    }
}
console.log("kuromoji detection:", kuromoji && typeof kuromoji.builder === "function" ? "builder OK" : kuromoji);

import StartAnalogSenseReader from "./analogSenseReader";
import { requestDevice } from "./analogSenseReader";
import type { OnPressedKeyData } from "./analogSenseReader";
import {keygraph} from "./keygraph";
import "./analogsense";
import {katakanaToHiragana} from "./textUtil";

const meigenapi = "/api/json.php";
//[{"meigen":"幸福であろうと思えば、「こうでさえあったらなあ」という言葉をやめて、その代わり、「今度こそは」という言葉に変えなさい。","auther":"スマイリー・ブラントン"}]
interface MeigenData {
    meigen: string;
    auther: string;
}
const fallbackMeigenList: MeigenData[] = [
    {
        meigen: "幸福であろうと思えば、「こうでさえあったらなあ」という言葉をやめて、その代わり、「今度こそは」という言葉に変えなさい。",
        auther: "スマイリー・ブラントン",
    },
    {
        meigen: "成功とは、失敗を重ねても情熱を失わない力のことだ。",
        auther: "ウィンストン・チャーチル",
    },
    {
        meigen: "昨日から学び、今日を生き、明日へ期待しよう。",
        auther: "アルベルト・アインシュタイン",
    },
];
async function getMeigen(): Promise<MeigenData> {
    try {
        const response = await fetch(meigenapi);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.warn("Falling back to local meigen list:", error);
        return fallbackMeigenList[Math.floor(Math.random() * fallbackMeigenList.length)];
    }
}
interface meigen {
    text: string;
    reading: string;
    name: string;
}

async function kuromojiMeigen(): Promise<meigen> {
    const meigenData = await getMeigen();
    return new Promise((resolve, reject) => {
        const dicPath = "/dict";
        console.log("Loading kuromoji with dicPath:", dicPath);
        kuromoji.builder({ dicPath }).build(function (err: any, tokenizer: any) {
            console.log("kuromoji.build callback:", err ? "error" : "success", err);
            if (err || !tokenizer) {
                reject(err ?? new Error("Failed to build kuromoji tokenizer"));
                return;
            }
            // tokenizer is ready
            const path = tokenizer.tokenize(meigenData.meigen);
            console.log(path);
            const readings = path.map((token: any) => {return token.reading}).join("");
            resolve({ text: meigenData.meigen, reading: readings, name: meigenData.auther });
        });
    });
}


const app = document.getElementById("app")!;
if(!app){
    throw new Error("App element not found");
}


function Start(): void {
    let StartButton = document.createElement("button");
    StartButton.textContent = "Start";
    StartButton.onclick = async () => {
        StartButton.disabled = true;
        const deviceAvailable = await requestDevice();
        if (deviceAvailable) {
         Game();
        }
        else 
        {
            StartButton.disabled = false;
        }
        
    }
    app.appendChild(StartButton);
}
const round = 10;

function Game() {

    app.innerHTML = "";
    const targetdiv = document.createElement("div");
    targetdiv.id = "target";
    app.appendChild(targetdiv);
    const sentencediv = document.createElement("div");
    sentencediv.id = "sentence";
    app.appendChild(sentencediv);  
    const namediv = document.createElement("div");
    namediv.id = "name";
    app.appendChild(namediv);
    

    StartAnalogSenseReader((pressedKeyData: OnPressedKeyData) => {
        typingLogic(pressedKeyData);
    },(_receivedData:{scancode: number,value: number}) => {
        
    },true);
    loadSentence();
}

    
let roundCount = 0;
function typingLogic(pressedKeyData: OnPressedKeyData) {
    let sentenceElement = document.getElementById("sentence")!;
    if(roundCount >= round){
        console.log("Game Over");
        return;
    }
    if(keygraph.next(pressedKeyData.key.toLowerCase())){
        sentenceElement.innerHTML =`<span style="color:black">${keygraph.seq_done()}</span><span style="color:gray">${keygraph.seq_candidates()}</span><br><span style="color:black">${keygraph.key_done()}</span><span style="color:gray">${keygraph.key_candidate()}</span><br>`;
        if(keygraph.is_finished()){
            roundCount++;
            loadSentence();
        }
    }
}
function loadSentence(): void {
    kuromojiMeigen().then((data) => {
        console.log(data);
        const targetdiv = document.getElementById("target")!;
        targetdiv.textContent = data.text;
        if(keygraph.build(katakanaToHiragana(data.reading))){
            const sentencediv = document.getElementById("sentence")!;
            sentencediv.innerHTML =`<span style="color:black">${keygraph.seq_done()}</span><span style="color:gray">${keygraph.seq_candidates()}</span><br><span style="color:black">${keygraph.key_done()}</span><span style="color:gray">${keygraph.key_candidate()}</span><br>`;
        }
        else{            
            console.error("Failed to build keygraph for the sentence.");
            loadSentence();
            return;
        }
        const namediv = document.getElementById("name")!;
        namediv.textContent = `— ${data.name}`;
    }).catch((error) => {
        console.error("Failed to load sentence:", error);
    });
}

Start();

