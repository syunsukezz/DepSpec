/**
 * TypingManager.ts
 * 打鍵すべき文字列の管理・入力判定・UI表示用データの提供を担当するクラス。
 *
 * ── 依存ライブラリ ──
 *
 *   keygraph (keygraph.js)
 *     ひらがな文字列を「ローマ字入力グラフ」に変換し、
 *     キー入力の正誤判定を行う。複数の入力経路（"si"/"shi"/"ci"など）を
 *     自動的に管理してくれるため、TypingManager は正規化後のキーを
 *     渡すだけで良い。
 *
 *   kuromoji (index.html で bower_components から読み込み済み)
 *     漢字・カタカナ混じりテキストを形態素解析して読みがな（カタカナ）を取得する。
 *     textUtil.ts の katakanaToHiragana と組み合わせてひらがなに変換する。
 *     初期化に辞書ロードが必要なため非同期。
 *
 * ── 使い方 ──
 *
 *   // 1. インスタンス生成
 *   const tm = new TypingManager();
 *
 *   // 2. ひらがな文字列をセット（エリアが開始するたびに呼ぶ）
 *   tm.loadWord("にほんご");
 *
 *   // 3. InputManager の KeyPressEvent を受けて判定
 *   inputManager.onKeyPress((e) => {
 *     const result = tm.input(e.key);   // 'correct' | 'incorrect' | 'finished'
 *     if (result === 'correct') { ... }
 *   });
 *
 *   // 4. 表示用データを UI に渡す
 *   hud.renderTyping(tm.seqDone, tm.seqCandidates, tm.keyCandidate);
 */

import { keygraph }           from '../keygraph.js';
import { katakanaToHiragana } from '../textUtil.ts';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

/**
 * input() の戻り値。エリア側はこれを受けてゲームロジックを制御する。
 *   'correct'   - キーは正解。単語はまだ続いている
 *   'incorrect' - キーは不正解。エリアのルールに従い「ジャンプしない」等の処理をする
 *   'finished'  - 単語を打ち終わった。次の単語へ進む・クリア処理などを行う
 */
export type InputResult = 'correct' | 'incorrect' | 'finished';

// kuromoji の型（bower版グローバルを参照するための最小型定義）
// window.kuromoji として読み込まれているため、index.html の script タグが必要
interface KuromojiToken {
  surface_form: string;
  reading?: string;
}
interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}
interface KuromojiBuilder {
  build(callback: (err: Error | null, tokenizer: KuromojiTokenizer) => void): void;
}
interface KuromojiStatic {
  builder(option: { dicPath: string }): KuromojiBuilder;
}

// ──────────────────────────────────────────
// TypingManager クラス
// ──────────────────────────────────────────

export class TypingManager {
  /**
   * 現在セットされているひらがな文字列。
   * loadWord() で更新され、UI に表示する単語の元データとして使う。
   */
  private _currentWord = '';

  /**
   * kuromoji の初期化結果をキャッシュするための Promise。
   * 最初の呼び出しで初期化し、2回目以降は同じ Promise を返す。
   * kuromoji の辞書ロードは重いため、一度だけ行う。
   */
  private static tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

  // ──────────────────────────────────────────
  // 単語セット
  // ──────────────────────────────────────────

  /**
   * 打鍵すべきひらがな文字列をセットし、keygraph を初期化する。
   * エリアが開始するたびに呼ぶ。
   *
   * @param hiragana - ひらがな文字列（例: "にほんご", "さくら"）
   *
   * keygraph.build() はこの文字列から入力グラフを構築する。
   * 例えば "に" は "ni" として登録され、
   * keygraph.next("n") → true（途中まで正解）
   * keygraph.next("i") → true（"に" 完了）
   * という形で処理される。
   */
  loadWord(hiragana: string): void {
    this._currentWord = hiragana;
    keygraph.build(hiragana);
  }

