
import "./style.css";
import {Keyboard,highlightKey} from "./keyboard";
import depspec from "../public/depspec.png";
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
let randomWords = ["コンピュータ", "プログラミング", "キーボード", "マウス", "ディスプレイ", "インターネット", "ソフトウェア", "ハードウェア", "アルゴリズム", "データベース"];

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
let tango = true;
async function kuromojiMeigen(): Promise<meigen> {
    const meigenData = !tango ? await getMeigen() : { meigen: randomWords[Math.floor(Math.random() * randomWords.length)], auther: " " };
    
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
    let title = document.createElement("img");
    title.src = depspec; // Replace with the actual path to your image
    title.alt = "DepSpec Typing Game";
    app.appendChild(title);
    let StartButton = document.createElement("button");
    StartButton.textContent = "Start";
    StartButton.onclick = async () => {
        StartButton.disabled = true;
        const deviceAvailable = await requestDevice();
        if (deviceAvailable) {
         Game(GameOver);
        }
        else 
        {
            StartButton.disabled = false;
        }
        
    }
    app.appendChild(StartButton);
}
const round = 10;
let score = 0;
//let roundTime = 0;
function Game(onGameOver?: (score: number) => void): void {

    app.innerHTML = "";
    const scoreDiv = document.createElement("div");
    scoreDiv.id = "score";
    scoreDiv.textContent = `score: 0`;
    scoreDiv.style.position = "absolute";
    scoreDiv.style.top = "10px";
    scoreDiv.style.right = "10px";
    scoreDiv.style.fontSize = "100px";
    scoreDiv.style.color = "rgba(255, 255, 255, 0.5)";
    app.appendChild(scoreDiv);
    const timerDiv = document.createElement("div");
    timerDiv.id = "timer";
    timerDiv.style.position = "absolute";
    timerDiv.style.top = "10px";
    timerDiv.style.left = "10px";
    timerDiv.style.fontSize = "100px";
    timerDiv.style.color = "rgba(255, 255, 255, 0.5)";
    app.appendChild(timerDiv);
    const targetdiv = document.createElement("div");
    targetdiv.id = "target";
    app.appendChild(targetdiv);
    const sentencediv = document.createElement("div");
    sentencediv.id = "sentence";
    sentencediv.style.lineHeight = "1rem";
    app.appendChild(sentencediv);  
    const namediv = document.createElement("div");
    namediv.id = "name";
    app.appendChild(namediv);
   
    app.appendChild(Keyboard());


    StartAnalogSenseReader((pressedKeyData: OnPressedKeyData) => {
        typingLogic(pressedKeyData, onGameOver);
    },(_receivedData:{scancode: number,value: number}) => {
        const value =  Math.pow(_receivedData.value, 5);
        const inputing = document.getElementById("inputing")!;
        inputing.style.fontSize = `${value}rem`;
        inputing.textContent = window.analogsense.scancodeToString(_receivedData.scancode).toLowerCase();
        highlightKey(window.analogsense.scancodeToString(_receivedData.scancode).toLowerCase(), value);
        
    },true);
    loadSentence();
}


    
let roundCount = 0;
let nextWeight = 1;
const maxWeight = 1;
const minWeight = 0.3;
let done = document.createElement("div");
function typingLogic(pressedKeyData: OnPressedKeyData ,onGameOver?: (score: number) => void): void {
    let sentenceElement = document.getElementById("sentence")!;
    if(roundCount >= round){
        console.log("Game Over");
        onGameOver?.(score);
        return;
    }
    if(keygraph.next(pressedKeyData.key.toLowerCase())){
        const text = document.createElement("span");
        text.textContent = pressedKeyData.key.toLowerCase();
        const maxDepth= Math.max(...pressedKeyData.data.map(d => d.depth));
        const thisscore = Math.floor(50-Math.abs(maxDepth-nextWeight)*100);
        score += thisscore;
        const scoreDiv = document.getElementById("score")!;
        scoreDiv.textContent = `score: ${score}`;
        text.style.fontSize = `${ Math.pow(maxDepth, 5)}rem`;
        done.appendChild(text);
        nextWeight = Math.random() * (maxWeight - minWeight) + minWeight;
        sentenceElement.innerHTML =`<span style="color:white">${keygraph.seq_done()}</span><span style="color:gray">${keygraph.seq_candidates()}</span><br><span style="color:white">${done.innerHTML}</span><span id="next_key" style="color:red; position: relative; display: inline-block;font-size:${nextWeight}rem">${keygraph.key_candidate()[0]||""}<div id= "inputing" style = "position: absolute; left: 0; bottom: 0; color: rgba(255, 255, 255, 0.5);" >${keygraph.key_candidate()[0]||""}</div></span><span style="color:gray">${keygraph.key_candidate().slice(1)}</span><br>`;
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
            sentencediv.innerHTML =`<span style="color:white">${keygraph.seq_done()}</span><span style="color:gray">${keygraph.seq_candidates()}</span><br><span style="color:white">${keygraph.key_done()}</span><span id="next_key" style="color:red; position: relative; display: inline-block;font-size:${nextWeight}rem">${keygraph.key_candidate()[0]||""}<div id= "inputing" style = "position: absolute; left: 0; bottom: 0; font-size: 0 ;color: rgba(255, 255, 255, 0.5);" >${keygraph.key_candidate()[0]||""}</div></span><span style="color:gray">${keygraph.key_candidate().slice(1)}</span><br>`;
            done.innerHTML = "";
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
function GameOver(score: number): void {
    app.innerHTML = "";
    const gameOverText = document.createElement("div");
    gameOverText.textContent = `Game Over! 
    Your score: ${score}`;
    gameOverText.style.fontSize = "2em";
    gameOverText.style.color = "#fff";
    app.appendChild(gameOverText);
}

Start();

