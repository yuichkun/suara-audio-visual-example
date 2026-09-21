// automation param の宣言。id と default は suara.json が SSoT で、ここでは title で引く。
// (id を TS 側にも手書きすると、suara.json とズレた瞬間に automation が別の param に当たる)

import { useParam, type ParamHandle } from '@suara/sdk';

/** suara.json の parameters[] のうち使う部分。default は normalized (0..1)。 */
export interface ManifestParam {
  id: number;
  title: string;
  default: number;
}

export interface ParamSpec {
  /** suara.json の parameters[].title と一致させる。 */
  title: string;
  /** 省略時 0..1。 */
  min?: number;
  max?: number;
  /** UI スライダーの刻み (例: 1 = 整数)。 */
  step?: number;
  log?: boolean;
}

export interface BoundParam extends ParamHandle {
  readonly key: string;
  readonly id: number;
  readonly title: string;
  readonly min: number;
  readonly max: number;
  readonly step: number | undefined;
  readonly defaultValue: number;
}

function denormalize(t: number, min: number, max: number, log: boolean): number {
  return log ? min * Math.pow(max / min, t) : min + (max - min) * t;
}

export function defineParams<K extends string>(
  manifest: readonly ManifestParam[],
  specs: Record<K, ParamSpec>,
): Record<K, BoundParam> {
  const out = {} as Record<K, BoundParam>;
  const bound = new Set<number>();

  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key];
    const entry = manifest.find((m) => m.title === spec.title);
    if (!entry) {
      const known = manifest.map((m) => `"${m.title}"`).join(', ');
      throw new Error(
        `[params] "${spec.title}" が suara.json の parameters に無い (あるのは: ${known})`,
      );
    }
    if (bound.has(entry.id)) {
      throw new Error(`[params] suara.json の param id ${entry.id} が二重に使われている`);
    }
    bound.add(entry.id);

    const min = spec.min ?? 0;
    const max = spec.max ?? 1;
    const log = spec.log ?? false;
    const defaultValue = denormalize(entry.default, min, max, log);
    const handle = useParam(entry.id, { min, max, default: defaultValue, log });

    out[key] = {
      key,
      id: entry.id,
      title: entry.title,
      min,
      max,
      step: spec.step,
      defaultValue,
      // handle.value は getter なので spread せずに委譲する
      get value() {
        return handle.value;
      },
      begin: () => handle.begin(),
      setFromUser: (v) => handle.setFromUser(v),
      end: () => handle.end(),
    };
  }

  for (const m of manifest) {
    if (!bound.has(m.id)) {
      console.warn(`[params] suara.json の "${m.title}" (id ${m.id}) はコードから使われていない`);
    }
  }
  return out;
}

/** 現在値を { key: value } に読み出す (out を渡すと使い回す)。 */
export function readParams<K extends string>(
  params: Record<K, BoundParam>,
  out: Record<K, number> = {} as Record<K, number>,
): Record<K, number> {
  for (const key of Object.keys(params) as K[]) out[key] = params[key].value;
  return out;
}
