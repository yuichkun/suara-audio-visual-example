# suara-audio-visual-example

Suara で audio visual を作るための repo。中身は 2 つ。

| | |
|---|---|
| [`example/`](example/) | Suara で作った audio visual の作品例。DAW の再生・automation・sidechain で絵が動く |
| [`cli/`](cli/) | 同じ土台を持った、自分の audio visual plugin project を作る CLI |

どちらも普通の web app (TypeScript + WebGL) で、同じコードがブラウザでも VST plugin の中でも動く。

## 最初に

```bash
npm install
```

## example を見る

```bash
npm run dev
```

http://localhost:5173 を開き、右下のアイコンから簡易 DAW シミュレーターで再生する。
DAW (Cubase など) の中で動かす手順と、作品の中身の説明は [example/README.md](example/README.md)。

## 自分の project を作る

```bash
npm run create -- MyVJ
```

`./MyVJ` に project ができる。使い方は [cli/README.md](cli/README.md)。

## もっと知る

- [example/README.md](example/README.md) — 作品例の仕組みと、いじる場所
- [cli/README.md](cli/README.md) — CLI の使い方と、できる project の中身
- [kit のリファレンス](example/src/kit/README.md) — shader で使える値の一覧、param や uniform の足し方
