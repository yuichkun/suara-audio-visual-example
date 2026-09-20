// Scene 2 — MIDI circles
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float note = iLastNote / 127.0;
  float r = 0.05 + iNoteCount * 0.04 + iLastVel * 0.08 + iHit * 0.1;
  float d = length(uv - vec2(note * 1.6 - 0.8, sin(iTime + note * 6.28) * 0.3));
  float ring = smoothstep(r, r - 0.02, d);
  vec3 col = vec3(0.04, 0.05, 0.08);
  col += ring * vec3(0.9, 0.5 + iP1 * 0.4, 0.2) * iP0;
  col += (1.0 - smoothstep(0.0, 0.5, d)) * iNoteCount * 0.05;
  fragColor = vec4(col, 1.0);
}
