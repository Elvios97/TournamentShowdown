export const CHAMPIONS_DV_STATS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function clampInteger(value, min, max) {
  const number = Number(value) || 0;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function showdownEvsToChampionsDvs(evs = {}) {
  const values = CHAMPIONS_DV_STATS.map(stat => Number(evs?.[stat] || 0));
  const hasShowdownScaleValue = values.some(value => value > 32);
  const result = {};
  for (const stat of CHAMPIONS_DV_STATS) {
    const value = clampInteger(evs?.[stat], 0, hasShowdownScaleValue ? 252 : 32);
    result[stat] = hasShowdownScaleValue ? Math.round((value / 252) * 32) : value;
  }
  return result;
}

export function normalizeChampionsDvs(dvs = {}) {
  const result = {};
  for (const stat of CHAMPIONS_DV_STATS) result[stat] = clampInteger(dvs?.[stat], 0, 32);
  return result;
}

export function championsDvsForImport(mon = {}) {
  return mon.dvs && Object.keys(mon.dvs).length
    ? normalizeChampionsDvs(mon.dvs)
    : showdownEvsToChampionsDvs(mon.evs);
}
