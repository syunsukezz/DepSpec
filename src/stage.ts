// 各画面の土台。2つのモードを持つ:
//  - fill (既定): app をウィンドウいっぱいに広げ、中身も幅・高さ100%。ヘッダーや
//    ボタンをウィンドウ幅に追従させたい画面（ゲーム/リザルト等）向け。
//  - fit: 設計サイズ固定のステージを transform: scale で等倍拡縮。中身の割合が
//    ウィンドウサイズに左右されない。タイトル画面のように「見た目の比率を一定に
//    保ちたい」画面向け。

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
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
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
            const scale = Math.min(app.clientWidth / W, app.clientHeight / H);
            stage.style.transform = `scale(${scale})`;
        };
        const observer = new ResizeObserver(fit);
        observer.observe(app);
        fit();
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
    return { stage, dispose: () => {} };
}
