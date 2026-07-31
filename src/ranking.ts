// ローカルランキング。localStorage にスコアを記録するだけの端末内ランキングで、
// サーバーを持たないためブラウザ・端末をまたいでは共有されない。

import type { GameMode } from './gameScreen';
import type { Level } from './sentences';

export interface RankingEntry {
    score: number;
    mode: GameMode;
    level: Level;
    date: string; // ISO文字列（記録日時・現在エントリの識別にも使う）
}

const STORAGE_KEY = 'keywave-ranking';
const MAX_ENTRIES = 10;

function loadAll(): RankingEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
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
