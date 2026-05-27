function katakanaToHiragana(str: string): string {
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
        const code = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(code);
    });
}

export { katakanaToHiragana };