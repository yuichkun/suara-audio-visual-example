---
name: suara-av
description: Suara で audio visual (VJ) の VST plugin を作る時に使う。この project (create-suara-av で作った Suara plugin project = suara.json と src/kit がある dir) で、shader を書く・DAW の transport / MIDI / automation / 音 (main・sidechain) に絵を反応させる・automation param を足す・ブラウザや DAW で動かす、といった作業をする時に読む。Suara と @suara/sdk の説明、この project の土台 (kit) の使い方、VJ 向けの作り方のコツを扱う。
---

# Suara で audio visual plugin を作る (AI agent 向け)

対象読者 = **この project の中で、人間と一緒に VJ / audio visual の plugin を作る AI agent**。
見た目は人間の作品なので、どう見せるかは人間に聞いて決める。勝手に作り込まず、案を出して合意してから作る。

## Suara とは

- **普通の web app (TypeScript + Web Audio + WebGL) が、そのまま VST3 plugin として DAW (Cubase など) の中で動く** framework。
  plugin の画面は plugin に埋め込まれた Chromium が描き、音は標準の `AudioContext` がそのまま DAW のオーディオ経路に繋がる。
- **同じコードがブラウザでも DAW でも動く。** 開発はブラウザで進め、仕上げと確認を DAW でやる。
  DAW にしか無い入力 (再生位置・MIDI・automation・トラックの音) は、ブラウザでは代わりのものが用意される。
- 現状は PoC 段階: macOS (Apple Silicon) + Cubase で動作確認されている。荒削りな所がある前提で使う。
- plugin 作者が書くのは web app だけ。Suara 本体 (Chromium の改造や engine) には踏み込まない。必要になったら人間に確認する。

## この project の構成

`create-suara-av` で作られた project。`npm run dev` の URL を、ブラウザも DAW 内の plugin も見に行く。

| ファイル | 役割 | 触るか |
|---|---|---|
| `suara.json` | plugin の定義: 名前・uuid・automation param・入出力バス | param の追加だけ。**uuid と name は変えない** (DAW から別の plugin に見える) |
| `src/shaders/main.frag` | 絵 (GLSL) | ここが主戦場 |
| `src/params.ts` | automation param の宣言 (範囲)。id と default は `suara.json` から引く | param を足す時 |
| `src/uniforms.ts` | shader に渡す値の表 | 自前の値を足す時 |
| `src/main.ts` | 配線: Suara SDK → kit → renderer | 構造を変える時 |
| `src/worklets/dsp-worklet.ts` | 音を加工する DSP (最初は素通し) | 音を変えたい時だけ |
| `src/kit/` | 土台。DAW の入力を絵に使いやすい値にして shader に渡す | 基本は読むだけ。リファレンスは **`src/kit/README.md`** |
| `src/sdk/` | Suara SDK (この project に同梱済み) | **編集しない**。API の一次資料として読む |

値の流れ:

```
DAW ─▶ @suara/sdk (useTransport / useMidi / useParam / createDawInput)
    ─▶ kit/signals (createSignals → 毎フレームの Frame)
    ─▶ kit/glsl (uniforms.ts の表どおりに uniform にする)
    ─▶ src/shaders/main.frag
```

