// 白い未来的な空間の中心に、SDF のオブジェクトが 1 つ浮いている。
//
//   空間   : 巨大な白いドーム (rib と天井の光パネル)。床は光沢のある白で、地平に向かって霞む
//   object : 白いセラミックの殻 + 黒い核 + 発光する輪。iMotion (= 再生中かどうか) で姿が変わる
//            停止中: 閉じた卵。パッドのすぐ上で直立して静止し、合わせ目から光が呼吸するように漏れる
//            再生中: 浮き上がって開き、傾いた軸でゆっくり回る。形は iShapeWeights で 3 つの間を morph する
//                    割れた球 / 結晶 (縦長の八面体が割れる) / 輪 (核のまわりを 3 本の帯が回る)

//
// 調整用の値 (色・速さ・大きさ・カメラ ...) は src/tuning.ts にある。大文字の定数のうち、
// この file で宣言していないものは全部そこから埋め込まれる。

#define TAU 6.28318530718

// object を包む球。これの外では raymarch しない
const float BOUND_R = (1.0 + PULSE_SCALE) *
  max(max(1.075 * max(EGG_STRETCH, 1.0), CRYSTAL_SIZE * CRYSTAL_STRETCH + 0.02), RING_RADIUS + 0.06);
const vec3 KEY_DIR = normalize(vec3(-0.45, 0.85, 0.4));
const float WALL_TOP = radians(WALL_TOP_DEG);

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

// --- 1 フレームの間は変わらない値。mainImage の頭で setupObject() が埋める ---
float gOpen;      // 0 = 停止中 (閉じた卵) 〜 1 = 再生中 (開いた形)
float gPulse;     // 4 つ打ちの脈打ち 0..1。開いている間だけ効く
float gScale;     // 脈打ちによる膨らみ
float gRingPower; // 発光輪の強さ
float gCoreR;     // 核の半径 (結晶の時は中に収まるよう少し小さくなる)
vec3 gCenter;
vec3 gShape;      // 形の重み [割れた球, 結晶, 輪]。停止中は必ず球 (= 卵) に戻る
mat2 gTilt, gSpin, gBandA, gBandB, gBandC, gBandYaw;

const float SHELL_T = 0.032; // 殻の厚みの半分

void setupObject() {
  gOpen = smoothstep(0.0, 1.0, iMotion);
  gPulse = iPulse * gOpen;
  gScale = 1.0 + PULSE_SCALE * gPulse;
  // 停止中は待機ランプのようにゆっくり呼吸し、再生中は拍で明るくなる
  float breath = BREATH_LEVEL + BREATH_DEPTH * sin(iTime * BREATH_SPEED);
  gRingPower = mix(breath, 1.0 + PULSE_GLOW * gPulse, gOpen);
  gCenter = vec3(0.0, mix(REST_Y, HOVER_Y, gOpen) + BOB_AMOUNT * sin(iMotionTime * BOB_SPEED) * gOpen, 0.0);
  gShape = mix(vec3(1.0, 0.0, 0.0), iShapeWeights, gOpen);

  // 結晶の内側に核が収まる大きさ (面までの距離 - 殻の厚み - 余白)
  float crystalInner = CRYSTAL_SIZE / sqrt(2.0 + 1.0 / (CRYSTAL_STRETCH * CRYSTAL_STRETCH)) - 2.0 * SHELL_T - 0.05;
  gCoreR = mix(CORE_RADIUS, min(CORE_RADIUS, crystalInner), gShape.y);

  gTilt = rot(TILT * gOpen);
  gSpin = rot(iMotionTime * SPIN_SPEED);
  float t = iMotionTime * RING_SPEED;
  gBandA = rot(t);
  gBandB = rot(t * 0.73 + 1.0);
  gBandC = rot(-t * 0.55 + 2.2);
  gBandYaw = rot(1.05);
}

// world → object 空間。再生中は傾いた軸のまわりを回る。停止中は上半分が伸びて卵形になる
vec3 toObject(vec3 p) {
  p -= gCenter;
  p.xy *= gTilt;
  p.xz *= gSpin;
  if (p.y > 0.0) p.y /= mix(EGG_STRETCH, 1.0, gOpen);
  // 脈打ち: 全体がわずかに膨らむ (距離の補正は mapObject 側)
  return p / gScale;
}

float sdRing(vec3 q) {
  return length(vec2(length(q.xz) - (gCoreR + 0.01), q.y)) - 0.012;
}

float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));
}

// 殻の「元の形」(中身の詰まった立体)。球と結晶 (縦長の八面体) の間を重みで混ぜる
float baseSolid(vec3 q) {
  float d = (1.0 - gShape.y) * (length(q) - 1.0);
  if (gShape.y > 0.001) {
    vec3 c = vec3(q.x, q.y / CRYSTAL_STRETCH, q.z);
    d += gShape.y * (sdOctahedron(c, CRYSTAL_SIZE - 0.02) - 0.02);
  }
  return d;
}

// 元の形を radius 倍して中空にし、region (負の側を残す) で切り抜いたもの
float cutShell(vec3 q, float radius, float region, float k) {
  float hollow = abs(baseSolid(q / radius) * radius + SHELL_T) - SHELL_T;
  return smax(hollow, region, k);
}

