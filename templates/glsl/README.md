# __NAME__

Suara の audio visual plugin。DAW の **transport / automation / MIDI / audio (main + sidechain)** を
GLSL の uniform にして、WebGL2 の fullscreen fragment shader で描く。
同じコードがブラウザでも VST plugin の中でも動く。

## 動かす

```bash
npm install
npm run dev
```

http://localhost:5173 を開く。ブラウザでは DAW の入力を SDK が仮想化する。
shader を置くまで画面は黒い。ブラウザでは音は出ない (出力は default で mute)。

DAW で開く:

```bash
suara build dev
```

```bash
suara register dev
```

`npm run dev` を起動したまま DAW で **__NAME__ (dev)** をインサートする。shader を保存すると DAW を開いたまま反映される。

## 触る場所

| ファイル | 役割 |
|---|---|
| `src/shaders/*.frag` | shader (最初は空)。置くだけでファイル名順に Scene 0, 1, 2... になる |
| `src/params.ts` + `suara.json` | automation param。足すと shader で `p<Key>` として使える |
| `src/uniforms.ts` | 自前の uniform を足す場所 |
| `src/main.ts` | 全体の配線 |
| `src/worklets/dsp-worklet.ts` | 音を加工したい時の DSP (default は素通し) |
| `src/kit/` | 土台 (signals / renderer / UI)。読む用、基本は触らない |
| `src/sdk/` | Suara SDK (vendoring 済み)。触らない |

## shader で使える uniform

`void mainImage(out vec4 fragColor, in vec2 fragCoord)` を書くだけ (Shadertoy と同じ)。
一覧の正は `src/kit/glsl/standard-uniforms.ts`。

| 種類 | uniform |
|---|---|
| 画面 / 時間 | `iResolution` `iTime` `iTimeDelta` `iFrame` |
| transport | `iSongTime` `iBeat` `iBar` `iBeatPhase` `iBarPhase` `iTempo` `iPlaying` |
| motion | `iMotion` `iMotionTime` |
| audio (main) | `iLevel` `iRms` `iPeak` `iLow` `iMid` `iHigh` `iOnset` `iLowOnset` `iSpectrum` `iWaveform` |
| audio (sidechain) | `iScLevel` `iScLow` `iScMid` `iScHigh` `iScOnset` `iScLowOnset` `iScSpectrum` |
| MIDI | `iNoteCount` `iLastNote` `iLastVelocity` `iNoteAge` `iMidiLevel` `iNotes` |
| param | `pScene` `pIntensity` `pHue` `pSpeed` `pAudioAmount` |

- `iTime` は常に進む。`iSongTime` / `iBeat` は DAW の再生位置に追従して、止めると止まる
- `iMotion` は「いま動くべきか」に滑らかに追従する 0..1 (default では再生中 = 1)。形や強さの補間に使う。
  `iMotionTime` は `iMotion` で重みづけして進む秒で、止めると減速して止まり、再開すると続きから進む。回転など動きの位相に使う
- `iSpectrum` `iWaveform` `iScSpectrum` `iNotes` は 1 行の texture。`texture(iSpectrum, vec2(x, 0.5)).r`、
  note は `texelFetch(iNotes, ivec2(note, 0), 0).r`

## 制約

- MIDI は note on/off + velocity のみ (CC / pitch bend は来ない)
- `iBeat` は「再生位置 × テンポ」から自前で積んでいる。テンポチェンジのある曲を途中から再生すると DAW の拍とズレる
- 値の更新は画面のフレーム単位 (sample accurate ではない)
