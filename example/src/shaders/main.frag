// 白い未来的な空間の中心に、SDF のオブジェクトが 1 つ浮いている。
//
//   空間   : 巨大な白いドーム (rib と天井の光パネル)。床は光沢のある白で、地平に向かって霞む
//            sidechain の低音に反応するのは空間の側 (色ではなく形と動きで):
//              - 低音が立ち上がるたびに床に波紋が走り、その波で床の面が傾いて映り込みが波打つ
//              - 低音が鳴っている間、ホール (壁とドーム) がオブジェクトのまわりを回る
//   climax : iEnergy (automation の Energy、0 = 平時) を上げるほど全体が盛り上がる。回転が速まり、脈打ちが
//            大きくなり、本体のまわりに衛星と破片の群れが増え、カメラが回り込みながら寄って煽る。
//            上のほうではアクセント色が金に変わり、本体から炎のようなオーラが立ち昇る
//   object : 白いセラミックの殻 + 黒い核 + 発光する輪。iMotion (= 再生中かどうか) で姿が変わる
//            停止中: 閉じた卵。パッドのすぐ上で直立して静止し、合わせ目から光が呼吸するように漏れる
//            再生中: 浮き上がって開き、傾いた軸でゆっくり回る。形は iShapeWeights で 3 つの間を morph する
//                    割れた球 / 結晶 (縦長の八面体が割れる) / 輪 (核のまわりを 3 本の帯が回る)

//
// 調整用の値 (色・速さ・大きさ・カメラ ...) は src/tuning.ts にある。大文字の定数のうち、
// この file で宣言していないものは全部そこから埋め込まれる。

#define TAU 6.28318530718

// object を包む球。これの外では raymarch しない
const float BOUND_R = (1.0 + PULSE_SCALE * (1.0 + ENERGY_PULSE)) *
  max(max(1.075 * max(EGG_STRETCH, 1.0), CRYSTAL_SIZE * CRYSTAL_STRETCH + 0.02), RING_RADIUS + 0.06);
const vec3 KEY_DIR = normalize(vec3(-0.45, 0.85, 0.4));
const float WALL_TOP = radians(WALL_TOP_DEG);
// 衛星まで含めて包む球 (破片は raymarch しないので含めない)
const float SWARM_R = SWARM_ORBIT_RADIUS + 2.0 * SWARM_ORBIT_STEP + SWARM_SAT_SIZE * 2.5;

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
float gE;         // クライマックスのノブ 0..1 (動いている間だけ効く)
float gE2;        // その 2 乗。低いうちは穏やかで、上のほうで一気に効かせたい量に使う
float gHot;       // Energy の上のほうだけで立ち上がる量 0..1。色が変わり、オーラが出る
vec3 gAccent;     // いまのアクセント色 (平時 ACCENT → 高まると ENERGY_ACCENT)
float gBoundR;    // raymarch する範囲の半径。群れが出ている間だけ広がる
mat2 gOrbitTiltX[3], gOrbitTiltZ[3];
float gBassWave;  // 低音の立ち上がりから広がる波紋の濃さ 0..1
vec3 gCenter;
vec3 gShape;      // 形の重み [割れた球, 結晶, 輪]。停止中は必ず球 (= 卵) に戻る
mat2 gTilt, gSpin, gBandA, gBandB, gBandC, gBandYaw;

const float SHELL_T = 0.032; // 殻の厚みの半分