## 動かし方

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # 変更したら必ず通す
```

**ブラウザで確認する**: 右下の小さなアイコンを押すと、簡易 DAW シミュレーター (`src/kit/web-daw`) が開く。
Play / BPM、内蔵ビートか音声ファイル (main)、キック (sidechain)、1 オクターブの鍵盤 (PC キーボード `A W S E D F T G Y H U J`)、
automation param のスライダーがある。**停止中は transport が進まない**ので、拍や再生に反応する絵は Play を押さないと動かない。
音は `Sound out` を入れた時だけスピーカーに出る。

**DAW で確認する** (Suara の `suara` CLI が入っているマシンで、この project の dir から):

```bash
suara build dev      # suara.json から release/<Name> (dev).vst3 を作る
suara register dev   # DAW から見える場所に置く
```

`npm run dev` を起動したまま DAW でトラックにインサートする。shader や TS を保存すると DAW を開いたまま反映される。

- agent から `suara` を叩く時は **引数を全部渡す** (省略すると対話 prompt になり、非対話では失敗する)
- 他のコマンド: `suara unregister dev` / `suara list` / `suara destroy`。配布形は `build prod` → `register prod`
- `suara.json` の **param を足したり bus を変えたら、DAW で plugin を読み込み直す**必要がある
- DAW での見た目の確認は agent にはできない。ブラウザで確認できる所まで確認して、DAW での確認は人間に頼む

## @suara/sdk が提供するもの

`src/sdk/` に同梱されている (import は `@suara/sdk`)。**同じ import・同じ呼び出しがブラウザでも DAW でも動く。**
この project に入っているのは Vue に依存しない版で、値は reactive ではない。**毎フレーム読む**使い方をする。
ふつうは kit がこれらを包んでいるので、直接呼ぶのは `main.ts` の配線くらい。

- **`runtime`** — `{ kind: 'vst' | 'web', isVst, isWeb }`。ブラウザ専用の補助 UI を足す時だけ分岐に使う
- **`useTransport()`** — `.state` = `isPlaying` / `tempo` / `isRecording` / `positionSamples` / `timeSigNum` / `timeSigDenom`。
  ⚠️ `positionSamples` はブラウザでは更新されない (kit がブラウザ用の再生位置を持っている)。ブラウザでは `setPlaying` / `setTempo` が生える
- **`useMidi()`** — `.activeNotes` (押されている note の `Set`)、`.on('noteon' | 'noteoff', cb)`。
  note on/off と velocity (0..1) **だけ**。CC や pitch bend は来ない。使う前に `await useMidi().whenReady()`。ブラウザでは `pushNote` が生える
- **`useParam(id, { min, max, default, log? })`** — `.value` が automation の現在値。
  画面側から動かす時は `begin()` → `setFromUser(v)` → `end()` (DAW に automation として録音される)。
  ⚠️ `id` は `suara.json` の `parameters[].id` と一致していないと、automation が別の param に当たる。**この project では `src/params.ts` の `defineParams` が title から id を引くので、id を手で書かない**
- **`createDawInput({ bus: 'main' | 'sidechain' })`** — DAW のトラックの音を `MediaStream` で受ける。
  あとは標準の Web Audio (`ctx.createMediaStreamSource(stream)`)。sidechain を使うには `suara.json` の `buses.audioInputs` に `busType: "aux"` の bus が要る (この project には最初から入っている)

## kit の使い方 (詳細は `src/kit/README.md`)

**shader** — Shadertoy と同じで `void mainImage(out vec4 fragColor, in vec2 fragCoord)` を書くだけ。
`#version` と uniform の宣言は kit が付けるので**自分で書かない**。GLSL ES 3.00 なので `texture()` を使う (`texture2D` は無い)。
コンパイルエラーは console に `.frag` の行番号つきで出る (= 保存したら console を見る)。

**shader で使える値** (一覧の正は `src/kit/glsl/standard-uniforms.ts`)

| 種類 | uniform |
|---|---|
| 画面 / 時間 | `iResolution` `iTime` `iTimeDelta` `iFrame` |
| transport | `iSongTime` `iBeat` `iBar` `iBeatPhase` `iBarPhase` `iTempo` `iPlaying` |
| motion | `iMotion` `iMotionTime` |
| 音 (main = このトラック) | `iLevel` `iRms` `iPeak` `iLow` `iMid` `iHigh` `iOnset` `iSpectrum` `iWaveform` |
| 音 (sidechain) | `iScLevel` `iScLow` `iScMid` `iScHigh` `iScOnset` `iScSpectrum` |
| MIDI | `iNoteCount` `iLastNote` `iLastVelocity` `iNoteAge` `iMidiLevel` `iNotes` |
| automation param | `p` + key (`amount` → `pAmount`) |

texture は 1 行: `texture(iSpectrum, vec2(x, 0.5)).r`、note は `texelFetch(iNotes, ivec2(note, 0), 0).r` (0..127)。

**automation param を足す** — 3 手順:
1. `suara.json` の `parameters` に `{ "id": <他と被らない数字>, "title": "Glow", "default": 0.0, "flags": ["automatable"] }` (default は 0..1 の正規化値)
2. `src/params.ts` に `glow: { title: 'Glow', min: 0, max: 2 }` (title が一致しないと起動時に throw する)
3. shader で `pGlow`。TS では `frame.params.glow`

既にある param の **id は詰めたり振り直したりしない** (DAW に書いた automation が別の param に当たる)。

**自前の値を shader に渡す** — `src/uniforms.ts` の表に 1 行:
`{ name: 'iKick', type: 'float', get: (f) => f.sidechain.onset }`。type は `float` / `vec2`〜`vec4` / `texture`。
状態を持つ値 (積算・平滑化したもの) は、`main.ts` のループで `Frame` に足してから表で読む。

**TS の値を shader の定数にする** — `createGlslRenderer(canvas, uniforms, { constants: { SPEED: 0.5, TINT: [1, 0.8, 0.2] } })`
→ shader で `const float SPEED` / `const vec3 TINT`。**人間が手で調整する値は 1 つの TS ファイルに集めて、これで渡す**と、人間が触りやすい。

**signals の部品** (`src/kit/signals`): `pulse(beat, 1)` 拍の頭で 1 → 減衰 / `phase(beat, 4)` 4 拍で 0..1 / `createStepTrigger(4)` 4 拍ごとに発火 /
`follow` `smoothTo` fps に依存しない平滑化 / `createOnsetDetector` 立ち上がり検出 / `createBlendWeights(n, seconds)` 値の切り替えを重みの morph にする /
`createMotion` 「いま動くべきか」のスイッチ。

