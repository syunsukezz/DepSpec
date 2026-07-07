/**
 * Shader.ts
 * WebGL2 シェーダー（GLSL）のコンパイルとプログラムのリンクを管理するモジュール。
 *
 * 用語メモ:
 *   Vertex Shader   - 頂点ごとに実行される。3D/2D座標 → 画面座標 への変換を担当
 *   Fragment Shader - ピクセルごとに実行される。色の計算を担当
 *   Program         - Vertex + Fragment をリンクした実行可能ユニット
 */

/**
 * GLSL ソースをコンパイルして WebGLShader を返す（内部ユーティリティ）。
 *
 * @param gl     - WebGL2 コンテキスト
 * @param type   - gl.VERTEX_SHADER または gl.FRAGMENT_SHADER
 * @param source - GLSL ソースコード文字列
 * @throws コンパイルエラー時にエラーログ付きの例外をスロー
 */
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  // シェーダーオブジェクトを GPU 上に確保
  const shader = gl.createShader(type);
  if (!shader) throw new Error('シェーダーオブジェクトの生成に失敗しました');

  // GLSL ソースをシェーダーに紐付けてコンパイル
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // コンパイル結果を確認。失敗時はエラーログを出して例外
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '不明なエラー';
    gl.deleteShader(shader); // 失敗したシェーダーは明示的に解放
    const typeName = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
    throw new Error(`${typeName} シェーダーコンパイルエラー:\n${log}`);
  }

  return shader;
}

/**
 * Vertex Shader と Fragment Shader をリンクして WebGLProgram を返す。
 *
 * 使用例:
 *   const program = createShaderProgram(gl, vertSrc, fragSrc);
 *   gl.useProgram(program);
 *
 * @param gl      - WebGL2 コンテキスト
 * @param vertSrc - Vertex Shader の GLSL ソース（#version 300 es を含む）
 * @param fragSrc - Fragment Shader の GLSL ソース（同上）
 * @throws コンパイルまたはリンクエラー時に例外をスロー
 */
export function createShaderProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  // 各シェーダーをコンパイル
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  // Program オブジェクトを作成してシェーダーをアタッチ
  const program = gl.createProgram();
  if (!program) throw new Error('シェーダープログラムの生成に失敗しました');

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // リンク結果を確認
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '不明なエラー';
    gl.deleteProgram(program);
    throw new Error(`シェーダーリンクエラー:\n${log}`);
  }

  // リンク済みの Program に紐付いているので個々のシェーダーは不要になる
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return program;
}

/**
 * シェーダープログラム内の Uniform 変数のロケーションを取得する。
 * Uniform = シェーダー全体で共有される定数（射影行列・色など）。
 *
 * @param gl      - WebGL2 コンテキスト
 * @param program - 対象の WebGLProgram
 * @param name    - GLSL 内での変数名
 * @throws 変数が見つからない場合に例外をスロー
 */
export function getUniformLocation(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  const loc = gl.getUniformLocation(program, name);
  if (loc === null) throw new Error(`Uniform 変数 "${name}" が見つかりません`);
  return loc;
}
