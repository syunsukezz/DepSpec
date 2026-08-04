# keywave (DepSpec)

アナログキーボード（打鍵圧センシング対応キーボード）を用いた、打鍵圧センシングに基づくタイピングゲームです。
対応デバイスがなくても通常のキーボードで速度・正確性ベースのタイピングとして遊べます。

## 特徴

- **打鍵圧フィードバック**: キーを押す強さに応じて画面下部の横顔キャラクターの表情と、Tone.js によるフォルマント合成音（弱="ウ" ⇔ 強="ワ"）が変化します。加えて、押下量の推移を示すライブグラフ（背景に半透明で表示）、打鍵の強さに応じた画面揺れ、3段階の判定で色分けされた擬音エフェクト（スッ/コト/カタ/ガタ!!!/ド!!!!!）も表示されます（アナログモードのみ）
- **打鍵圧の指示**: 各フレーズ（単語）には強く/弱く打つ指示が付き、単語全体が同じ語感（濁音・半濁音・長音・母音などの音象徴）に基づいて決定論的に強弱づけされます。指示どおりに打てるとコンボ・表現点でボーナス
- **2つのモード**
  - `analog`: 対応するアナログキーボード（AnalogSense 経由）で打鍵圧を検知
  - `normal`: 通常のキーボードでも遊べる、速度・正確性のみのベースラインモード
- **3段階の難易度**（Easy / Normal / Hard）とチュートリアル
- **スコアリング**: 打鍵ごとに加点する基本点＋打鍵圧の指示クリアで増えるコンボ倍率つき表現点
- **ローカルランキング**: この端末のブラウザ内（`localStorage`）に上位10件のスコアを記録

## 遊び方

1. タイトル画面で何かキーを押す、またはアナログキーボードを接続する
2. アナログキーボードが検出された場合はキーボード選択画面（アナログ / 通常）へ、なければ通常モードで開始
3. レベルを選んで開始。制限時間内にできるだけ多くのフレーズをタイプする
4. リザルト画面でスコア・打鍵圧の傾向・ランキングを確認

## セットアップ

```bash
npm install
npm run dev      # 開発サーバーを起動
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド結果をローカルでプレビュー
```

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | [Vite](https://vitejs.dev/) + TypeScript |
| デバイス連携 | AnalogSense（[`src/AnalogsenseHandler.ts`](src/AnalogsenseHandler.ts)、WebHID 経由） |
| 打鍵圧推定 | [`src/calcPressure.ts`](src/calcPressure.ts)（作動点〜底打ちの平均速度から推定） |
| タイピング判定 | `keygraph.js`（ひらがな⇔ローマ字の入力判定エンジン） |
| 音声合成 | [Tone.js](https://tonejs.github.io/) v15（フォルマント合成による打鍵圧フィードバック音） |

## ディレクトリ構成（`src/`）

| ファイル | 役割 |
|---------|------|
| `main.ts` | 画面遷移の起点、各画面ハンドラの配線 |
| `startScreen.ts` / `keyboardSelectScreen.ts` / `levelSelectScreen.ts` / `tutorialScreen.ts` / `gameScreen.ts` / `resultScreen.ts` | 各画面 |
| `AnalogsenseHandler.ts` | アナログキーボードの接続・監視 |
| `calcPressure.ts` | 押下量から打鍵圧(Newton相当値)を推定 |
| `phrases.ts` / `sentences.ts` | 出題フレーズと打鍵圧指示の生成ロジック |
| `keyboard.ts` | オンスクリーンキーボードの描画 |
| `pressureMeter.ts` | 押下量の常時ライブメーター |
| `pressureGraph.ts` | 押下量の推移を示す折れ線グラフ（ステージ背景に半透明で表示） |
| `screenShake.ts` | 打鍵の強さに応じた画面揺れ |
| `ranking.ts` | ローカルランキング（`localStorage`） |
| `theme.ts` / `faceDraw.ts` | 画面共通の配色・フォント / 横顔キャラクター描画 |
| `stage.ts` / `transition.ts` / `rippleEffect.ts` | 画面レイアウトの土台・画面遷移演出・エフェクト |
| `audio.ts` / `bgm.ts` | 打鍵圧フォルマント合成音 / BGM・効果音の再生管理 |

## テスト用: アナログキーボードエミュレータ

実機のアナログキーボードや WebHID の許可ダイアログがなくても打鍵圧をシミュレートできるよう、
[`src/analogKeyboardEmulator.ts`](src/analogKeyboardEmulator.ts) に `window.analogsense` の
テスト用差し替え実装を用意しています（開発ビルドのみ・本番ビルドには含まれません）。

```bash
npm run dev  # 開発サーバーを起動
```

devtools コンソールや自動化スクリプトから次のように呼び出します。

```js
const { emulator } = installAnalogKeyboardEmulator();
await emulator.pressAndRelease("A");                          // 標準的な速さで底打ち
await emulator.pressAndRelease("A", { targetNewton: 1.2 });   // 特定の打鍵圧を再現
```

`autoRampOnKeyEvents`（既定 true）により、通常のキー入力（自動化ツールが送るキー入力も含む）を
そのままアナログ入力として扱うこともできます。

## 補足

- `plan.md` は初期の実装仕様メモです。実装が先行して更新されていない箇所があるため、現状の挙動と食い違う場合は本 README とソースコードを優先してください。
