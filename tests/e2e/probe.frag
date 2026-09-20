// Encode uniforms into RGBA for readPixels assertions (not shipped to workshop).
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(iTime, iRms, iScene / 255.0, 1.0);
}