void setupObject() {
  gOpen = smoothstep(0.0, 1.0, iMotion);
  gPulse = iPulse * gOpen;
  gE = iEnergy * gOpen;
  gE2 = gE * gE;
  gBoundR = gE < 0.002 ? BOUND_R : SWARM_R;
  gHot = smoothstep(ENERGY_HOT_FROM, 1.0, gE);
  gAccent = mix(ACCENT, ENERGY_ACCENT, gHot);
  gScale = 1.0 + PULSE_SCALE * (1.0 + ENERGY_PULSE * gE2) * gPulse;
  // 停止中は待機ランプのようにゆっくり呼吸し、再生中は拍で明るくなる
  float breath = BREATH_LEVEL + BREATH_DEPTH * sin(iTime * BREATH_SPEED);
  gRingPower = mix(breath, 1.0 + PULSE_GLOW * gPulse, gOpen);
  gCenter = vec3(0.0, mix(REST_Y, HOVER_Y, gOpen) + BOB_AMOUNT * sin(iMotionTime * BOB_SPEED) * gOpen, 0.0);
  gShape = mix(vec3(1.0, 0.0, 0.0), iShapeWeights, gOpen);
  gBassWave = iBassHit * exp(-iBassHitAge * BASS_WAVE_DECAY) * gOpen;

  // 結晶の内側に核が収まる大きさ (面までの距離 - 殻の厚み - 余白)
  float crystalInner = CRYSTAL_SIZE / sqrt(2.0 + 1.0 / (CRYSTAL_STRETCH * CRYSTAL_STRETCH)) - 2.0 * SHELL_T - 0.05;
  gCoreR = mix(CORE_RADIUS, min(CORE_RADIUS, crystalInner), gShape.y);

  gTilt = rot(TILT * gOpen);
  gSpin = rot(iDriveTime * SPIN_SPEED);
  float t = iDriveTime * RING_SPEED;
  gBandA = rot(t);
  gBandB = rot(t * 0.73 + 1.0);
  gBandC = rot(-t * 0.55 + 2.2);
  gBandYaw = rot(1.05);
  // 衛星の 3 つの軌道面の傾き
  gOrbitTiltX[0] = rot(0.35);
  gOrbitTiltZ[0] = rot(0.1);
  gOrbitTiltX[1] = rot(-0.15);
  gOrbitTiltZ[1] = rot(-0.4);
  gOrbitTiltX[2] = rot(-0.25);
  gOrbitTiltZ[2] = rot(0.22);
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

// ---------------------------------------------------------------------------------------------
// 群れ: Energy を上げると本体のまわりに増えていくもの。平時 (Energy 0) は何も無く、計算もしない。
//   衛星: 本体の小さな分身。傾いた 3 つの軌道を回る
//   破片: 細かい欠片。床から現れて、本体のまわりを渦を巻きながら昇る
// どちらも「空間を区切って 1 個ぶんだけ計算する」ので、数が増えても重さはほぼ変わらない。
// 1 個 1 個は番号から決まる閾値を持っていて、Energy がそれを超えた順に膨らんで現れる。
// ---------------------------------------------------------------------------------------------

float hash11(float n) {
  return fract(sin(n * 91.3458) * 47453.5453);
}

// 1 回で 4 つの乱数 (sin を使わないので軽い)
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// Energy が threshold を超えたら、少しかけて 0 → 1 に膨らむ
float appear(float threshold) {
  return smoothstep(threshold, threshold + 0.18, gE);
}

// 群れの 1 個。本体の形に合わせて 球 ↔ 八面体
float sdBit(vec3 p, float s) {
  float d = length(p) - s;
  if (gShape.y > 0.001) d = mix(d, sdOctahedron(p, s * 1.35), gShape.y);
  return d;
}

// 軌道 1 本ぶんの衛星。p は軌道面 (xz) の座標系。x = 距離、y = 0 なら白 / 1 なら黒
vec2 sdOrbit(vec3 p, float radius, float count, float phase, float seed) {
  float rad = length(p.xz);
  float far = length(vec2(rad - radius, p.y)) - SWARM_SAT_SIZE * 2.0;
  if (far > 0.5) return vec2(far, 0.0); // 軌道から遠い: 中身を見ずに粗い距離を返す

  float sector = TAU / count;
  float a = atan(p.z, p.x) + phase;
  float id = mod(floor(a / sector), count);
  float la = mod(a, sector) - 0.5 * sector;
  vec3 q = vec3(cos(la) * rad - radius, p.y, sin(la) * rad);
  if (gShape.y > 0.001) q.xy *= rot(iSwarmTime * 1.7 + id * 2.4); // 結晶の分身は自転する

  float size = SWARM_SAT_SIZE * (0.55 + 0.9 * hash11(id * 1.37 + seed + 3.1));
  size *= appear(0.04 + 0.78 * hash11(id + seed)) * (1.0 + 0.5 * gPulse);
  float d = size > 0.004 ? sdBit(q, size) : 1e3;
  // 空の区画で隣の区画の中身を飛び越えないよう、区画の端までの距離で抑える
  float edge = (0.5 * sector - abs(la)) * rad + 0.05;
  return vec2(min(d, edge), step(0.72, hash11(id * 2.3 + seed + 7.7)));
}

vec2 mapSwarm(vec3 p) {
  p -= gCenter;
  vec2 res = vec2(1e3, 0.0);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec3 o = p;
    o.yz *= gOrbitTiltX[k];
    o.xy *= gOrbitTiltZ[k];
    float dir = k == 1 ? -1.0 : 1.0;
    vec2 s = sdOrbit(o, SWARM_ORBIT_RADIUS + fk * SWARM_ORBIT_STEP, 7.0 + fk * 4.0,
                     iSwarmTime * dir * (0.5 - 0.11 * fk), fk * 17.0);
    if (s.x < res.x) res = s;
  }
  return res;
}

