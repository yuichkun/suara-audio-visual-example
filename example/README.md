# example — SuaraVisual

白い未来的なホールの中心に、SDF (raymarching) で描いたオブジェクトが 1 つ浮いている作品。
絵を動かしているのは全部 DAW から来る情報で、Suara の機能をひととおり使っている。

| DAW の何が | 絵の何を動かすか |
|---|---|
| **transport** (再生 / 停止) | 停止中は閉じた卵で静止。再生すると浮き上がって開き、回り始める |
| **transport** (テンポ・拍) | 4 分音符ごとにオブジェクトが脈打つ |
| **automation** `Shape` | 再生中の形を切り替える。0 = 割れた球 / 1 = 結晶 / 2 = 輪。切り替えは必ず morph する |
| **automation** `Energy` | クライマックスのノブ。0 = 平時。上げるほど回転が速まり、まわりに群れが増え、カメラが煽り、最後は金色のオーラをまとう |
| **sidechain** の低音 | 世界の側が反応する。床に波紋が走り、ホールがオブジェクトのまわりを回る |

## 動かす

repo の root で `npm install` を済ませてから:

```bash
npm run dev
```

http://localhost:5173 を開く。右下の小さなアイコンを押すと簡易 DAW シミュレーターが出るので、
Play を押すと動き出す。内蔵のビートか手元の音声ファイルを鳴らせて、`Shape` / `Energy` のスライダーと 1 オクターブの鍵盤もある
(音は Sound を on にした時だけ出る)。本番は DAW で。

### DAW で開く

Suara の CLI が使えるマシンで、この directory (`example/`) から:

```bash
suara build dev
```

```bash
suara register dev
```

`npm run dev` を起動したまま、DAW でトラックに **SuaraVisual (dev)** をインサートする。

- 再生すると動き出す
- `Shape` と `Energy` は automation で書く
- 低音に反応させるには、キックやベースのトラックをこの plugin の **Side-Chain** に送る

ファイルを保存すると、DAW を開いたまま絵に反映される。

## いじる場所

| ファイル | 何があるか |
|---|---|
| [`src/tuning.ts`](src/tuning.ts) | **手で調整する値は全部ここ**。色・速さ・大きさ・カメラ・脈打ちの強さ・Energy の効き方など |
| [`src/shaders/main.frag`](src/shaders/main.frag) | 絵そのもの (GLSL)。空間、オブジェクトの 3 つの形、群れ、オーラ |
| [`src/app-frame.ts`](src/app-frame.ts) | この作品のための値を毎フレーム作る所 (脈打ち、形の重み、低音、Energy で変わる速さ) |
| [`src/params.ts`](src/params.ts) + [`suara.json`](suara.json) | automation param の定義 |
| [`src/uniforms.ts`](src/uniforms.ts) | shader に渡す値の一覧 |
| [`src/main.ts`](src/main.ts) | 全体の配線。Suara SDK → kit → shader |

`src/kit/` と `src/sdk/` は土台で、[CLI](../cli/) が作る project と同じもの。
kit が何をしてくれるかは [src/kit/README.md](src/kit/README.md)。