  /**
   * keygraph の状態をリセットして初期状態に戻す。
   * ステージ終了時やゲームオーバー時に呼ぶ。
   */
  reset(): void {
    keygraph.reset();
    this._currentWord = '';
  }

  // ──────────────────────────────────────────
  // キー入力判定（メイン処理）
  // ──────────────────────────────────────────

  /**
   * キー入力を受け取り、正誤を判定して InputResult を返す。
   * InputManager の onKeyPress コールバック内から呼ぶ。
   *
   * ── 正規化の必要性 ──
   *   InputManager は AnalogSense の scancodeToString() が返す文字列を
   *   KeyPressEvent.key に格納している。形式は:
   *     "A", "B", ... "Z"  → 大文字（keygraph は小文字を期待）
   *     "Space"            → "Space" という文字列（keygraph は " " を期待）
   *     "Enter"            → keygraph._input_key_maps が "\n" に変換してくれる
   *     "1"〜"9"           → そのまま（keygraph の char_keys_table に登録済み）
   *
   *   → normalizeKey() を通すことで keygraph が期待する形式に統一する。
   *
   * @param rawKey - InputManager から受け取った生のキー名（scancodeToString 形式）
   * @returns 'correct' | 'incorrect' | 'finished'
   */
  input(rawKey: string): InputResult {
    // keygraph が期待するキー形式に変換
    const key = TypingManager.normalizeKey(rawKey);

    // keygraph.next() で正誤判定
    // 正解なら true を返し、内部状態（入力位置）を進める
    const correct = keygraph.next(key);

    if (!correct) {
      // 不正解: エリアは「ジャンプしない」「何も起きない」などの処理をする
      return 'incorrect';
    }

    // 正解の場合、全文字打ち終わったか確認
    if (keygraph.is_finished()) {
      // 完了: エリアは「次の単語へ」「クリア処理」などを行う
      return 'finished';
    }

    return 'correct';
  }

  // ──────────────────────────────────────────
  // UI 表示用ゲッター
  // ──────────────────────────────────────────

  /**
   * 次に打つべきキーの「候補文字列」を返す。
   * 複数の入力経路がある場合は1パターンだけ返す（keygraph が選択）。
   *
   * 例: 現在 "に" を打つ状態 → "ni"
   *     "し" を打つ状態    → "si" または "shi"（keygraphが代表1つを選ぶ）
   *
   * HUD のキープロンプト表示や、キー入力ガイドとして使う。
   */
  get keyCandidate(): string {
    return keygraph.key_candidate();
  }

  /**
   * これまでに打ち終わったキーの文字列を返す（ローマ字）。
   * 例: "にほ" まで打った状態 → "niho"
   *
   * HUD の「打ち終わった部分を暗くする」演出などに使う。
   */
  get keyDone(): string {
    return keygraph.key_done();
  }

  /**
   * これまでに完了したひらがな文字列を返す。
   * 例: "にほんご" のうち "にほ" まで打った → "にほ"
   *
   * HUD の日本語表示（打ち終わり部分）に使う。
   */
  get seqDone(): string {
    // seq_done() は undefined を返す可能性があるため ?? '' でフォールバック
    return keygraph.seq_done() ?? '';
  }

  /**
   * これから打つひらがな文字列を返す。
   * 例: "にほんご" のうち "にほ" まで打った → "んご"
   *
   * HUD の日本語表示（未打ち部分）に使う。
   */
  get seqCandidates(): string {
    return keygraph.seq_candidates() ?? '';
  }

  /**
   * 全文字打ち終わったかどうか。
   * input() が 'finished' を返した後は true になる。
   */
  get isFinished(): boolean {
    return keygraph.is_finished();
  }

  /**
   * 現在セットされているひらがな文字列。
   * loadWord() に渡した元の文字列。
   */
  get currentWord(): string {
    return this._currentWord;
  }

  // ──────────────────────────────────────────
  // キー正規化（静的メソッド）
  // ──────────────────────────────────────────

