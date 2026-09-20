// 白い未来的な空間の中心に、SDF のオブジェクトが 1 つ浮いている。
//
//   空間   : 巨大な白いドーム (rib と天井の光パネル)。床は光沢のある白で、地平に向かって霞む
//   object : 白いセラミックの殻 + 黒い核 + 発光する輪。iMotion (= 再生中かどうか) で姿が変わる
//            停止中: 閉じた卵。パッドのすぐ上で直立して静止し、合わせ目から光が呼吸するように漏れる
//            再生中: 浮き上がって殻が赤道で割れ、傾いた軸でゆっくり回る

#define TAU 6.28318530718

const float FLOOR_Y = -1.55;
const float BOUND_R = 1.42; // object を包む球。これの外では raymarch しない
const vec3 KEY_DIR = normalize(vec3(-0.45, 0.85, 0.4));
const vec3 HORIZON = vec3(0.93, 0.94, 0.95);
const vec3 ZENITH = vec3(0.74, 0.79, 0.86);
const vec3 ACCENT = vec3(0.25, 0.85, 1.0);
const float WALL_TOP = radians(6.5);

const float MAT_SHELL = 1.0;
const float MAT_CORE = 2.0;
const float MAT_RING = 3.0;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float smax(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

// 0 = 停止中 (閉じた卵) 〜 1 = 再生中 (開いた球)
float openAmount() {
  return smoothstep(0.0, 1.0, iMotion);
}

// 発光輪の強さ。停止中は待機ランプのようにゆっくり呼吸する
float ringPower() {
  return mix(0.4 + 0.3 * sin(iTime * 1.3), 1.0, openAmount());
}

vec3 objectCenter() {
  float open = openAmount();
  return vec3(0.0, mix(-0.3, 0.0, open) + 0.05 * sin(iMotionTime * 0.6) * open, 0.0);
}

// world → object 空間。再生中は傾いた軸のまわりを回る。停止中は上半分が伸びて卵形になる
vec3 toObject(vec3 p) {
  float open = openAmount();
  p -= objectCenter();
  p.xy *= rot(0.42 * open);
  p.xz *= rot(iMotionTime * 0.15);
  if (p.y > 0.0) p.y /= mix(1.32, 1.0, open);
  return p;
}

float sdRing(vec3 q) {
  return length(vec2(length(q.xz) - 0.75, q.y)) - 0.012;
}

// x = 距離, y = material
vec2 mapObject(vec3 p) {
  vec3 q = toObject(p);
  float r = length(q);

  // 殻: 中空の球を赤道で割り、パネルの継ぎ目を細く切る。閉じている間は髪の毛ほどの合わせ目だけ
  float open = openAmount();
  float shell = abs(r - 1.0) - 0.032;
  shell = smax(shell, -(abs(q.y) - mix(0.003, 0.14, open)), mix(0.008, 0.025, open));
  float seamW = mix(-0.01, 0.007, smoothstep(0.35, 1.0, open));
  float a = mod(atan(q.z, q.x) + TAU / 12.0, TAU / 6.0) - TAU / 12.0;
  float seamLon = abs(sin(a)) * length(q.xz) - seamW;
  float seamLat = abs(abs(q.y) - 0.58) - seamW;
  shell = max(shell, -min(seamLon, seamLat));

  float core = r - 0.74;
  float ring = sdRing(q);

  vec2 res = vec2(shell, MAT_SHELL);
  if (core < res.x) res = vec2(core, MAT_CORE);
  if (ring < res.x) res = vec2(ring, MAT_RING);
  return res;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0008, -0.0008);
  return normalize(
    e.xyy * mapObject(p + e.xyy).x + e.yyx * mapObject(p + e.yyx).x +
    e.yxy * mapObject(p + e.yxy).x + e.xxx * mapObject(p + e.xxx).x);
}

// bounding sphere との交差区間。x > y なら当たらない
vec2 boundHit(vec3 ro, vec3 rd) {
  vec3 oc = ro - objectCenter();
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - BOUND_R * BOUND_R);
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

// 当たれば x = t, y = material。外れは x < 0。glow には発光輪の近くを通った量が積まれる
vec2 marchObject(vec3 ro, vec3 rd, out float glow) {
  glow = 0.0;
  vec2 tb = boundHit(ro, rd);
  if (tb.x > tb.y || tb.y < 0.0) return vec2(-1.0);
  float t = max(tb.x, 0.0);
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    vec2 d = mapObject(p);
    float dr = sdRing(toObject(p));
    glow += ringPower() * 0.0012 / (0.003 + dr * dr * 140.0);
    if (d.x < 0.0006 * t) return vec2(t, d.y);
    t += d.x;
    if (t > tb.y) break;
  }
  return vec2(-1.0);
}

