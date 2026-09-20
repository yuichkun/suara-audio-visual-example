import {
  configureWebInput,
  runtime,
  type MidiHandle,
  type TransportHandle,
} from '@suara/sdk';

const KEYS = [
  { note: 60, label: 'C' },
  { note: 62, label: 'D' },
  { note: 64, label: 'E' },
  { note: 65, label: 'F' },
  { note: 67, label: 'G' },
  { note: 69, label: 'A' },
  { note: 71, label: 'B' },
];

/** Vanilla web DAW simulator — only mounted when runtime.isWeb. */
export function mountHud(
  root: HTMLElement,
  opts: {
    transport: TransportHandle;
    midi: MidiHandle;
    onPlayChange?: (playing: boolean) => void;
    onAudioFile?: (file: File) => void | Promise<void>;
  },
): void {
  if (!runtime.isWeb) {
    root.classList.add('vst-hidden');
    return;
  }

  const { transport, midi } = opts;

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.setAttribute('data-testid', 'hud-play');
  playBtn.textContent = 'Play';

  const tempoLabel = document.createElement('label');
  tempoLabel.textContent = 'BPM ';
  const tempoInput = document.createElement('input');
  tempoInput.type = 'number';
  tempoInput.min = '40';
  tempoInput.max = '240';
  tempoInput.value = String(transport.state.tempo);
  tempoInput.setAttribute('data-testid', 'hud-tempo');
  tempoLabel.appendChild(tempoInput);

  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Audio ';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.setAttribute('data-testid', 'hud-file');
  fileLabel.appendChild(fileInput);

  const keys = document.createElement('div');
  keys.id = 'keys';
  keys.setAttribute('data-testid', 'hud-keys');

  for (const k of KEYS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k.label;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      midi.pushNote?.(0, k.note, 0.9);
    });
    b.addEventListener('pointerup', () => midi.pushNote?.(1, k.note, 0));
    b.addEventListener('pointerleave', () => midi.pushNote?.(1, k.note, 0));
    keys.appendChild(b);
  }

  playBtn.addEventListener('click', () => {
    const next = !transport.state.isPlaying;
    transport.setPlaying?.(next);
    playBtn.textContent = next ? 'Stop' : 'Play';
    opts.onPlayChange?.(next);
  });

  tempoInput.addEventListener('change', () => {
    const bpm = Number(tempoInput.value);
    if (Number.isFinite(bpm)) transport.setTempo?.(bpm);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    configureWebInput({ kind: 'file', file }, 'main');
    void opts.onAudioFile?.(file);
  });

  root.append(playBtn, tempoLabel, fileLabel, keys);
}
