// web-daw: ブラウザで開いた時だけ出る、簡易 DAW シミュレーター。VST runtime では何も出さない。
//
// 右下の小さなアイコンを押すとパネルが開く。中身は DAW から来る入力の代わり:
//   transport  Play / Stop / 頭出し / BPM        → useTransport() の web 用 setter
//   audio      内蔵ビート or 手元の音声ファイル   → audio-graph の inputs (main / sidechain)
//   MIDI       1 オクターブの鍵盤 (PC キーボード A W S E D F T G Y H U J でも弾ける) → useMidi().pushNote
//   params     automation param のスライダー     → param.setFromUser
// 音は default では鳴らない (Sound を on にした時だけスピーカーに出る)。

import { runtime, type MidiHandle, type TransportHandle } from '@suara/sdk';
import type { AudioGraph } from '../audio-graph';
import type { BoundParam, Playhead } from '../signals';
import { createBeatSource } from './beat';

export interface WebDawOptions {
  transport: TransportHandle;
  midi: MidiHandle;
  graph: AudioGraph;
  playhead: Playhead;
  params: Record<string, BoundParam>;
}

const CSS = `
.wd { position: fixed; z-index: 10; font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #333; user-select: none; }
.wd * { box-sizing: border-box; }
.wd-icon { right: 14px; bottom: 14px; width: 28px; height: 28px; border: 1px solid #888; border-radius: 50%;
  background: rgba(255,255,255,0.6); opacity: 0.35; cursor: pointer; display: grid; place-items: center; transition: opacity 0.15s; }
.wd-icon:hover, .wd-icon[aria-expanded="true"] { opacity: 1; }
.wd-icon svg { width: 12px; height: 12px; fill: #333; }
.wd-panel { right: 14px; bottom: 50px; width: 248px; padding: 10px 12px; display: none;
  background: rgba(255,255,255,0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid #ccc; border-radius: 6px; }
.wd-panel[data-open="true"] { display: block; }
.wd-row { display: flex; align-items: center; gap: 6px; margin: 6px 0; }
.wd-label { width: 68px; color: #888; flex: none; }
.wd button { font: inherit; color: inherit; background: transparent; border: 1px solid #bbb; border-radius: 3px;
  padding: 2px 8px; cursor: pointer; }
.wd button:hover { border-color: #333; }
.wd button[aria-pressed="true"] { background: #333; color: #fff; border-color: #333; }
.wd input[type="number"] { width: 48px; font: inherit; color: inherit; background: transparent; border: 1px solid #bbb;
  border-radius: 3px; padding: 2px 4px; }
.wd input[type="range"] { flex: 1; min-width: 0; accent-color: #333; }
.wd-keys { display: flex; gap: 2px; }
.wd-keys button { flex: 1; padding: 6px 0; min-width: 0; }
.wd-keys button.black { background: #333; color: #fff; border-color: #333; }
.wd-keys button.black[aria-pressed="true"], .wd-keys button[aria-pressed="true"] { background: #999; border-color: #999; }
.wd-value { width: 34px; text-align: right; color: #888; flex: none; }
.wd-file { display: none; }
`;