float softShadow(vec3 ro, vec3 rd) {
  vec2 tb = boundHit(ro, rd);
  if (tb.x > tb.y || tb.y < 0.0) return 1.0;
  float t = max(tb.x, 0.02);
  float res = 1.0;
  for (int i = 0; i < 40; i++) {
    float d = mapObject(ro + rd * t).x;
    res = min(res, 5.0 * d / t);
    t += clamp(d, 0.01, 0.2);
    if (res < 0.002 || t > tb.y) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.04 * float(i);
    occ += (h - mapObject(p + n * h).x) * w;
    w *= 0.7;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

// ドームの内側。直接見える背景と、映り込みの両方に使う
vec3 env(vec3 rd) {
  if (rd.y < 0.0) {
    // 下向き = 床 (映り込み用の近似)
    return mix(HORIZON, vec3(0.78, 0.8, 0.83), smoothstep(0.0, -0.7, rd.y));
  }
  float el = asin(clamp(rd.y, 0.0, 1.0));
  float az = atan(rd.z, rd.x);

  // 遠くの壁: 縦長の光のスリットが並ぶ円形ホール。足元は霞んで床に溶ける
  if (el < WALL_TOP) {
    float h = el / WALL_TOP;
    float sx = abs(fract(az / TAU * 60.0) - 0.5);
    float slit = smoothstep(0.1, 0.07, sx) * smoothstep(0.14, 0.2, h) * smoothstep(0.9, 0.84, h);
    float bloom = smoothstep(0.4, 0.0, sx) * smoothstep(0.0, 0.3, h) * smoothstep(1.0, 0.75, h);
    vec3 wall = vec3(0.78, 0.8, 0.84) + vec3(0.7) * slit + vec3(0.1) * bloom;
    wall = mix(HORIZON, wall, smoothstep(0.0, 0.6, h));
    // 壁の上端: 暗い見切りと accent の細い線
    wall *= 1.0 - 0.3 * smoothstep(0.955, 0.97, h);
    wall = mix(wall, ACCENT, 0.7 * smoothstep(0.925, 0.935, h) * smoothstep(0.955, 0.945, h));
    return wall;
  }

  vec3 col = mix(HORIZON * 0.97, ZENITH, smoothstep(WALL_TOP, 1.3, el));

  // rib (経線) と ring (緯線)。地平に近いほど霞んで消える
  float u = az / TAU * 36.0;
  float v = el / radians(9.0);
  float du = abs(fract(u) - 0.5);
  float dv = abs(fract(v) - 0.5);
  float rib = smoothstep(0.47, 0.5, max(du, dv * step(0.5, v)));
  col *= 1.0 - 0.12 * rib;

  // 天井の光の帯: rib 3 本おきに、天頂へ向かって伸びる細長いスリット
  float slit = smoothstep(0.16, 0.1, abs(fract(u / 3.0) - 0.5));
  float panels = slit * smoothstep(0.5, 0.8, el) * smoothstep(1.42, 1.25, el);
  col += vec3(1.0, 0.99, 0.97) * 2.6 * panels;

  // 天頂の oculus
  col += vec3(3.5) * smoothstep(1.4, 1.5, el);
  return col;
}

vec3 shadeObject(vec3 pos, vec3 rd, float mat) {
  if (mat == MAT_RING) return (ACCENT * 3.0 + 1.0) * ringPower();

  vec3 n = calcNormal(pos);
  vec3 r = reflect(rd, n);
  float ao = calcAO(pos, n);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  float key = clamp(dot(n, KEY_DIR), 0.0, 1.0) * softShadow(pos + n * 0.01, KEY_DIR);
  float sky = 0.5 + 0.5 * n.y;

  // 発光輪からの色つきの光
  vec3 q = toObject(pos);
  float dr = sdRing(q);
  vec3 ringLight = ACCENT * ringPower() * 0.45 / (1.0 + 90.0 * dr * dr);
  // 閉じている間、合わせ目から漏れる光
  ringLight += ACCENT * ringPower() * (1.0 - openAmount()) * 1.2 * exp(-abs(q.y) * 38.0);

  if (mat == MAT_CORE) {
    vec3 f0 = vec3(0.05, 0.055, 0.07);
    vec3 F = f0 + (1.0 - f0) * fres;
    vec3 col = env(r) * F * mix(0.35, 1.0, ao);
    col += vec3(0.015) * (key + sky * ao);
    return col + ringLight * 0.6;
  }

  vec3 albedo = vec3(0.9, 0.91, 0.93);
  vec3 ambient = mix(vec3(0.5, 0.51, 0.55), vec3(0.95, 0.97, 1.0), sky) * 0.72 * ao;
  vec3 diff = albedo * (vec3(1.0, 0.98, 0.95) * key * 0.5 + ambient + ringLight);
  float F = 0.04 + 0.96 * fres;
  // 縁でわずかに色が回る (真珠・薄膜っぽさ)
  vec3 irid = 0.5 + 0.5 * cos(TAU * (fres * 1.3 + vec3(0.0, 0.33, 0.67)));
  vec3 spec = env(r) * F * mix(vec3(1.0), irid, 0.3) * mix(0.4, 1.0, ao);
  return diff * (1.0 - F) + spec;
}

// 幅 w の線 (中心 0)。fw = その座標の画面上の変化量
float aaLine(float x, float w, float fw) {
  return 1.0 - smoothstep(w, w + fw * 1.5, abs(x));
}

vec3 shadeFloor(vec3 pos, vec3 rd, float t) {
  vec3 col = vec3(0.9, 0.91, 0.925);

  // object が落とす影: 天井全体からの柔らかい遮蔽 + key light の影
  vec3 c = objectCenter();
  vec3 di = c - pos;
  float l = length(di);
  float occ = clamp(di.y / l, 0.0, 1.0) * (1.0 / (l * l));
  col *= 1.0 - 0.55 * clamp(occ * 1.6, 0.0, 1.0);
  col *= mix(0.8, 1.0, softShadow(pos, KEY_DIR));

  // grid と、object の真下の円形パッド
  float fade = exp(-0.06 * t);
  vec2 g = pos.xz;
  vec2 fg = fwidth(g);
  float grid = max(aaLine(fract(g.x - 0.5) - 0.5, 0.004, fg.x), aaLine(fract(g.y - 0.5) - 0.5, 0.004, fg.y));
  vec2 g4 = g / 4.0;
  float major = max(aaLine(fract(g4.x - 0.5) - 0.5, 0.003, fg.x / 4.0), aaLine(fract(g4.y - 0.5) - 0.5, 0.003, fg.y / 4.0));
  col *= 1.0 - (0.08 * grid + 0.14 * major) * fade;

  float rr = length(pos.xz - c.xz);
  float fr = fwidth(rr);
  float rings = aaLine(rr - 1.6, 0.012, fr) + aaLine(rr - 1.78, 0.003, fr) + aaLine(rr - 3.1, 0.003, fr);
  float az = atan(pos.z - c.z, pos.x - c.x) + iMotionTime * 0.05;
  float ticks = aaLine(fract(az / TAU * 72.0) - 0.5, 0.06, fwidth(az) * 72.0 / TAU) *
                step(1.64, rr) * step(rr, 1.74);
  col = mix(col, vec3(0.35, 0.38, 0.42), clamp(rings + ticks, 0.0, 1.0) * 0.55 * fade);
  // パッドの一部だけ accent 色の弧
  float arc = aaLine(rr - 1.6, 0.012, fr) * smoothstep(0.75, 0.8, sin(az * 1.0));
  col = mix(col, ACCENT * 0.9, arc * 0.9 * ringPower());

  // 光沢: object と空間が映り込む
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 r = reflect(rd, n);
  float glow;
  vec2 hit = marchObject(pos + n * 0.002, r, glow);
  vec3 refl = hit.x > 0.0 ? shadeObject(pos + r * hit.x, r, hit.y) : env(r);
  refl = mix(refl, ACCENT * 1.5, clamp(glow, 0.0, 1.0) * 0.5);
  float F = 0.05 + 0.95 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
  col = mix(col, refl, clamp(F * 1.4, 0.0, 1.0) * 0.6);

  // 遠くは地平の色に溶ける
  float fog = 1.0 - exp(-pow(t * 0.045, 2.0));
  return mix(col, HORIZON, fog);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  // カメラ: わずかに左右へ揺れる
  float sway = 0.18 * sin(iMotionTime * 0.08);
  vec3 ro = vec3(8.0 * sin(sway), 0.35, 8.0 * cos(sway));
  vec3 ta = vec3(0.0, -0.22, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.9 * ww);

  float glow;
  vec2 hit = marchObject(ro, rd, glow);
  vec3 col;
  if (hit.x > 0.0) {
    col = shadeObject(ro + rd * hit.x, rd, hit.y);
  } else if (rd.y < 0.0) {
    float t = (FLOOR_Y - ro.y) / rd.y;
    col = shadeFloor(ro + rd * t, rd, t);
  } else {
    col = env(rd);
  }
  // 発光輪のにじみ。白地では足しても見えないので、色を寄せる
  col = mix(col, ACCENT * 1.4 + 0.3, clamp(glow, 0.0, 1.0) * 0.55);

  // 白を保ったまま 0.8 より上だけを滑らかに圧縮する
  vec3 over = max(col - 0.8, 0.0);
  col = min(col, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));

  col *= 1.0 - 0.22 * dot(uv, uv);
  col = pow(col, vec3(1.0 / 2.2));
  // 白のグラデーションの banding 防止
  float noise = fract(sin(dot(fragCoord + fract(iTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (noise - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
