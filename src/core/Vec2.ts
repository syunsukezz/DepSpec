/**
 * Vec2.ts
 * 2D ベクトルを表す型と基本演算のユーティリティ。
 * ゲーム内の座標・速度・サイズなど、あらゆる2次元の値に使う。
 */

/** 2Dベクトル型。x: 右方向, y: 上方向 */
export type Vec2 = {
  x: number;
  y: number;
};

/** Vec2 を生成するファクトリ関数 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

/** ゼロベクトル（原点）を返す */
export function vec2Zero(): Vec2 {
  return { x: 0, y: 0 };
}

/** 2つの Vec2 を加算した新しい Vec2 を返す */
export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** 2つの Vec2 を減算した新しい Vec2 を返す */
export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** Vec2 をスカラー倍した新しい Vec2 を返す */
export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
