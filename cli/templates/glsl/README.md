# __NAME__

Suara の audio visual plugin。DAW から来る情報 (再生位置・拍・automation・MIDI・トラックの音・sidechain) を
shader で使える値にして、WebGL2 の fullscreen shader で描く。
同じコードがブラウザでも VST plugin の中でも動く。

## 動かす

```bash
npm install
```

```bash
npm run dev
```

http://localhost:5173 を開く。最初は shader が 1 つも無いので画面は黒い。

DAW で開く (Suara の CLI が使えるマシンで):

```bash
suara build dev
```

```bash
suara register dev
```

`npm run dev` を起動したまま、DAW でトラックに **__NAME__ (dev)** をインサートする。
ファイルを保存すると、DAW を開いたまま絵に反映される。

## 最初にやること

`src/shaders/` に `.frag` を 1 つ置く。Shadertoy と同じで `mainImage` を書くだけ。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}
```

`iBeat` (拍)、`iLevel` (音量)、`iNotes` (MIDI) など、shader で使える値の一覧と、param や uniform の足し方は
[src/kit/README.md](src/kit/README.md)。

## 触る場所

| ファイル | 役割 |
|---|---|
| `src/shaders/*.frag` | shader。複数置くと、ファイル名順に automation の `Scene` で切り替わる |
| `src/params.ts` + `suara.json` | automation param |
| `src/uniforms.ts` | shader に渡す値の一覧 (自前の値はここに足す) |
| `src/main.ts` | 全体の配線。Suara SDK → kit → shader |
| `src/worklets/dsp-worklet.ts` | 音を加工したい時の DSP (最初は素通し) |
| `src/kit/` | 土台。読む用で、基本は触らない |
| `src/sdk/` | Suara SDK。触らない |
