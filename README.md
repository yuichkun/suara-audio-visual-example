# suara-audio-visual-example

Suara で audio visual を作るための repo。VJ 合宿のレクチャー用。

成果物は 2 つ:

1. **demo** — この repo の root 自体が Suara plugin project (`SuaraVisual`)。DAW の MIDI / automation / sidechain / transport を全部絵に使う。**表現も UI もまだ何も置いていない** (今あるのは土台だけで、開いても画面は黒いまま)
2. **scaffold CLI** — 同じ土台を持った新しい AV plugin project を作る (`npm run create`)。Suara 本体の CLI とは別物

同じコードがブラウザでも VST plugin の中でも動く。

## 動かす

```bash
npm install
```

```bash
npm run dev
```

http://localhost:5173 を開く。ブラウザでは DAW の入力を SDK が仮想化する。
**ブラウザでは音は出ない** (出力は default で mute。`graph.setMonitor(true)` で鳴る)。

DAW で開く (Suara CLI が使えるマシン):

```bash
suara build dev
```

```bash
suara register dev
```

`npm run dev` を起動したまま DAW で **SuaraVisual (dev)** をインサートする。shader を保存すると DAW を開いたまま反映される。

## 構成

```
suara.json              plugin の定義 (param / bus)。param の id・default はここが SSoT
src/
  main.ts               配線: SDK → signals → renderer
  params.ts             automation param の宣言 (suara.json を title で引く)
  uniforms.ts           shader から見える uniform の表 (標準 + param + 自前)
  scenes.ts             shaders/*.frag を Scene 0, 1, 2... にする
  tuning.ts             手で調整する値は全部ここ (色・速さ・大きさ・カメラ ...)。shader には const として埋め込まれる
  shaders/*.frag        shader
  worklets/             DSP (default は素通し)
  kit/                  ← demo と scaffold で共有する土台
    signals/            DAW の入力 → 絵に使いやすい値。renderer 非依存・ほぼ純関数
      transport.ts        beat / bar / phase、テンポ同期の pulse・trigger
      midi.ts             note ごとの envelope、last note、noteAge
      audio.ts            level / 帯域 / onset / spectrum / waveform (main と sidechain 共用)
      params.ts           suara.json SSoT の param 宣言
      motion.ts           「いま動くべきか」の汎用スイッチ (default: transport が再生中)
      envelope.ts         fps に依存しない平滑化 (follower / onset)
      frame.ts            上を全部まとめて 1 フレームぶんの Frame にする
    audio-graph.ts      main bus の passthrough + main / sidechain の AnalyserNode
    glsl/               WebGL2 fullscreen renderer、標準 uniform、scene 選択
  sdk/                  Suara SDK (vendoring 済み、触らない)
templates/glsl/         scaffold される project の固有ファイル
cli/create.ts           scaffold CLI
```

`kit/signals` は GLSL を知らない。three.js や p5 で描きたくなったら `createSignals()` の `Frame` をそのまま使える。

## Suara の機能 → どこで受けているか

| DAW の機能 | SDK | kit | shader |
|---|---|---|---|
| MIDI | `useMidi()` | `signals/midi.ts` | `iNotes` `iLastNote` `iNoteAge` ... |
| automation (読み / 書き) | `useParam()` | `signals/params.ts` | `pIntensity` ... |
| audio (トラックの音) | `createDawInput({ bus: 'main' })` | `audio-graph.ts` + `signals/audio.ts` | `iLevel` `iSpectrum` ... |
| sidechain | `createDawInput({ bus: 'sidechain' })` | 同上 | `iScLevel` `iScOnset` ... |
| transport / BPM | `useTransport()` | `signals/transport.ts` | `iBeat` `iBeatPhase` `iPlaying` ... |

param は `begin → setFromUser → end` を呼ぶと、VST では DAW に automation として録音される (画面側の操作 UI はまだ無い)。

## shader で使える uniform

`void mainImage(out vec4 fragColor, in vec2 fragCoord)` を書くだけ (Shadertoy と同じ)。
一覧の正は [`src/kit/glsl/standard-uniforms.ts`](src/kit/glsl/standard-uniforms.ts)。

