/**
 * Renderer.ts
 * WebGL2 を使った 2D 描画を管理するクラス。
 *
 * 設計方針:
 *   - 色付き矩形: drawRect()
 *   - テクスチャ矩形: drawImage()（タイリング対応）
 *   - loadTextures() で事前にテクスチャを GPU へ転送
 */

import { createShaderProgram, getUniformLocation } from './Shader.ts';
import type { Camera } from './Camera.ts';

// ──────────────────────────────────────────
// シェーダーソース ── 色ベタ塗り
// ──────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_localPos;
uniform mat4 u_projection;
uniform vec2 u_position;
uniform vec2 u_size;
void main() {
  vec2 worldPos = u_position + (a_localPos + 0.5) * u_size;
  gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
}
`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 out_color;
void main() {
  out_color = u_color;
}
`;

// ──────────────────────────────────────────
// シェーダーソース ── テクスチャ
// ──────────────────────────────────────────

const VERT_SRC_TEX = /* glsl */ `#version 300 es
in vec2 a_localPos;
uniform mat4 u_projection;
uniform vec2 u_position;
uniform vec2 u_size;
uniform vec2 u_uvScale;
out vec2 v_texCoord;
void main() {
  vec2 uv = a_localPos + 0.5;          // 0〜1
  vec2 worldPos = u_position + uv * u_size;
  gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
  v_texCoord  = uv * u_uvScale;        // タイリング
}
`;

