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
.wd { position: fixed; z-index: 10; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #333; user-select: none; }
.wd * { box-sizing: border-box; }
.wd-icon { right: 16px; bottom: 16px; width: 30px; height: 30px; border: 1px solid #888; border-radius: 50%;
  background: rgba(255,255,255,0.6); opacity: 0.35; cursor: pointer; display: grid; place-items: center; transition: opacity 0.15s; }
.wd-icon:hover, .wd-icon[aria-expanded="true"] { opacity: 1; }
.wd-icon svg { width: 12px; height: 12px; fill: #333; }
.wd-panel { right: 16px; bottom: 56px; width: 340px; padding: 6px 18px 14px; display: none;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid #ccc; border-radius: 8px; }
.wd-panel[data-open="true"] { display: block; }
.wd-section { margin-top: 12px; }
.wd-heading { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 6px; }
.wd-row { display: flex; align-items: center; gap: 10px; min-height: 28px; }
.wd-row + .wd-row { margin-top: 6px; }
.wd label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
.wd input[type="radio"], .wd input[type="checkbox"] { margin: 0; accent-color: #333; }
.wd button { font: inherit; color: inherit; background: #fff; border: 1px solid #bbb; border-radius: 4px;
  padding: 4px 12px; cursor: pointer; white-space: nowrap; }
.wd button:hover { border-color: #333; }
.wd-play { min-width: 84px; }
.wd input[type="number"] { width: 60px; font: inherit; color: inherit; background: #fff; border: 1px solid #bbb;
  border-radius: 4px; padding: 4px 6px; }
.wd-file { display: none; }
.wd-filename { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #888; }
.wd-keys { position: relative; height: 64px; display: flex; }
.wd-keys .white { flex: 1; border: 1px solid #bbb; border-radius: 0 0 4px 4px; background: #fff; padding: 0;
  display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; color: #999; font-size: 10px; }
.wd-keys .white + .white { border-left: none; }
.wd-keys .black { position: absolute; top: 0; width: 8%; height: 60%; background: #333; border: none;
  border-radius: 0 0 3px 3px; padding: 0; }
.wd-keys button[aria-pressed="true"] { background: #999; border-color: #999; color: #fff; }
.wd-params { display: grid; grid-template-columns: auto 1fr 44px; gap: 8px 12px; align-items: center; }
.wd-params input[type="range"] { width: 100%; margin: 0; accent-color: #333; }
.wd-value { text-align: right; color: #888; }
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

function row(...children: Node[]): HTMLElement {
  const r = el('div', 'wd-row');
  r.append(...children);
  return r;
}

function section(heading: string, ...children: Node[]): HTMLElement {
  const s = el('div', 'wd-section');
  s.append(el('div', 'wd-heading', heading), ...children);
  return s;
}

/** radio / checkbox とそのラベル。 */
function choice(type: 'radio' | 'checkbox', name: string, text: string, onChange: (checked: boolean) => void): [HTMLLabelElement, HTMLInputElement] {
  const input = el('input');
  input.type = type;
  input.name = name;
  input.addEventListener('change', () => onChange(input.checked));
  const label = el('label');
  label.append(input, document.createTextNode(text));
  return [label, input];
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
  const play = button('▶ Play', () => setPlaying(!transport.state.isPlaying));
  play.classList.add('wd-play');
  const setPlaying = (on: boolean): void => {
    transport.setPlaying?.(on);
    play.textContent = on ? '■ Stop' : '▶ Play';
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
  const setSource = (toFile: boolean): void => {
    useFile = toFile;
    srcBeatInput.checked = !toFile;
    srcFileInput.checked = toFile;
    connectMain();
    if (transport.state.isPlaying) {
      stopAudio();
      startAudio();
    }
  };
  const file = el('input', 'wd-file');
  file.type = 'file';
  file.accept = 'audio/*';
  const filename = el('span', 'wd-filename', 'no file');
  const chooseFile = button('Choose…', () => file.click());
  const [srcBeat, srcBeatInput] = choice('radio', 'wd-source', 'Beat (built-in)', () => setSource(false));
  const [srcFile, srcFileInput] = choice('radio', 'wd-source', 'File', (checked) => {
    if (!checked) return;
    if (fileBuffer) setSource(true);
    else file.click();
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) {
      setSource(useFile);
      return;
    }
    fileBuffer = await graph.ctx.decodeAudioData(await f.arrayBuffer());
    filename.textContent = f.name;
    filename.title = f.name;
    setSource(true);
  });
  const [sound, soundInput] = choice('checkbox', 'wd-sound', 'Sound out', (on) => graph.setMonitor(on));
  setSource(false);
  soundInput.checked = false;

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
  const whites = KEYS.filter(([, black]) => !black).length;
  let whiteIndex = 0;
  KEYS.forEach(([label, black], i) => {
    const note = BASE_NOTE + i;
    const b = button(black ? '' : label);
    b.classList.add(black ? 'black' : 'white');
    if (black) b.style.left = `calc(${(whiteIndex / whites) * 100}% - 4%)`;
    else whiteIndex++;
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
  const paramGrid = el('div', 'wd-params');
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
    paramGrid.append(el('span', undefined, param.title), slider, value);
  }

  // --- 組み立て ---
  const panel = el('div', 'wd wd-panel');
  panel.setAttribute('data-testid', 'web-daw');
  const bpmLabel = el('label');
  bpmLabel.append(document.createTextNode('BPM'), bpm);
  panel.append(
    section('Transport', row(play, rewind, bpmLabel)),
    section('Audio', row(srcBeat, srcFile, chooseFile, filename, file), row(sound)),
    section('MIDI', keys),
    section('Params', paramGrid),
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
