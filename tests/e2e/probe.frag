// uniform の値を色に焼いて readPixels で検証する (e2e 専用)。
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // R = float、G = vec2.x、B = texture の中央 texel
  fragColor = vec4(uA, uB.x, texture(uTex, vec2(0.5, 0.5)).r, 1.0);
}