// 本体 + 群れ。x = 距離, y = material
vec2 mapScene(vec3 p) {
  if (gE < 0.002) return mapObject(p);
  // 本体から遠い所では本体の中身を見ない (包む球までの距離で代用)
  float away = length(p - gCenter) - BOUND_R;
  vec2 res = away > 0.3 ? vec2(away, MAT_SHELL) : mapObject(p);
  vec2 s = mapSwarm(p);
  if (s.x < res.x) res = vec2(s.x, s.y > 0.5 ? MAT_CORE : MAT_SHELL);
  return res;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0008, -0.0008);
  return normalize(
    e.xyy * mapScene(p + e.xyy).x + e.yyx * mapScene(p + e.yyx).x +
    e.yxy * mapScene(p + e.yxy).x + e.xxx * mapScene(p + e.xxx).x);
}

// bounding sphere との交差区間。x > y なら当たらない
vec2 boundHit(vec3 ro, vec3 rd, float radius) {
  vec3 oc = ro - gCenter;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - radius * radius);
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

// 当たれば x = t, y = material。外れは x < 0。glow には発光輪の近くを通った量が積まれる
vec2 marchObject(vec3 ro, vec3 rd, out float glow) {
  glow = 0.0;
  vec2 tb = boundHit(ro, rd, gBoundR);
  if (tb.x > tb.y || tb.y < 0.0) return vec2(-1.0);
  float t = max(tb.x, 0.0);
  for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;
    vec2 d = mapScene(p);
    float dr = sdRing(toObject(p));
    glow += gRingPower * 0.0012 / (0.003 + dr * dr * 140.0);
    if (d.x < 0.0006 * t) return vec2(t, d.y);
    t += d.x;
    if (t > tb.y) break;
  }
  return vec2(-1.0);
}

// key light の影。本体のぶんだけ (群れの影までは追わない)
float softShadow(vec3 ro, vec3 rd) {
  vec2 tb = boundHit(ro, rd, BOUND_R);
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
  // 低音でホールが回る。壁は順方向、ドームはゆっくり逆方向 (= 巨大な機構が噛み合って動く感じ)
  float az0 = atan(rd.z, rd.x);
  float az = az0 + iHallAngle;

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
    wall = mix(wall, gAccent, 0.7 * smoothstep(0.925, 0.935, h) * smoothstep(0.955, 0.945, h));
    return wall;
  }

  vec3 col = mix(HORIZON * 0.97, ZENITH, smoothstep(WALL_TOP, 1.3, el));

  // rib (経線) と ring (緯線)。地平に近いほど霞んで消える
  float u = (az0 - 0.6 * iHallAngle) / TAU * DOME_RIBS;
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
  if (mat == MAT_RING) return (gAccent * 3.0 + 1.0) * gRingPower;

  vec3 n = calcNormal(pos);
  vec3 r = reflect(rd, n);
  float ao = calcAO(pos, n);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  float key = clamp(dot(n, KEY_DIR), 0.0, 1.0) * softShadow(pos + n * 0.01, KEY_DIR);
  float sky = 0.5 + 0.5 * n.y;

  // 発光輪からの色つきの光
  vec3 q = toObject(pos);
  float dr = sdRing(q);
  vec3 ringLight = gAccent * gRingPower * 0.45 / (1.0 + 90.0 * dr * dr);
  // 閉じている間、合わせ目から漏れる光
  ringLight += gAccent * gRingPower * (1.0 - gOpen) * SEAM_LEAK * exp(-abs(q.y) * 38.0);

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

