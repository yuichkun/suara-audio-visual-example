# kit

Suara で audio visual を作るための土台。DAW から来る情報を「絵に使いやすい値」にして、shader に渡すところまでをやる。

```
Suara SDK ──▶ signals ──▶ Frame ──▶ glsl (uniform にして shader へ)
(useMidi 等)   (この kit)   (1 フレームぶんの値)
```

- [`signals/`](signals/) — DAW の入力 → 値。描画の方法には依存しないので、three.js や p5 で描く時もそのまま使える
- [`audio-graph.ts`](audio-graph.ts) — DAW の音を受ける所。音はそのまま通し、main と sidechain を解析にかける
- [`glsl/`](glsl/) — WebGL2 の fullscreen shader renderer

## shader の書き方

Shadertoy と同じで、`mainImage` を書くだけ。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}
```

`#version` や uniform の宣言は kit が付ける。コンパイルエラーは console に、`.frag` の行番号つきで出る。

## shader で使える値

一覧の正は [`glsl/standard-uniforms.ts`](glsl/standard-uniforms.ts)。

| 種類 | uniform |
|---|---|
| 画面 / 時間 | `iResolution` `iTime` `iTimeDelta` `iFrame` |
| transport | `iSongTime` `iBeat` `iBar` `iBeatPhase` `iBarPhase` `iTempo` `iPlaying` |
| motion | `iMotion` `iMotionTime` |
| audio (main) | `iLevel` `iRms` `iPeak` `iLow` `iMid` `iHigh` `iOnset` `iSpectrum` `iWaveform` |
| audio (sidechain) | `iScLevel` `iScLow` `iScMid` `iScHigh` `iScOnset` `iScSpectrum` |
| MIDI | `iNoteCount` `iLastNote` `iLastVelocity` `iNoteAge` `iMidiLevel` `iNotes` |
| automation param | `p` + param の key (`intensity` → `pIntensity`) |

- **時間は 3 種類ある。** `iTime` は常に進む。`iSongTime` / `iBeat` は DAW の再生位置に追従して、止めると止まる。
  `iMotionTime` は再生中だけ進み、止めると減速して止まり、再開すると続きから進む (回転など「動きの位相」に向く)
- `iMotion` は「いま動くべきか」に滑らかに追従する 0..1 (再生中 = 1)。形や強さの補間に使う
- `iLevel` は音量をなめらかにしたもの、`iOnset` は音の立ち上がりで 1 になって減衰する値
- `iSpectrum` `iWaveform` `iScSpectrum` `iNotes` は 1 行の texture。`texture(iSpectrum, vec2(x, 0.5)).r` で読む。
  `iNotes` は 128 鍵ぶんの envelope で、`texelFetch(iNotes, ivec2(note, 0), 0).r`

TS 側では同じ値が `Frame` (`frame.transport.beat`、`frame.audio.level`、`frame.midi.envelopes` ...) として手に入る。

## 足し方

**automation param を足す**

1. `suara.json` の `parameters` に 1 件足す (`id` は他と被らない数字)
2. `src/params.ts` に 1 行足す: `glow: { title: 'Glow', min: 0, max: 2 }`
3. shader で `pGlow` として使える

`title` が `suara.json` と一致していないと起動時にエラーになる。param を足した後は DAW で plugin を読み込み直す。

**自前の uniform を足す**

`src/uniforms.ts` の表に 1 行足す。GLSL の宣言と毎フレームの受け渡しは表から自動で作られる。

```ts
{ name: 'iKick', type: 'float', get: (f) => f.sidechain.onset },
```

`type` は `float` / `vec2` / `vec3` / `vec4` / `texture` (1 行の `Float32Array`)。

**TS の値を shader の定数にする**

`createGlslRenderer(canvas, uniforms, { constants: { SPEED: 0.5, TINT: [1, 0.8, 0.2] } })` と渡すと、
shader の中で `const float SPEED` / `const vec3 TINT` として使える。調整用の値を TS の 1 ファイルにまとめたい時に。

## 使える部品 (signals)

| | |
|---|---|
| `createSignals()` | 下を全部まとめて、毎フレームの `Frame` を作る |
| `transport` | 再生位置 → beat / bar / phase。`pulse(beat, 1)` = 拍の頭で 1 になって減衰、`createStepTrigger(4)` = 4 拍ごとに発火 |
| `midi` | note ごとの envelope、最後の note、note-on からの経過秒 |
| `audio` | 音量、low / mid / high、onset、spectrum、waveform (main と sidechain の両方) |
| `motion` | 「いま動くべきか」のスイッチ (default は再生中かどうか) |
| `blend` | automation の値の切り替えを、なめらかな重みの移り変わり (= morph) にする |
| `envelope` | fps に依存しない平滑化、onset 検出 |
| `params` | automation param の宣言 |

## 知っておくこと

- MIDI は note on/off と velocity だけ (CC や pitch bend は Suara の SDK に来ない)
- 値が更新されるのは画面の 1 フレームごと
- `iBeat` は「再生位置 × テンポ」から計算している。テンポが一定の曲なら正確。途中でテンポが変わる曲を途中から再生するとズレる
- ブラウザで開いた時は音を出さない (DAW の中では、トラックの音はそのまま通る)