## VJ / audio visual を作る時のコツ

**時間は 3 種類を使い分ける**
- `iTime` — 常に進む。背景のゆらぎなど、再生に関係ないもの
- `iSongTime` / `iBeat` / `iBeatPhase` — DAW の再生位置そのもの。曲の同じ場所で同じ絵にしたい時、拍に合わせたい時。止めると止まり、locate すると飛ぶ
- `iMotionTime` — 再生中だけ進み、止めると減速して止まり、再開すると続きから進む。回転や移動の位相に向く。`iMotion` (0..1) は再生 / 停止のなめらかな切り替え

**拍に合わせるなら、音の解析ではなく transport を使う。** `iBeatPhase` は DAW と同じ時刻で、遅れもブレも無い。
拍の頭で跳ねる動きは `exp(-iBeatPhase * k)`。音の解析 (onset) は数十 ms 遅れるので、「音量に応じて」「低音に応じて」のような連続的な反応に使う。

**速さを変えるものは、`時間 × 速さ` と書かない。** 速さが変わった瞬間に位置が飛ぶ。
速さを automation や音で変えたいなら、TS 側で `phase += dt * speed` と積算して uniform で渡す。

**値の切り替えは必ず補間する。** automation の値は段差で来ることがある。形やシーンの切り替えは `createBlendWeights` で重みにして、shader 側で混ぜる。
SDF なら `mix(dA, dB, w)` で形が morph する (薄い形どうしは途中で消えるので、「中身の詰まった立体を混ぜてから、くり抜く」順にする)。

**キックや低音に反応させるなら sidechain。** DAW でキックのトラックをこの plugin の Side-Chain に送ってもらい、`iScLevel` / `iScLow` / `iScOnset` を見る。
main (このトラックの音) から低音を拾うより確実。

**反応は「値を見せる」のではなく「世界が動く」形にする。** 音量をそのままメーターや棒の高さにすると、計器に見える。
形の変形・回転・カメラ・波紋など、絵の中の物や視点が物理的に動く形に置き換えると作品になる。

**1 つのノブで盛り上げる。** 曲の展開に合わせたい時は、`Energy` のような param を 1 つ作り、速さ・数・カメラ・強さをまとめてそれに繋ぐ。
効きは 2 乗にすると、低いうちは穏やかで上のほうで一気に効く。人間は DAW でその 1 本を描くだけで済む。

**重さ** — fullscreen の fragment shader は画素数 × 1 画素の重さ。
- raymarch は「物がある範囲 (包む球など) の外では回さない」。数が多い物は、空間を区切って 1 個ぶんだけ計算する (domain repetition) か、解析的に交差を取る
- 重い時は `createGlslRenderer` の `maxPixelRatio` を下げる (default 2)
- ブラウザの console で fps を測ってから人間に渡す。DAW の plugin 画面は小さいとは限らない

**白い / 明るい絵では、光を「足して」も見えない。** 加算のグローは白地では飽和して消える。色を `mix` で寄せるか、まわりを暗くして見せる。

## やってはいけないこと

- `src/sdk/` を編集しない。`suara.json` の uuid / name を変えない。既存の param の id を振り直さない
- **AudioWorklet (`src/worklets/`) の中で `Atomics.wait`・ログ出力・大きな確保をしない** (音が途切れる / 固まる)
- **DAW の中では音を止めない。** これは effect plugin で、トラックの音は `audio-graph.ts` をそのまま通って DAW に戻る。VST runtime で出力を絞ると、そのトラックが無音になる
- **ブラウザで勝手に音を鳴らさない。** ブラウザの出力は default で mute。鳴らすのは人間が `Sound out` を入れた時だけ
- `vite.config.ts` の COOP / COEP ヘッダを外さない (SDK が使う `SharedArrayBuffer` に必要)
- 絵の描画を音の処理に依存させない (DAW は画面だけの instance に音を流さないことがある)。描画は `requestAnimationFrame` で回す
- Suara 本体の仕組み (Chromium の改造、engine、DAW との橋渡し) を直そうとしない。そこに原因がありそうなら人間に伝える

## 進め方

1. 何を作りたいかを人間に聞く。見た目に関わることは案を言葉で出して、合意してから作る
2. `src/shaders/main.frag` を書く。保存 → ブラウザの console にエラーが無いか見る
3. 右下のシミュレーターで Play / 鍵盤 / スライダーを動かして反応を確かめる。`npm run typecheck` を通す
4. 人間が調整したくなる値は、TS の 1 ファイルに集めて定数として shader に渡す
5. DAW での確認 (`suara build dev` → `suara register dev`) と、最終的な見た目の判断は人間に頼む