// C から 1 オクターブ: [ラベル, 黒鍵か, PC キー]
const KEYS: ReadonlyArray<readonly [string, boolean, string]> = [
  ['C', false, 'a'], ['C#', true, 'w'], ['D', false, 's'], ['D#', true, 'e'], ['E', false, 'd'], ['F', false, 'f'],
  ['F#', true, 't'], ['G', false, 'g'], ['G#', true, 'y'], ['A', false, 'h'], ['A#', true, 'u'], ['B', false, 'j'],
];
const BASE_NOTE = 60;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, onClick?: () => void): HTMLButtonElement {
  const b = el('button', undefined, text);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function row(label: string, ...children: Node[]): HTMLElement {
  const r = el('div', 'wd-row');
  r.append(el('span', 'wd-label', label), ...children);
  return r;
}

export function mountWebDaw(opts: WebDawOptions): void {
  if (!runtime.isWeb) return;
  const { transport, midi, graph, playhead, params } = opts;
  const style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // --- 音源: 内蔵ビート (main + sidechain) / 音声ファイル (main) ---
  const beat = createBeatSource(graph.ctx);
  beat.sidechain.connect(graph.inputs.sidechain);
  let fileBuffer: AudioBuffer | null = null;
  let fileNode: AudioBufferSourceNode | null = null;
  let useFile = false;
  const connectMain = (): void => {
    try {
      beat.main.disconnect(graph.inputs.main);
    } catch {
      /* まだ繋いでいない */
    }
    if (!useFile) beat.main.connect(graph.inputs.main);
  };
  connectMain();

  const startAudio = (): void => {
    graph.resume();
    beat.start(() => transport.state.tempo);
    if (useFile && fileBuffer) {
      fileNode = graph.ctx.createBufferSource();
      fileNode.buffer = fileBuffer;
      fileNode.loop = true;
      fileNode.connect(graph.inputs.main);
      fileNode.start(0, playhead.read(0).seconds % fileBuffer.duration);
    }
  };
  const stopAudio = (): void => {
    beat.stop();
    fileNode?.stop();
    fileNode = null;
  };

  // --- transport ---
  const play = button('Play', () => setPlaying(!transport.state.isPlaying));
  const setPlaying = (on: boolean): void => {
    transport.setPlaying?.(on);
    play.textContent = on ? 'Stop' : 'Play';
    play.setAttribute('aria-pressed', String(on));
    if (on) startAudio();
    else stopAudio();
  };
  const rewind = button('⏮', () => {
    playhead.seek?.(0);
    if (transport.state.isPlaying) {
      stopAudio();
      startAudio();
    }
  });
  const bpm = el('input');
  bpm.type = 'number';
  bpm.min = '40';
  bpm.max = '240';
  bpm.value = String(transport.state.tempo);
  bpm.addEventListener('change', () => {
    const v = Number(bpm.value);
    if (Number.isFinite(v) && v > 0) transport.setTempo?.(v);
  });

  // --- audio ---
  const srcBeat = button('Beat');
  const srcFile = button('File…');
  const file = el('input', 'wd-file');
  file.type = 'file';
  file.accept = 'audio/*';
  const setSource = (toFile: boolean): void => {
    useFile = toFile;
    srcBeat.setAttribute('aria-pressed', String(!toFile));
    srcFile.setAttribute('aria-pressed', String(toFile));
    connectMain();
    if (transport.state.isPlaying) {
      stopAudio();
      startAudio();
    }
  };
  srcBeat.addEventListener('click', () => setSource(false));
  srcFile.addEventListener('click', () => (fileBuffer ? setSource(true) : file.click()));
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    fileBuffer = await graph.ctx.decodeAudioData(await f.arrayBuffer());
    srcFile.textContent = f.name.length > 14 ? `${f.name.slice(0, 13)}…` : f.name;
    setSource(true);
  });
  const sound = button('Sound', () => setSound(!graph.monitor));
  const setSound = (on: boolean): void => {
    graph.setMonitor(on);
    sound.setAttribute('aria-pressed', String(on));
  };
  setSource(false);
  setSound(false);

  // --- MIDI ---
  const keys = el('div', 'wd-keys');
  const keyButtons = new Map<number, HTMLButtonElement>();
  const held = new Set<number>();
  const noteOn = (note: number): void => {
    if (held.has(note)) return;
    held.add(note);
    midi.pushNote?.(0, note, 0.9);
    keyButtons.get(note)?.setAttribute('aria-pressed', 'true');
  };
  const noteOff = (note: number): void => {
    if (!held.delete(note)) return;
    midi.pushNote?.(1, note, 0);
    keyButtons.get(note)?.setAttribute('aria-pressed', 'false');
  };
  KEYS.forEach(([label, black], i) => {
    const note = BASE_NOTE + i;
    const b = button(label);
    if (black) b.classList.add('black');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      graph.resume();
      noteOn(note);
    });
    b.addEventListener('pointerup', () => noteOff(note));
    b.addEventListener('pointerleave', () => noteOff(note));
    keyButtons.set(note, b);
    keys.appendChild(b);
  });
  const noteForKey = (e: KeyboardEvent): number | null => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return null;
    const i = KEYS.findIndex(([, , key]) => key === e.key.toLowerCase());
    return i < 0 ? null : BASE_NOTE + i;
  };
  window.addEventListener('keydown', (e) => {
    const note = noteForKey(e);
    if (note !== null && !e.repeat) noteOn(note);
  });
  window.addEventListener('keyup', (e) => {
    const note = noteForKey(e);
    if (note !== null) noteOff(note);
  });

  // --- params ---
  const paramRows: HTMLElement[] = [];
  const syncers: Array<() => void> = [];
  for (const param of Object.values(params)) {
    const slider = el('input');
    slider.type = 'range';
    slider.min = String(param.min);
    slider.max = String(param.max);
    slider.step = String(param.step ?? (param.max - param.min) / 1000);
    const value = el('span', 'wd-value');
    let dragging = false;
    slider.addEventListener('pointerdown', () => {
      dragging = true;
      param.begin();
    });
    slider.addEventListener('input', () => {
      if (!dragging) param.begin();
      param.setFromUser(Number(slider.value));
      if (!dragging) param.end();
    });
    const release = (): void => {
      if (!dragging) return;
      dragging = false;
      param.end();
    };
    slider.addEventListener('pointerup', release);
    slider.addEventListener('pointercancel', release);
    let shown = Number.NaN;
    syncers.push(() => {
      const v = param.value;
      if (v === shown) return;
      shown = v;
      value.textContent = param.step !== undefined && Number.isInteger(param.step) ? String(Math.round(v)) : v.toFixed(2);
      if (!dragging) slider.value = String(v);
    });
    paramRows.push(row(param.title, slider, value));
  }

  // --- 組み立て ---
  const panel = el('div', 'wd wd-panel');
  panel.setAttribute('data-testid', 'web-daw');
  panel.append(
    row('transport', play, rewind, bpm, el('span', undefined, 'bpm')),
    row('audio', srcBeat, srcFile, sound, file),
    row('midi', keys),
    ...paramRows,
  );
  panel.addEventListener('pointerdown', () => graph.resume());

  const icon = el('button', 'wd wd-icon');
  icon.type = 'button';
  icon.title = 'DAW simulator';
  icon.setAttribute('data-testid', 'web-daw-icon');
  icon.setAttribute('aria-expanded', 'false');
  icon.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2 1.5v9l8-4.5z"/></svg>';
  icon.addEventListener('click', () => {
    const open = panel.getAttribute('data-open') !== 'true';
    panel.setAttribute('data-open', String(open));
    icon.setAttribute('aria-expanded', String(open));
    graph.resume();
  });

  document.body.append(panel, icon);

  const sync = (): void => {
    for (const s of syncers) s();
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
}
