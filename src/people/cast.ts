// из bolnitsa: src/render/cast.ts @ cd7f707 — изменено: только шесть видов пробы, без цветов должностей и оттенков.
// Виды людей пробы (docs/spec.md, «Люди»): кто какой вид, рост. Запекание (bake.ts) берёт рост отсюда.

/** Рост до макушки, м: средний взрослый — 1,76 и 1,64 (мужчины и женщины), пожилые — на 4 см ниже. */
export const STATURE: Record<'m' | 'f', Record<'adult' | 'old', number>> = {
  m: { adult: 1.76, old: 1.72 },
  f: { adult: 1.64, old: 1.6 },
};

export type Use = 'staff' | 'registrar' | 'patient' | 'paramedic';

export interface LookSpec {
  name: string;
  sex: 'm' | 'f';
  age: 'adult' | 'old';
  use: Use;
}

/** Высота сиденья, м (в «Больнице» — catalog.ts): запекание сажает людей на неё; в пробе никто не сидит. */
export const SEAT = 0.38;

const R = (name: string, sex: 'm' | 'f', use: Use, age: 'adult' | 'old' = 'adult'): LookSpec => ({ name, sex, age, use });

/** Шесть видов: врач, медсестра, рабочий в каске, служащая, пожилые пассажир и пассажирка. */
export const LOOKS: LookSpec[] = [
  R('Medical_Male_03', 'm', 'staff'),
  R('Medical_Female_01', 'f', 'staff'),
  R('Construction_Male_01', 'm', 'patient'),
  R('Business_Female_01', 'f', 'registrar'),
  R('Male_Adult_03', 'm', 'patient', 'old'),
  R('Female_Adult_02', 'f', 'patient', 'old'),
];

export const lookSpec = (name: string): LookSpec | undefined => LOOKS.find(l => l.name === name);

/** Рост вида по таблице. */
export const statureOf = (s: Pick<LookSpec, 'sex' | 'age'>) => STATURE[s.sex][s.age];
