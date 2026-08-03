// 各画面の土台。2つのモードを持つ:
//  - fill (既定): app をウィンドウいっぱいに広げ、中身も幅・高さ100%。ヘッダーや
//    ボタンをウィンドウ幅に追従させたい画面（キーボード選択等）向け。
//  - fit: 設計サイズ固定のステージを transform: scale で等倍拡縮。中身の割合が
//    崩れない「見た目の比率を一定に保ちたい」画面向け。
//
// fit のスケールは「横幅」だけを基準にする（縦横比を min(w/W, h/H) で決めていた
// 従来方式だと、ウィンドウが縦長のときに文字がウィンドウ幅に対して不必要に小さく
// なってしまっていた）。横幅基準で拡大した結果、縦がウィンドウに収まらない場合は
// クリップして崩れさせるのではなくスクロールできるようにする。
// 極端な横長ウィンドウで文字が際限なく巨大化/微小化しないよう、スケールの上下限は設ける。
const MIN_FIT_SCALE = 0.35;
const MAX_FIT_SCALE = 2.5;

export interface Stage {
    stage: HTMLDivElement;
    dispose: () => void;
}

export interface StageOptions {
    /** true で等倍スケール（割合固定）。既定は false（フルウィンドウ） */
    fit?: boolean;
    /** fit 時の設計サイズ */
    designW?: number;
    designH?: number;
    /** 画面遷移時の入場アニメーションを無効にする（既定は有効） */
    noTransition?: boolean;
}

/**
 * 画面が現れるときの入場エフェクト。opacity と blur だけを使うので、
 * fit モードで stage に掛かっている transform: scale とは競合しない。
 */
function playEnterTransition(el: HTMLElement): void {
    if (typeof el.animate !== 'function') return;
    el.animate(
        [
            { opacity: 0, filter: 'blur(14px)' },
            { opacity: 1, filter: 'blur(0px)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    );
}

/**
 * @param layout stage の display 等（grid / flex など画面ごとの指定）
 */
export function createStage(
    app: HTMLDivElement,
    layout: Partial<CSSStyleDeclaration> = {},
    opts: StageOptions = {},
): Stage {
    app.innerHTML = '';
    app.removeAttribute('style');
    Object.assign(app.style, {
        display: 'flex',
        alignItems: opts.fit ? 'safe center' : 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflowX: 'hidden',
        // fit は横幅基準スケールにするため、縦が収まりきらない場合がある → スクロール可能にする
        overflowY: opts.fit ? 'auto' : 'hidden',
    });

    const stage = document.createElement('div');
    const common: Partial<CSSStyleDeclaration> = {
        background: '#ffffff',
        color: '#1e293b',
        overflow: 'hidden',
    };

    if (opts.fit) {
        const W = opts.designW ?? 1200;
        const H = opts.designH ?? 800;
        Object.assign(stage.style, {
            ...common,
            width: `${W}px`,
            height: `${H}px`,
            flexShrink: '0',
            transformOrigin: 'center center',
            ...layout,
        });
        app.appendChild(stage);

        const fit = () => {
            const raw = app.clientWidth / W;
            const scale = Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, raw));
            stage.style.transform = `scale(${scale})`;
        };
        const observer = new ResizeObserver(fit);
        observer.observe(app);
        fit();
        if (!opts.noTransition) playEnterTransition(stage);
        return { stage, dispose: () => observer.disconnect() };
    }

    // fill モード
    Object.assign(stage.style, {
        ...common,
        width: '100%',
        height: '100%',
        ...layout,
    });
    app.appendChild(stage);
    if (!opts.noTransition) playEnterTransition(stage);
    return { stage, dispose: () => {} };
}