// 殻。3 つの形はどれも「中空の立体をどこで切り抜くか」の違いとして作ってあるので、
// 重みを動かすと途中で消えたりせず、表面の上で形が連続的に移っていく。
//   割れた球 / 結晶 : 赤道の帯を抜いて上下 2 つに割る
//   輪             : 逆に、3 つの傾いた赤道の帯だけを残す (帯ごとに半径が違う)
float sdShell(vec3 q) {
  float k = mix(0.008, 0.025, gOpen);
  float gap = mix(0.003, GAP_OPEN + PULSE_GAP * gPulse, gOpen);
  float split = gap - abs(q.y);
  float w = gShape.z;

  float d;
  if (w < 0.001) {
    d = cutShell(q, 1.0, split, k);
  } else {
    vec3 a = q;
    a.yz *= gBandA;
    vec3 b = q;
    b.xy *= gBandB;
    vec3 c = q;
    c.xz *= gBandYaw;
    c.yz *= gBandC;
    d = cutShell(q, mix(1.0, RING_RADIUS, w), mix(split, abs(a.y) - RING_WIDTH, w), k);
    d = min(d, cutShell(q, mix(1.0, RING_RADIUS - RING_STEP, w), mix(split, abs(b.y) - RING_WIDTH, w), k));
    d = min(d, cutShell(q, mix(1.0, RING_RADIUS - 2.0 * RING_STEP, w), mix(split, abs(c.y) - RING_WIDTH, w), k));
  }

  // パネルの継ぎ目 (球の時だけ。開ききってから浮かぶ)
  float seamW = mix(-0.01, 0.007, smoothstep(0.35, 1.0, gOpen) * smoothstep(0.6, 1.0, gShape.x));
  if (seamW > -0.009) {
    float ang = mod(atan(q.z, q.x) + TAU / 12.0, TAU / 6.0) - TAU / 12.0;
    float seamLon = abs(sin(ang)) * length(q.xz) - seamW;
    float seamLat = abs(abs(q.y) - 0.58) - seamW;
    d = max(d, -min(seamLon, seamLat));
  }
  return d;
}

// x = 距離, y = material
vec2 mapObject(vec3 p) {
  vec3 q = toObject(p);
  float core = length(q) - gCoreR;
  float ring = sdRing(q);

  vec2 res = vec2(sdShell(q), MAT_SHELL);
  if (core < res.x) res = vec2(core, MAT_CORE);
  if (ring < res.x) res = vec2(ring, MAT_RING);
  res.x *= gScale;
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
  vec3 oc = ro - gCenter;
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
    glow += gRingPower * 0.0012 / (0.003 + dr * dr * 140.0);
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
    float sx = abs(fract(az / TAU * WALL_SLITS) - 0.5);
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
  float u = az / TAU * DOME_RIBS;
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
  if (mat == MAT_RING) return (ACCENT * 3.0 + 1.0) * gRingPower;

  vec3 n = calcNormal(pos);
  vec3 r = reflect(rd, n);
  float ao = calcAO(pos, n);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  float key = clamp(dot(n, KEY_DIR), 0.0, 1.0) * softShadow(pos + n * 0.01, KEY_DIR);
  float sky = 0.5 + 0.5 * n.y;

  // 発光輪からの色つきの光
  vec3 q = toObject(pos);
  float dr = sdRing(q);
  vec3 ringLight = ACCENT * gRingPower * 0.45 / (1.0 + 90.0 * dr * dr);
  // 閉じている間、合わせ目から漏れる光
  ringLight += ACCENT * gRingPower * (1.0 - gOpen) * SEAM_LEAK * exp(-abs(q.y) * 38.0);

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
  vec3 c = gCenter;
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
  float rings = aaLine(rr - PAD_RADIUS, 0.012, fr) + aaLine(rr - (PAD_RADIUS + 0.18), 0.003, fr) +
                aaLine(rr - PAD_RADIUS * 1.94, 0.003, fr);
  float az = atan(pos.z - c.z, pos.x - c.x) + iMotionTime * PAD_SPIN_SPEED;
  float ticks = aaLine(fract(az / TAU * 72.0) - 0.5, 0.06, fwidth(az) * 72.0 / TAU) *
                step(PAD_RADIUS + 0.04, rr) * step(rr, PAD_RADIUS + 0.14);
  col = mix(col, vec3(0.35, 0.38, 0.42), clamp(rings + ticks, 0.0, 1.0) * 0.55 * fade);
  // パッドの一部だけ accent 色の弧
  float arc = aaLine(rr - PAD_RADIUS, 0.012, fr) * smoothstep(0.75, 0.8, sin(az * 1.0));
  col = mix(col, ACCENT * 0.9, arc * 0.9 * gRingPower);

  // 光沢: object と空間が映り込む
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 r = reflect(rd, n);
  float glow;
  vec2 hit = marchObject(pos + n * 0.002, r, glow);
  vec3 refl = hit.x > 0.0 ? shadeObject(pos + r * hit.x, r, hit.y) : env(r);
  refl = mix(refl, ACCENT * 1.5, clamp(glow, 0.0, 1.0) * 0.5);
  float F = 0.05 + 0.95 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
  col = mix(col, refl, clamp(F * 1.4, 0.0, 1.0) * FLOOR_REFLECT);

  // 遠くは地平の色に溶ける
  float fog = 1.0 - exp(-pow(t * FOG_DENSITY, 2.0));
  return mix(col, HORIZON, fog);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setupObject();
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  // カメラ: わずかに左右へ揺れる
  float sway = CAM_SWAY * sin(iMotionTime * CAM_SWAY_SPEED);
  vec3 ro = vec3(CAM_DISTANCE * sin(sway), CAM_HEIGHT, CAM_DISTANCE * cos(sway));
  vec3 ta = vec3(0.0, CAM_TARGET_Y, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + CAM_FOCAL * ww);

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

  col *= 1.0 - VIGNETTE * dot(uv, uv);
  col = pow(col, vec3(1.0 / 2.2));
  // 白のグラデーションの banding 防止
  float noise = fract(sin(dot(fragCoord + fract(iTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (noise - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
