// この作品の「手で調整する値」は全部ここ。
//
//   shader  → src/shaders/*.frag に同名の const として埋め込まれる (shader 側には書かない)。
//             number = float、[r, g, b] = vec3。保存すると reload なしで反映される
//   pulse / bass → 脈打ちと低音反応の効き方。保存すると reload なしで反映される
//   motion / shape → 切り替わりの速さ。反映には reload が要る

export const tuning = {
  motion: {
    /** 再生してから開ききるまでの時定数 (秒)。小さいほど速い。 */
    attack: 0.5,
    /** 止めてから閉じるまでの時定数 (秒)。 */
    release: 0.9,
  },

  // 再生中の形の切り替え (automation の Shape: 0 = 割れた球 / 1 = 結晶 / 2 = 輪)
  shape: {
    /** 切り替えてから morph がほぼ終わるまでの秒数。 */
    morphSeconds: 1.6,
  },

  // 低音への反応 (世界の側が反応する)。sidechain bus の低域を見る
  bass: {
    /** sidechain の低域 (0..1、dB スケール) のうち、floor 以下は無反応、ceil 以上で最大。 */
    floor: 0.35,
    ceil: 0.85,
    /** 反応の立ち上がり / 戻りの時定数 (秒)。 */
    attack: 0.01,
    release: 0.22,
  },

  // 4 つ打ちの脈打ち。位置は transport の拍。再生中は常に脈打つ
  pulse: {
    /** 周期 (拍)。1 = 4 分音符ごと。 */
    cycleBeats: 1,
    /** 減衰の鋭さ。大きいほど短く鋭い。 */
    sharpness: 5,
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
    /** 再生中に浮く高さ (停止中は REST_Y)。 */
    HOVER_Y: 0.12,
    /** 上下の揺れの幅と速さ。 */
    BOB_AMOUNT: 0.05,
    BOB_SPEED: 0.6,
    /** 黒い核の半径 (殻の内側は 0.97)。発光輪は核の表面に乗る。 */
    CORE_RADIUS: 0.74,

    // --- object: 形 1 = 結晶 (縦長の八面体が赤道で割れる) ---
    /** 頂点までの距離 (横方向) と、縦の伸び。 */
    CRYSTAL_SIZE: 1.3,
    CRYSTAL_STRETCH: 1.35,

    // --- object: 形 2 = 輪 (核のまわりを 3 本の帯が別々の軸で回る) ---
    /** いちばん外の輪の半径。内側の 2 本はここから RING_STEP ずつ小さくなる。 */
    RING_RADIUS: 1.22,
    RING_STEP: 0.15,
    /** 帯の幅 (半分) と、回る速さ (rad/秒)。 */
    RING_WIDTH: 0.06,
    RING_SPEED: 0.5,

    // --- object: 脈打ち (pulse が 1 の瞬間にどれだけ変わるか) ---
    /** 大きさ (0.035 = 3.5% 膨らむ)。 */
    PULSE_SCALE: 0.035,
    /** 割れ目が余分に開く量。 */
    PULSE_GAP: 0.02,
    /** 発光輪が余分に明るくなる量 (1 = 2 倍)。 */
    PULSE_GLOW: 0.8,

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

    // --- 世界: 低音 (sidechain) への反応 ---
    /** 低音が立ち上がるたびに、床のパッドから外へ走る波紋の濃さ (0 = 無効 〜 1)。 */
    BASS_WAVE: 0.8,
    /** 波紋の速さ (距離/秒) と、消えていく速さ。 */
    BASS_WAVE_SPEED: 7,
    BASS_WAVE_DECAY: 3.5,

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
