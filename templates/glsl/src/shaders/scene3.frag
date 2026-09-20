// Scene 3 — homework blank (beat grid)
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float beatFlash = step(0.9, fract(iBeat));
  float grid = step(0.98, fract(uv.x * 8.0)) + step(0.98, fract(uv.y * 4.0));
  vec3 col = vec3(0.03) + grid * 0.15 + beatFlash * iPlaying * vec3(0.3, 0.8, 0.5) * iP0;
  fragColor = vec4(col, 1.0);
}
