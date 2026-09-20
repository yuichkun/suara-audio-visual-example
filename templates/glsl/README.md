# SuaraVisual — Audio Visual Starter for Suara

VJ総会向けのスターターです。DAW（Cubase 等）の **transport / parameters / MIDI / audio** を Shadertoy 風の GLSL uniforms に載せ、WebGL2 の fullscreen fragment で描画します。

同じコードがブラウザでも VST プラグイン内でも動きます（Suara）。

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 — ブラウザでシェーダーを書く
```

DAW で使う場合（Suara CLI が使えるマシン）:

```bash
suara build dev
suara register dev
# Cubase で SuaraVisual (dev) をインサート → Vite が起動していれば HMR
```

## 触る場所

| ファイル | 役割 |
|---|---|
| [`src/shaders/*.frag`](src/shaders/) | GLSL fragment（`mainImage` を書く） |
| [`src/uniforms/derive.ts`](src/uniforms/derive.ts) | CPU 側で uniform を加工する拡張点 |
| [`suara.json`](suara.json) | Scene / Intensity / Hue / Speed / AudioAmount の automation 定義 |

SPA フレームワークは使いません。Vue 依存もありません（SDK はファイルコピーして `reactive` を剥がしています）。

## Shadertoy 風 uniforms

kit が fullscreen triangle の vertex と `void main()` ラッパを付けます。fragment では次が使えます:

| Uniform | 意味 |
|---|---|
| `iResolution` | canvas サイズ (px) |
| `iTime` / `iDelta` | 秒 / フレーム差分 |
| `iBeat` / `iBar` / `iTempo` / `iPlaying` | 拍・小節・BPM・再生中 |
| `iRms` / `iPeak` / `iHit` | 音量・ピーク・短い onset |
| `iNoteCount` / `iLastNote` / `iLastVel` | MIDI |
| `iScene` / `iP0`…`iP3` | Scene とマクロ（Intensity / Hue / Speed / AudioAmount） |
| `iSpectrum` | FFT テクスチャ (`sampler2D`) |

例:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float wave = 0.5 + 0.5 * sin(uv.x * 10.0 + iTime * 2.0 + iRms * 5.0);
  fragColor = vec4(vec3(wave), 1.0);
}
```

新しいシーンを足す: `src/shaders/sceneN.frag` を追加し、[`src/scenes/index.ts`](src/scenes/index.ts) に import する。DAW の **Scene** パラメータでタイムライン切替できます。

## ブラウザ HUD

web runtime では画面下に Play / BPM / ファイル入力 / 簡易鍵盤が出ます。`positionSamples` は **VST 専用**なので、ブラウザでは合成時計で `iTime` が進みます。

## 制約（正直に）

- MIDI は note on/off + velocity のみ（CC なし）
- GPU への反映は rAF（sample-accurate な入力を rAF で uniform 化する）
- 音は passthrough。DSP を足すなら `src/worklets/dsp-worklet.ts`

## テスト

```bash
npm test          # vitest — clock / MIDI / spectrum / SDK web 経路
npm test:e2e      # Playwright — WebGL probe + 画面スモーク
```

## Cubase 実機チェックリスト

- [ ] `suara build dev && suara register dev` 後、プラグイン一覧に **SuaraVisual (dev)** が出る
- [ ] Vite (`npm run dev`) 起動中にウィンドウが開き、絵が出る
- [ ] 再生すると `iTime` / ビート反応が進む（Scene0 の波が動く）
- [ ] Scene パラメータを automation で 0→1→2 と書くとシーンが切り替わる
- [ ] MIDI ノートを送ると Scene2 の円が反応する
- [ ] トラックの音がプラグインを通過して聞こえる（passthrough）
- [ ] Intensity / Hue を動かすと見た目が変わる

## 新しいプロジェクトを scaffold（このリポの CLI）

Suara 本体の CLI には足していません。このリポ専用です:

```bash
npm run create -- MyVJ
# または
node --experimental-strip-types cli/create.ts MyVJ --renderer glsl --vendor YourName
```

`--bind time,audio,midi,beat,params` でデフォルトで載せる uniform 群を選べます（現状 `time` のみの簡略デモあり。他 renderer は後日）。

## SDK の再 vendor

```bash
npm run vendor:sdk
# または SUARA_SDK_SRC=/path/to/poc_v2/sdk/src npm run vendor:sdk
```

## GLSL メモ（Shadertoy から）

- `#version 300 es` は kit が付ける — 自分で書かない
- `texture()` を使う（`texture2D` は ES3 では古い）
- `fragCoord` は `gl_FragCoord.xy` 相当（ラッパが渡す）