// 渦の破片。本体を囲む何層かの円筒の面を (角度, 高さ) の格子に区切り、1 区画に 1 個の小さな球。
// 数が多いので raymarch はしない: ray と円筒の交点を求め、その区画の球とだけ解析的に交差を取る。
// (1 本の ray あたり「層の数 × 2」回の計算で済むので、何千個あっても重さは変わらない)
const float BIT_CELL = 0.5;
const float BIT_TWIST = 0.3; // 高さあたりの角度のずれ (= らせんの傾き)
const int BIT_SHELLS = 5;

// o, d = ray (world)。tBest より手前で当たれば tBest / n / black を更新する
void hitBits(vec3 o, vec3 d, inout float tBest, inout vec3 n, inout float black, inout bool hitBit) {
  o -= gCenter;
  float A = dot(d.xz, d.xz);
  if (A < 1e-5) return;
  float B = dot(o.xz, d.xz);
  for (int k = 0; k < BIT_SHELLS; k++) {
    float fk = float(k);
    float R = SWARM_VORTEX_RADIUS + fk * SWARM_VORTEX_STEP;
    // 交点は粒がはみ出す分だけ外側の円筒で取る (粒に触れる ray は必ずこの円筒を通る)
    float hull = R + SWARM_BIT_SIZE * 2.2;
    float disc = B * B - A * (dot(o.xz, o.xz) - hull * hull);
    if (disc < 0.0) continue;
    float sq = sqrt(disc);
    float count = floor(TAU * R / BIT_CELL);
    float sector = TAU / count;
    // 層ごとに回る向きと速さ、昇る速さを変える
    float spin = iSwarmTime * (0.35 - 0.05 * fk) * (k % 2 == 0 ? 1.0 : -1.0);
    float rise = iSwarmTime * SWARM_RISE_SPEED * (1.0 + 0.2 * fk);

    // 手前側 / 奥側の交点 × (その区画 / 角度方向で近いほうの隣の区画)。斜めの ray で粒が欠けないように
    for (int s = 0; s < 4; s++) {
      float t = (-B + (s < 2 ? -sq : sq)) / A;
      if (t < 0.0 || t > tBest + 0.4) continue;
      vec3 p = o + d * t;
      float ca0 = (atan(p.z, p.x) + spin + p.y * BIT_TWIST) / sector;
      float cx = floor(ca0) + (s % 2 == 0 ? 0.0 : (fract(ca0) > 0.5 ? 1.0 : -1.0));
      vec2 cell = vec2(cx, floor((p.y - rise) / BIT_CELL));
      vec2 id = vec2(mod(cell.x, count), cell.y) + fk * 31.0;
      vec4 h = hash42(id);

      // 区画の中のどこにいるか → world での中心
      vec2 room = max(0.5 * vec2(sector * R, BIT_CELL) - SWARM_BIT_SIZE * 1.5, 0.0);
      vec2 j = (h.xy - 0.5) * 2.0 * room;
      float cy = (cell.y + 0.5) * BIT_CELL + j.y + rise;
      float ca = (cell.x + 0.5) * sector + j.x / R - spin - cy * BIT_TWIST;
      vec3 c = vec3(R * cos(ca), cy, R * sin(ca));

      // 番号ごとの閾値を Energy が超えたら現れる。床から現れて上で消え、拍でわずかに膨らむ
      float size = SWARM_BIT_SIZE * (0.4 + h.z) * appear(0.08 + 0.74 * h.w) * (1.0 + 0.5 * gPulse);
      size *= smoothstep(FLOOR_Y + 0.05, FLOOR_Y + 0.7, cy + gCenter.y) * smoothstep(3.8, 2.6, cy);
      // 目の前を横切る粒は小さくする (画面を塞いで本体が埋もれないように)
      size *= smoothstep(0.8, 3.2, length(c - o));
      if (size < 0.004) continue;

      vec3 oc = o - c;
      float b = dot(oc, d);
      float hh = b * b - (dot(oc, oc) - size * size);
      if (hh < 0.0) continue;
      float tb = -b - sqrt(hh);
      if (tb > 0.0 && tb < tBest) {
        tBest = tb;
        n = normalize(oc + d * tb);
        black = step(0.8, fract(h.z * 7.13));
        hitBit = true;
      }
    }
  }
}

