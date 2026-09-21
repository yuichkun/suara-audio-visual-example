// hello world: DAW から来る値が一通り絵に繋がっている最小の例。
//   iTime      常に進む時間
//   iBeatPhase 拍の中の位置 0..1 (再生中だけ進む)
//   iLevel     トラックの音量 0..1
//   iNotes     MIDI の note ごとの envelope (128 鍵)
//   pAmount    automation param "Amount" (suara.json / params.ts)
// 使える値の一覧は src/kit/README.md
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  // 音量で膨らみ、拍の頭で縮む円
  float radius = 0.15 + 0.3 * iLevel * pAmount - 0.03 * iPlaying * exp(-iBeatPhase * 6.0);
  float circle = smoothstep(0.01, 0.0, length(p) - radius);

  // MIDI: 押した note (C4 = 60 から 1 オクターブ) が横一列に並ぶ
  int note = 60 + int(floor(uv.x * 12.0));
  float env = texelFetch(iNotes, ivec2(note, 0), 0).r;
  float bar = env * smoothstep(0.1, 0.0, abs(uv.y - 0.1));

  vec3 col = vec3(0.08) + 0.04 * sin(iTime + uv.xyx * 3.0);
  col = mix(col, vec3(0.95), circle);
  col = mix(col, vec3(1.0, 0.6, 0.2), bar);
  fragColor = vec4(col, 1.0);
}
