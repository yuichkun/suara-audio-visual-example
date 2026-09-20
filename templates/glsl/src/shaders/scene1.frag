// Scene 1 — spectrum reaction
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float bin = texture(iSpectrum, vec2(uv.x, 0.5)).r;
  float bar = step(uv.y, bin * (0.3 + iP0));
  vec3 hue = 0.5 + 0.5 * cos(6.2831 * (iP1 + uv.x + iTime * 0.05) + vec3(0.0, 2.0, 4.0));
  vec3 col = mix(vec3(0.02), hue, bar);
  col += iRms * iP3 * 0.2;
  fragColor = vec4(col, 1.0);
}
