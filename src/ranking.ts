// ローカルランキング。localStorage にスコアを記録するだけの端末内ランキングで、
// サーバーを持たないためブラウザ・端末をまたいでは共有されない。

import type { GameMode } from './gameScreen';
import type { Level } from './sentences';
import { coerceNameChars, type NameChar } from './playerName';

export interface RankingEntry {
    score: number;
    mode: GameMode;
    level: Level;
    name: NameChar[];
    date: string; // ISO文字列（記録日時・現在エントリの識別にも使う）
}

const STORAGE_KEY = 'keywave-ranking';
const MAX_ENTRIES = 10;

function loadAll(): RankingEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // 過去バージョン(name無し・name:string)のエントリも壊れず読めるよう補正する
        return parsed.map((e) => ({ ...e, name: coerceNameChars(e?.name) }));
    } catch {
        return [];
    }
}

function saveAll(entries: RankingEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // プライベートモード等で localStorage が使えない場合は諦める
    }
}

/** 今回のスコアを記録し、上位 MAX_ENTRIES 件（降順）を返す */
export function recordScore(entry: RankingEntry): RankingEntry[] {
    const entries = [...loadAll(), entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES);
    saveAll(entries);
    return entries;
}

/** この端末内のランキングを全て消去する */
export function clearRanking(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // プライベートモード等で localStorage が使えない場合は諦める
    }
}
