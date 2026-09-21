# cli — create-suara-av

Suara の audio visual plugin project を作る CLI。
(Suara 本体の `suara` CLI とは別物。できた project は `suara build dev` にそのまま渡せる)

## 使い方

repo の root で:

```bash
npm run create -- MyVJ
```

`./MyVJ` に project ができる。名前は PascalCase の英数字。

| option | |
|---|---|
| `--vendor <name>` | plugin の vendor 名 (default: `Suara`) |
| `--out <dir>` | 出力先 (default: `./<name>`) |

あとは、できた project の中で:

```bash
npm install
```

```bash
npm run dev
```

DAW で開く手順や最初にやることは、できた project の `README.md` に書いてある。

## できる project

[`templates/glsl/`](templates/glsl/) がそのまま入る (名前と plugin の uuid だけ差し替わる)。

- DAW の再生位置・拍・automation・MIDI・トラックの音・sidechain を、shader で使える値にする土台 (`src/kit/`)
- Shadertoy と同じ書き方の GLSL shader を fullscreen で描く renderer
- shader や値を保存すると、DAW を開いたまま反映される
- AI agent 用の skill (`.claude/skills/suara-av/`)。Suara と SDK、この土台の使い方、audio visual を作る時のコツが書いてあり、
  できた project を Claude Code などで開けば、そのまま自分の plugin 作りを頼める

[`example/`](../example/) はこの土台の上に作った作品例。土台のリファレンスは [kit の README](templates/glsl/src/kit/README.md)。

## この repo を直す人へ

- 土台 (`src/kit` `src/sdk` `src/worklets` と設定ファイル) の正は `templates/glsl/`。`example/` にあるのはその写し。
  土台を直したら `npm run sync:example` で example に写す (ズレていると `npm test` が落ちる)
- Suara 本体の SDK が変わったら `npm run vendor:sdk` で取り込み直す
- テストは repo root の `tests/`。`npm run typecheck` / `npm test` / `npm run test:e2e`
