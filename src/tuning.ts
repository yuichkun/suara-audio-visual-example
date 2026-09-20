// この作品の「手で調整する値」は全部ここ。
//
//   shader  → src/shaders/*.frag に同名の const として埋め込まれる (shader 側には書かない)。
//             number = float、[r, g, b] = vec3。保存すると reload なしで反映される
//   motion  → 「動く / 止まる」の切り替わりの速さ (TS 側で使う)。反映には reload が要る

export const tuning = {
  motion: {
    /** 再生してから開ききるまでの時定数 (秒)。小さいほど速い。 */
    attack: 0.5,
    /** 止めてから閉じるまでの時定数 (秒)。 */
    release: 0.9,
  },

  shader: {
    // --- 色 (linear RGB) ---
    /** 地平・霞・床の遠景の色。背景の「白」の基準。 */
    HORIZON: [0.93, 0.94, 0.95],
    /** ドームの天頂の色。 */
    ZENITH: [0.74, 0.79, 0.86],
    /** 発光輪・壁の上端の線・パッドの弧のアクセント色。 */
    ACCENT: [0.25, 0.85, 1.0],

    // --- object: 再生中 (開いた球) ---
    /** 回転の速さ (rad/秒)。 */
    SPIN_SPEED: 0.15,
    /** 回転軸の傾き (rad)。 */
    TILT: 0.42,
    /** 殻の割れ目の半幅。 */
    GAP_OPEN: 0.14,
    /** 上下の揺れの幅と速さ。 */
    BOB_AMOUNT: 0.05,
    BOB_SPEED: 0.6,
    /** 黒い核の半径 (殻の内側は 0.97)。発光輪は核の表面に乗る。 */
    CORE_RADIUS: 0.74,

    // --- object: 停止中 (閉じた卵) ---
    /** 卵の上半分の伸び (1 = 球)。 */
    EGG_STRETCH: 1.32,
    /** 停止中の高さ (再生中は 0)。床は FLOOR_Y。 */
    REST_Y: -0.3,
    /** 合わせ目から漏れる光の呼吸: 明るさの中心・振れ幅・速さ (rad/秒)。 */
    BREATH_LEVEL: 0.4,
    BREATH_DEPTH: 0.3,
    BREATH_SPEED: 1.3,
    /** 閉じている間、合わせ目の周りに漏れる光の強さ。 */
    SEAM_LEAK: 1.2,

    // --- 空間 ---
    FLOOR_Y: -1.55,
    /** 遠くの壁の高さ (仰角、度) と、光のスリットの本数 (1 周あたり)。 */
    WALL_TOP_DEG: 6.5,
    WALL_SLITS: 60,
    /** ドームの rib の本数 (1 周あたり)。 */
    DOME_RIBS: 36,
    /** 床の映り込みの強さ (0..1) と、霞の濃さ。 */
    FLOOR_REFLECT: 0.6,
    FOG_DENSITY: 0.045,
    /** 床のパッド: 輪の半径と、目盛りが回る速さ (rad/秒)。 */
    PAD_RADIUS: 1.6,
    PAD_SPIN_SPEED: 0.05,

    // --- カメラ ---
    CAM_DISTANCE: 8,
    CAM_HEIGHT: 0.35,
    /** 注視点の高さ。 */
    CAM_TARGET_Y: -0.22,
    /** 焦点距離 (大きいほど望遠)。 */
    CAM_FOCAL: 1.9,
    /** 左右の揺れの幅 (rad) と速さ (rad/秒)。 */
    CAM_SWAY: 0.18,
    CAM_SWAY_SPEED: 0.08,

    // --- 仕上げ ---
    VIGNETTE: 0.22,
  },
} as const;