  /**
   * AnalogSense の scancodeToString 形式のキー名を、
   * keygraph.next() が期待する形式に変換する。
   *
   * 変換ルール:
   *   "A"〜"Z" （大文字1文字）→ "a"〜"z"（小文字）
   *   "Space"               → " "（スペース文字）
   *   "0"〜"9", ",", "." 等  → そのまま（keygraph の char_keys_table に登録済み）
   *   "Enter", "Tab"        → そのまま（keygraph._input_key_maps が "\n","\t" に変換）
   *   その他の特殊キー        → そのまま渡す（keygraph が false を返す）
   *
   * @param key - scancodeToString() が返すキー名
   */
  static normalizeKey(key: string): string {
    // "Space" → " "（スペース文字）
    if (key === 'Space') return ' ';

    // 大文字1文字（"A"〜"Z"）→ 小文字に変換
    // keygraph の char_keys_table はすべて小文字で登録されている
    if (key.length === 1 && key >= 'A' && key <= 'Z') return key.toLowerCase();

    // その他（"Enter", "Tab", "1", ",", "." 等）はそのまま渡す
    return key;
  }

  // ──────────────────────────────────────────
  // kuromoji 連携（テキスト → ひらがな変換）
  // ──────────────────────────────────────────

  /**
   * kuromoji を使って漢字・カタカナ混じりテキストをひらがなに変換する。
   * 結果は loadWord() に直接渡せる。
   *
   * ── 処理の流れ ──
   *   "日本語テキスト"
   *     → kuromoji.tokenize() で形態素解析
   *       [{ surface_form: "日本語", reading: "ニホンゴ" }, ...]
   *     → 各トークンの reading をつなげる
   *       "ニホンゴテキスト"
   *     → katakanaToHiragana() でひらがなに変換
   *       "にほんごてきすと"
   *
   * ── kuromoji の初期化 ──
   *   辞書ファイルの HTTP ロードが必要なため非同期。
   *   一度初期化したら tokenizerPromise にキャッシュし、
   *   2回目以降は即座に返す。
   *
   * ── dicPath について ──
   *   index.html で bower_components/kuromoji を読み込んでいるため、
   *   辞書パスも bower_components/kuromoji/dict を指定する。
   *
   * @param text - 変換したいテキスト（漢字・カタカナ・ひらがな混在可）
   * @returns ひらがな文字列。kuromoji が未ロードの場合は入力をそのまま返す
   */
  static async textToHiragana(text: string): Promise<string> {
    // kuromoji がグローバルに存在しない（bower スクリプト未ロード）場合は
    // katakanaToHiragana だけかけて返す（カタカナ → ひらがな変換のみ）
    if (!('kuromoji' in window)) {
      console.warn('window.kuromoji が未ロードです。カタカナのみ変換します。');
      return katakanaToHiragana(text);
    }

    // kuromoji トークナイザーを初期化（初回のみ辞書をロード）
    if (TypingManager.tokenizerPromise === null) {
      const kuro = (window as Window & { kuromoji: KuromojiStatic }).kuromoji;
      TypingManager.tokenizerPromise = new Promise((resolve, reject) => {
        kuro
          .builder({ dicPath: 'bower_components/kuromoji/dict' })
          .build((err, tokenizer) => {
            if (err) {
              reject(err);
            } else {
              resolve(tokenizer);
            }
          });
      });
    }

    // 初期化済みのトークナイザーを取得して形態素解析
    const tokenizer = await TypingManager.tokenizerPromise;
    const tokens    = tokenizer.tokenize(text);

    // 各トークンの読みがな（カタカナ）をつなげてひらがなに変換
    // reading が undefined のトークン（記号など）は surface_form をそのまま使う
    const katakana = tokens
      .map(token => token.reading ?? token.surface_form)
      .join('');

    return katakanaToHiragana(katakana);
  }
}