| 種類 | uniform |
|---|---|
| 画面 / 時間 | `iResolution` `iTime` `iTimeDelta` `iFrame` |
| transport | `iSongTime` `iBeat` `iBar` `iBeatPhase` `iBarPhase` `iTempo` `iPlaying` |
| motion | `iMotion` `iMotionTime` |
| audio (main) | `iLevel` `iRms` `iPeak` `iLow` `iMid` `iHigh` `iOnset` `iSpectrum` `iWaveform` |
| audio (sidechain) | `iScLevel` `iScLow` `iScMid` `iScHigh` `iScOnset` `iScSpectrum` |
| MIDI | `iNoteCount` `iLastNote` `iLastVelocity` `iNoteAge` `iMidiLevel` `iNotes` |
| param | `pScene` `pIntensity` `pHue` `pSpeed` `pAudioAmount` `pShape` |
| この作品固有 | `iPulse` (4 つ打ちの脈打ち) `iShapeWeights` (再生中の形 3 つの重み) |

- `iTime` は常に進む。`iSongTime` / `iBeat` は DAW の再生位置に追従して、止めると止まる
- `iMotion` は「いま動くべきか」に滑らかに追従する 0..1 (default では再生中 = 1)。形や強さの補間に使う。
  `iMotionTime` は `iMotion` で重みづけして進む秒で、止めると減速して止まり、再開すると続きから進む。回転など動きの位相に使う
- `iSpectrum` `iWaveform` `iScSpectrum` `iNotes` は 1 行の texture。`texture(iSpectrum, vec2(x, 0.5)).r`、
  note は `texelFetch(iNotes, ivec2(note, 0), 0).r`

### 足し方

- **scene**: `src/shaders/` に `.frag` を置く (ファイル名順)。Scene param の範囲は 0..15 固定なので、後から足しても DAW に書いた automation の意味は変わらない
- **param**: `suara.json` の `parameters` に 1 件足す → `src/params.ts` に 1 行足す → shader で `p<Key>`。title がズレていたら起動時に throw する
- **uniform**: `src/uniforms.ts` の表に 1 行足す。GLSL の宣言と毎フレームの upload は表から生成される

## scaffold CLI

```bash
npm run create -- MyVJ --vendor YourName
```

`templates/glsl/` (project 固有) + root の `src/kit` `src/sdk` `src/worklets` 等 (共有の土台) を合わせて `./MyVJ` を作り、uuid を振り直す。
kit を直せば、以後 scaffold される project にもそのまま入る。`--out <dir>` で出力先を変えられる。

## テスト

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run test:e2e
```

- `npm test` (vitest): signals の純ロジック / SDK の web 経路 / CLI (scaffold した project が typecheck を通るところまで)
- `npm run test:e2e` (Playwright): uniform 表の値が GPU に届く / 全 shader がコンパイルできる / 画面スモーク

## Cubase 実機チェックリスト

bus 構成 (sidechain) を変えたので、`suara build dev` → `suara register dev` のやり直しと plugin の再スキャンが要るかもしれない。

- [ ] プラグイン一覧に **SuaraVisual (dev)** が出て、エラーなしで開く
- [ ] トラックの音が plugin を通過して聞こえる (passthrough)

MIDI / sidechain / transport / automation が実機で届いているかは、画面に出すものを決めてから確認する。

## 制約

- MIDI は note on/off + velocity のみ (CC / pitch bend は SDK に来ない)
- `iBeat` は「再生位置 × テンポ」から自前で積んでいる (SDK に PPQ 位置が無い)。再生中のテンポ変化には追従するが、テンポチェンジのある曲を途中から再生すると DAW の拍とズレる。拍子チェンジも未対応
- 値の更新は画面のフレーム単位 (sample accurate ではない)

## SDK の再 vendor

```bash
npm run vendor:sdk
```

`../suara/poc_v2/sdk/src` (または `SUARA_SDK_SRC`) から `src/sdk/` を作り直す。Vue 依存を外す patch が upstream の変更で当たらなくなったら、黙って通さずに失敗する。
