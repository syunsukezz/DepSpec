// 画面遷移用の市松模様ワイプ。
// 青と白の市松模様が右から入って画面を覆い、覆いきった瞬間に中身を差し替え、
// そのまま左へ抜けていって次の画面が現れる。
// 市松模様（背景）自体は固定で動かさず、clip-path の「表示範囲」だけを動かすので、
// 模様はその場に留まったまま、覆い／めくれの境界だけがスライドして見える。

let transitioning = false;

/**
 * 市松模様ワイプで画面を切り替える。
 * @param render 画面が完全に覆われたタイミングで呼ばれる（ここで次画面を描画する）
 */
export function checkerboardTransition(render: () => void): void {
    // アニメーション非対応や多重呼び出し時は素直に即差し替え
    if (transitioning || typeof document.body.animate !== 'function') {
        render();
        return;
    }
    transitioning = true;

    const CELL = 90; // 市松の1マス(px)
    const blue = '#0891b2';
    const white = '#ffffff';

    // 切れ目の斜め具合（上端と下端のズレ幅・ビューポート幅に対する%）。大きいほど寝る。
    const SLANT =-22;

    // 覆い(右側が塗り)の多角形。始点=何も見えない / 終点=全面。斜めの左辺がスライドする。
    const coverFrom = 'polygon(100% 0%, 100% 0%, 100% 100%, ' + (100 + SLANT) + '% 100%)';
    const coverTo   = 'polygon(' + (-SLANT) + '% 0%, 100% 0%, 100% 100%, 0% 100%)';
    // めくり(左側が塗り)の多角形。始点=全面 / 終点=何も見えない。斜めの右辺が左へ抜ける。
    const uncoverFrom = 'polygon(0% 0%, 100% 0%, ' + (100 + SLANT) + '% 100%, 0% 100%)';
    const uncoverTo   = 'polygon(0% 0%, ' + (-SLANT) + '% 0%, 0% 100%, 0% 100%)';

    const curtain = document.createElement('div');
    Object.assign(curtain.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '100000',
        pointerEvents: 'auto', // 遷移中の操作を吸収してブロック
        // 市松模様（ビューポートに固定＝模様自体は動かない）
        background: `repeating-conic-gradient(${blue} 0% 25%, ${white} 0% 50%) 0 0 / ${CELL * 2}px ${CELL * 2}px`,
        // 初期状態は何も見えない（右端に斜めに張り付いている）
        clipPath: coverFrom,
    });
    document.body.appendChild(curtain);

    const easing = 'cubic-bezier(0.65, 0, 0.35, 1)';
    const coverMs = 460;
    const uncoverMs = 460;

    // 第1段階: 右から左へ斜めに覆っていく（表示範囲が右端→全面へ広がる）
    const cover = curtain.animate(
        [
            { clipPath: coverFrom },
            { clipPath: coverTo },
        ],
        { duration: coverMs, easing, fill: 'forwards' },
    );

    cover.onfinish = () => {
        // 完全に覆われた状態で中身を差し替える
        render();

        // 第2段階: そのまま斜めに左へ抜ける（表示範囲が全面→左端へ縮む）
        const uncover = curtain.animate(
            [
                { clipPath: uncoverFrom },
                { clipPath: uncoverTo },
            ],
            { duration: uncoverMs, easing, fill: 'forwards' },
        );
        const done = () => {
            curtain.remove();
            transitioning = false;
        };
        uncover.onfinish = done;
        uncover.oncancel = done;
    };
    cover.oncancel = () => {
        curtain.remove();
        transitioning = false;
        render();
    };
}