const FRAG_SRC_TEX = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 out_color;
void main() {
  out_color = texture(u_texture, v_texCoord);
}
`;

// ──────────────────────────────────────────
// 単位クワッド頂点データ
// ──────────────────────────────────────────

const QUAD_VERTICES = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);

// ──────────────────────────────────────────
// Renderer クラス
// ──────────────────────────────────────────

export class Renderer {
  private gl: WebGL2RenderingContext;

  // ── 色ベタ塗りシェーダー ──
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private locProjection: WebGLUniformLocation;
  private locPosition: WebGLUniformLocation;
  private locSize: WebGLUniformLocation;
  private locColor: WebGLUniformLocation;

  // ── テクスチャシェーダー ──
  private texProgram: WebGLProgram;
  private texVAO: WebGLVertexArrayObject;
  private texLocProjection: WebGLUniformLocation;
  private texLocPosition: WebGLUniformLocation;
  private texLocSize: WebGLUniformLocation;
  private texLocUVScale: WebGLUniformLocation;
  private texLocTexture: WebGLUniformLocation;

  /** ロード済みテクスチャ。key → WebGLTexture */
  private textures: Map<string, WebGLTexture> = new Map();

  /** キャッシュ済みの射影行列（両シェーダーへ渡す） */
  private projMatrix: Float32Array = new Float32Array(16);

  private _canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;

    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 がサポートされていません。');
    this.gl = gl;

    // ── 色ベタ塗りシェーダーのセットアップ ──
    this.program = createShaderProgram(gl, VERT_SRC, FRAG_SRC);
    this.vao     = this.buildVAO(this.program);

    gl.useProgram(this.program);
    this.locProjection = getUniformLocation(gl, this.program, 'u_projection');
    this.locPosition   = getUniformLocation(gl, this.program, 'u_position');
    this.locSize       = getUniformLocation(gl, this.program, 'u_size');
    this.locColor      = getUniformLocation(gl, this.program, 'u_color');

    // ── テクスチャシェーダーのセットアップ ──
    this.texProgram = createShaderProgram(gl, VERT_SRC_TEX, FRAG_SRC_TEX);
    this.texVAO     = this.buildVAO(this.texProgram);

    gl.useProgram(this.texProgram);
    this.texLocProjection = getUniformLocation(gl, this.texProgram, 'u_projection');
    this.texLocPosition   = getUniformLocation(gl, this.texProgram, 'u_position');
    this.texLocSize       = getUniformLocation(gl, this.texProgram, 'u_size');
    this.texLocUVScale    = getUniformLocation(gl, this.texProgram, 'u_uvScale');
    this.texLocTexture    = getUniformLocation(gl, this.texProgram, 'u_texture');

    // ── アルファブレンディング ──
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * 単位クワッドの VAO を生成する。
   * 色・テクスチャ両シェーダーで同じ attribute 名 a_localPos を使う。
   */
  private buildVAO(program: WebGLProgram): WebGLVertexArrayObject {
    const gl = this.gl;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('VAO の生成に失敗しました');
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('VBO の生成に失敗しました');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(program, 'a_localPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao;
  }

  // ──────────────────────────────────────────
  // テクスチャ管理
  // ──────────────────────────────────────────

  /**
   * 画像ファイルを非同期でロードし、GPU テクスチャとしてキャッシュする。
   *
   * @param map - { key: URL } の辞書。key は drawImage() の第一引数に使う。
   *
   * 例:
   *   await renderer.loadTextures({
   *     player: '/player.drawio.png',
   *     ground: '/ground.png',
   *   });
   */
  async loadTextures(map: Record<string, string>): Promise<void> {
    const gl = this.gl;

    const promises = Object.entries(map).map(([key, url]) =>
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const tex = gl.createTexture();
          if (!tex) { reject(new Error(`テクスチャ生成失敗: ${key}`)); return; }

          gl.bindTexture(gl.TEXTURE_2D, tex);

          // PNG の Y 軸は上から下 → WebGL UV の Y は下から上なのでフリップ
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

          // タイリングのため REPEAT に設定
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.generateMipmap(gl.TEXTURE_2D);

          this.textures.set(key, tex);
          resolve();
        };
        img.onerror = () => reject(new Error(`画像ロード失敗: ${url}`));
        img.src = url;
      }),
    );

    await Promise.all(promises);
  }

  /** 指定キーのテクスチャがロード済みかどうか */
  hasTexture(key: string): boolean {
    return this.textures.has(key);
  }

  // ──────────────────────────────────────────
  // フレーム制御
  // ──────────────────────────────────────────

  clear(r = 0.53, g = 0.81, b = 0.98): void {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * カメラの射影行列を両シェーダーへ渡す。
   * 毎フレーム drawRect / drawImage の前に呼ぶこと。
   */
  setCamera(camera: Camera): void {
    const gl  = this.gl;
    const mat = camera.getProjectionMatrix();
    this.projMatrix.set(mat);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locProjection, false, mat);

    gl.useProgram(this.texProgram);
    gl.uniformMatrix4fv(this.texLocProjection, false, mat);
  }

  // ──────────────────────────────────────────
  // 描画
  // ──────────────────────────────────────────

  /**
   * 色付き矩形を描画する（テクスチャなし）。
   *
   * @param x - 左下 X（ワールド座標）
   * @param y - 左下 Y（ワールド座標）
   * @param w - 幅
   * @param h - 高さ
   * @param r,g,b - 色（0〜1）
   * @param a - 不透明度（デフォルト 1.0）
   */
  drawRect(
    x: number, y: number,
    w: number, h: number,
    r: number, g: number, b: number, a = 1.0,
  ): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.locPosition, x, y);
    gl.uniform2f(this.locSize,     w, h);
    gl.uniform4f(this.locColor,    r, g, b, a);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * テクスチャ矩形を描画する。
   * テクスチャがロードされていない場合は何もしない。
   *
   * @param key    - loadTextures() で登録したキー
   * @param x      - 左下 X（ワールド座標）
   * @param y      - 左下 Y（ワールド座標）
   * @param w      - 幅
   * @param h      - 高さ
   * @param tilesX - X 方向のタイル回数（デフォルト 1）
   * @param tilesY - Y 方向のタイル回数（デフォルト 1）
   */
  drawImage(
    key: string,
    x: number, y: number,
    w: number, h: number,
    tilesX = 1, tilesY = 1,
  ): void {
    const tex = this.textures.get(key);
    if (!tex) return;

    const gl = this.gl;
    gl.useProgram(this.texProgram);
    gl.bindVertexArray(this.texVAO);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.texLocTexture, 0);

    gl.uniform2f(this.texLocPosition, x, y);
    gl.uniform2f(this.texLocSize,     w, h);
    gl.uniform2f(this.texLocUVScale,  tilesX, tilesY);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  // ──────────────────────────────────────────
  // リサイズ
  // ──────────────────────────────────────────

  resize(width: number, height: number): void {
    this._canvas.width  = width;
    this._canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  get canvas(): HTMLCanvasElement { return this._canvas; }
}