// 破片の見た目。本体の殻 / 核と同じ 2 つの質感 (影や AO までは追わない)
vec3 shadeBit(vec3 n, vec3 rd, float black) {
  vec3 r = reflect(rd, n);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
  float key = clamp(dot(n, KEY_DIR), 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.y;
  if (black > 0.5) {
    vec3 f0 = vec3(0.05, 0.055, 0.07);
    return env(r) * (f0 + (1.0 - f0) * fres) + vec3(0.015) * (key + sky);
  }
  vec3 diff = vec3(0.9, 0.91, 0.93) * (vec3(1.0, 0.98, 0.95) * key * 0.5 + mix(vec3(0.5, 0.51, 0.55), vec3(0.95, 0.97, 1.0), sky) * 0.72);
  float F = 0.04 + 0.96 * fres;
  return diff * (1.0 - F) + env(r) * F;
}

// 値ノイズ (オーラの炎のゆらぎ用)
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash42(i).x;
  float b = hash42(i + vec2(1.0, 0.0)).x;
  float c = hash42(i + vec2(0.0, 1.0)).x;
  float d = hash42(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// オーラ: Energy が高まると、本体から炎のような気が立ち昇る (0..1)。ray が本体の中心軸に
// いちばん近づく点で、炎の輪郭 (下が太く上が細い) の内側にいるかを見る
float auraAmount(vec3 ro, vec3 rd) {
  if (gHot < 0.002) return 0.0;
  vec3 oc = gCenter - ro;
  vec3 pc = rd * dot(oc, rd) - oc; // 中心から見た、ray の最接近点
  float h = pc.y;
  float w = length(pc - vec3(0.0, h, 0.0));
  float side = atan(pc.z, pc.x);
  float flow = iSwarmTime * 1.4;
  float n = vnoise(vec2(side * 2.2, h * 1.1 - flow)) * 0.65 + vnoise(vec2(side * 5.0 + 3.0, h * 2.6 - flow * 1.7)) * 0.35;
  float envelope = mix(2.5, 0.2, smoothstep(-0.9, AURA_HEIGHT, h)) * smoothstep(-1.5, -0.7, h);
  envelope *= (0.62 + 0.75 * n) * (1.0 + 0.3 * gPulse);
  return smoothstep(envelope, envelope * 0.55, w) * gHot;
}

// 幅 w の線 (中心 0)。fw = その座標の画面上の変化量
float aaLine(float x, float w, float fw) {
  return 1.0 - smoothstep(w, w + fw * 1.5, abs(x));
}

// 波紋 1 つぶんを足す。age = 生まれてからの秒、strength = 濃さ
void addWave(float rr, float fr, float age, float strength, inout float wave, inout float slope) {
  float x = rr - (PAD_RADIUS + age * BASS_WAVE_SPEED);
  wave += strength * (aaLine(x, 0.015, fr) + 0.3 * smoothstep(0.7, 0.0, abs(x)));
  slope += strength * exp(-x * x * 3.0) * sin(x * 7.0);
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
  float az = atan(pos.z - c.z, pos.x - c.x) + iDriveTime * PAD_SPIN_SPEED;
  float ticks = aaLine(fract(az / TAU * 72.0) - 0.5, 0.06, fwidth(az) * 72.0 / TAU) *
                step(PAD_RADIUS + 0.04, rr) * step(rr, PAD_RADIUS + 0.14);
  col = mix(col, vec3(0.35, 0.38, 0.42), clamp(rings + ticks, 0.0, 1.0) * 0.55 * fade);
  // パッドの一部だけ accent 色の弧
  float arc = aaLine(rr - PAD_RADIUS, 0.012, fr) * smoothstep(0.75, 0.8, sin(az * 1.0));
  col = mix(col, gAccent * 0.9, arc * 0.9 * gRingPower);

  // 波紋: パッドから外へ走る (細い線 + 淡い帯)。波の位置では床の面がわずかに傾き、
  // 映り込みと光の当たり方が波打つ。低音が立ち上がるたびに 1 つ、Energy が高い時は拍ごとにも 1 つ
  float wave = 0.0;
  float slope = 0.0;
  addWave(rr, fr, iBassHitAge, gBassWave, wave, slope);
  float beatAge = iBeatPhase * 60.0 / max(iTempo, 1.0);
  addWave(rr, fr, beatAge, ENERGY_BEAT_WAVE * gE2 * iPlaying * exp(-beatAge * BASS_WAVE_DECAY), wave, slope);
  col = mix(col, gAccent * 0.9, clamp(wave, 0.0, 1.0) * BASS_WAVE * exp(-0.03 * t));
  slope *= BASS_WAVE_BEND * exp(-0.03 * t);
  vec2 outward = (pos.xz - c.xz) / max(rr, 0.001);
  col *= 1.0 - 1.6 * slope * dot(outward, normalize(KEY_DIR.xz));

  // 光沢: object と空間が映り込む
  vec3 n = normalize(vec3(-slope * outward.x, 1.0, -slope * outward.y));
  vec3 r = reflect(rd, n);
  r.y = abs(r.y);
  float glow;
  vec2 hit = marchObject(pos + n * 0.002, r, glow);
  float tRefl = hit.x > 0.0 ? hit.x : 1e9;
  vec3 bitN;
  float bitBlack;
  bool bitHit = false;
  if (gE > 0.002) hitBits(pos, r, tRefl, bitN, bitBlack, bitHit);
  vec3 refl = bitHit ? shadeBit(bitN, r, bitBlack) : hit.x > 0.0 ? shadeObject(pos + r * hit.x, r, hit.y) : env(r);
  refl = mix(refl, gAccent * 1.5, clamp(glow, 0.0, 1.0) * 0.5);
  float F = 0.05 + 0.95 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 5.0);
  col = mix(col, refl, clamp(F * 1.4, 0.0, 1.0) * FLOOR_REFLECT);

  // 遠くは地平の色に溶ける
  float fog = 1.0 - exp(-pow(t * FOG_DENSITY, 2.0));
  return mix(col, HORIZON, fog);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  setupObject();
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  // カメラ: 平時はわずかに左右へ揺れるだけ。Energy を上げると、本体のまわりを回り込みながら
  // 寄って低くなり、画角が広がって煽りになる。拍ごとに左右交互にわずかに傾く
  uv *= rot(ENERGY_CAM_KICK * gE2 * gPulse * (mod(floor(iBeat), 2.0) < 1.0 ? 1.0 : -1.0));
  float sway = CAM_SWAY * sin(iMotionTime * CAM_SWAY_SPEED) + iOrbitAngle;
  float camDist = CAM_DISTANCE * (1.0 - ENERGY_CAM_PUSH * gE2);
  vec3 ro = vec3(camDist * sin(sway), CAM_HEIGHT - ENERGY_CAM_DROP * gE2, camDist * cos(sway));
  vec3 ta = vec3(0.0, CAM_TARGET_Y, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + (CAM_FOCAL - ENERGY_CAM_WIDEN * gE2) * ww);

  float glow;
  vec2 hit = marchObject(ro, rd, glow);
  vec3 col;
  float tFloor = rd.y < 0.0 ? (FLOOR_Y - ro.y) / rd.y : 1e9;
  float tNear = min(hit.x > 0.0 ? hit.x : 1e9, tFloor);
  vec3 bitN;
  float bitBlack;
  bool bitHit = false;
  if (gE > 0.002) hitBits(ro, rd, tNear, bitN, bitBlack, bitHit);
  if (bitHit) {
    col = shadeBit(bitN, rd, bitBlack);
  } else if (hit.x > 0.0 && hit.x < tFloor) {
    col = shadeObject(ro + rd * hit.x, rd, hit.y);
  } else if (rd.y < 0.0) {
    float t = tFloor;
    col = shadeFloor(ro + rd * t, rd, t);
  } else {
    col = env(rd);
  }
  // オーラ。本体や群れの手前には薄く、背景には濃く乗る (白地なので足さずに色を寄せる)
  float aura = auraAmount(ro, rd) * (bitHit || (hit.x > 0.0 && hit.x < tFloor) ? 0.12 : 1.0);
  col = mix(col, mix(gAccent, vec3(1.0, 0.96, 0.8), aura * aura), aura * AURA_STRENGTH);

  // 発光輪のにじみ。白地では足しても見えないので、色を寄せる
  col = mix(col, gAccent * 1.4 + 0.3, clamp(glow, 0.0, 1.0) * 0.55);

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
