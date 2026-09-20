// Scene 0 — time + rms hello
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime * (0.5 + iP2);
  float wave = 0.5 + 0.5 * sin(uv.x * 12.0 + t * 3.0 + iRms * 8.0 * iP3);
  vec3 col = mix(vec3(0.05, 0.08, 0.14), vec3(0.2, 0.7, 1.0), wave * iP0);
  col = mix(col, vec3(1.0, 0.4, 0.8), iHit * 0.6);
  fragColor = vec4(col, 1.0);
}
