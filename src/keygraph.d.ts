export type KeygraphNextFn = (key: string) => boolean;

export interface KeygraphAutocomplete {
    seq_pattern: RegExp;
    seq_ptr_d?: number;
    fired?: (key: string, next: KeygraphNextFn) => void;
    key?: (key: string, next: KeygraphNextFn) => void;
}

export interface Keygraph {
    build(seq: string): string | undefined;
    next(key: string): boolean;
    reset(): void;
    register_autocomplete(autocomplete: KeygraphAutocomplete): void;

    is_finished(): boolean;
    key_done(): string;
    key_candidate(): string;
    seq_done(): string | undefined;
    seq_candidates(): string | undefined;
    seq_ptr(): number;
}

export const keygraph: Keygraph;
