const PetCore = (() => {
  const DAY = 86400000;
  const LEVEL_UNLOCKS = {
    D01: 1, D02: 2, D03: 3, D04: 4, D05: 5, D06: 6, D07: 7,
    D08: 8, D09: 10, D10: 12, D11: 15, D12: 18, D13: 20
  };
  const PRICES = {
    D14: 50, D15: 30, D16: 20, D17: 15, D18: 25, D19: 35,
    D20: 60, D21: 20, D22: 25, D23: 30, D24: 20
  };
  const DECORATIONS = [
    ['D01', '基础草帽', '👒', 'level'], ['D02', '红色围巾', '🧣', 'level'],
    ['D03', '小眼镜', '👓', 'level'], ['D04', '蝴蝶结', '🎀', 'level'],
    ['D05', '小领带', '👔', 'level'], ['D06', '太阳镜', '🕶️', 'level'],
    ['D07', '耳机', '🎧', 'level'], ['D08', '小披风', '🦸', 'level'],
    ['D09', '皇冠', '👑', 'level'], ['D10', '小吉他', '🎸', 'level'],
    ['D11', '小翅膀', '🪽', 'level'], ['D12', '魔法棒', '🪄', 'level'],
    ['D13', '星星光环', '🌟', 'level'], ['D14', '小奖杯', '🏆', 'coins'],
    ['D15', '玫瑰花', '🌹', 'coins'], ['D16', '小爱心', '💗', 'coins'],
    ['D17', '小星星', '⭐', 'coins'], ['D18', '小月亮', '🌙', 'coins'],
    ['D19', '小太阳', '☀️', 'coins'], ['D20', '彩虹', '🌈', 'coins'],
    ['D21', '小云朵', '☁️', 'coins'], ['D22', '小雪花', '❄️', 'coins'],
    ['D23', '小火焰', '🔥', 'coins'], ['D24', '小水滴', '💧', 'coins'],
    ['D25', '闪光星星', '✨', 'achievement'], ['D26', '金色皇冠', '♛', 'achievement'],
    ['D27', '彩虹翅膀', '🪽', 'achievement'], ['D28', '钻石光环', '💎', 'achievement'],
    ['D29', '小精灵', '🧚', 'achievement'], ['D30', '金色小砺', '⚒️', 'achievement']
  ].map(([id, name, emoji, type]) => ({ id, name, emoji, type }));
  const ACHIEVEMENTS = [
    ['D25', '连续 7 天完成所有待办'], ['D26', '连续 30 天每日活跃'],
    ['D27', '等级达到 50'], ['D28', '累计完成 1000 个待办'],
    ['D29', '连续 7 天情绪不低于 80'], ['D30', '满级']
  ].map(([id, name]) => ({ id, name }));

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const dateKey = (now = new Date()) => {
    const date = new Date(now);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };
  const dateValue = key => new Date(`${key}T00:00:00`).getTime();
  const dayDiff = (from, to) => Math.round((dateValue(to) - dateValue(from)) / DAY);
  const threshold = level => 20 + (level - 1) * 5;

  function defaultState(now) {
    return {
      species: 'british-shorthair', hunger: 80, mood: 75, exp: 0, level: 1,
      coins: 0, owned: ['D01'], equipped: ['D01'], totalCompleted: 0,
      loginStreak: 0, lastLoginDate: '', lastWorkAt: new Date(now).toISOString(),
      inactivityPenaltyDays: 0, moodAdjustments: {}, petCounts: {}, dailyStats: {}
    };
  }

  function ensureState(data, now = new Date()) {
    const isNew = !data.pet;
    const defaults = defaultState(now);
    data.pet = { ...defaults, ...(data.pet || {}) };
    ['owned', 'equipped'].forEach(key => {
      if (!Array.isArray(data.pet[key])) data.pet[key] = [...defaults[key]];
    });
    ['moodAdjustments', 'petCounts', 'dailyStats'].forEach(key => {
      if (!data.pet[key] || typeof data.pet[key] !== 'object') data.pet[key] = {};
    });
    runTimeChecks(data, now, isNew);
    return data.pet;
  }

  function addExperience(pet, amount) {
    pet.exp += Number(amount) || 0;
    while (pet.level < 100 && pet.exp >= threshold(pet.level)) {
      pet.exp -= threshold(pet.level);
      pet.level += 1;
    }
    if (pet.level >= 100) pet.exp = 0;
    unlockLevelDecorations(pet);
    checkAchievements(pet);
    return pet;
  }

  function unlockLevelDecorations(pet) {
    Object.entries(LEVEL_UNLOCKS).forEach(([id, level]) => {
      if (pet.level >= level && !pet.owned.includes(id)) pet.owned.push(id);
    });
  }

  function runTimeChecks(data, now = new Date(), isNew = false) {
    const pet = data.pet || (data.pet = defaultState(now));
    const key = dateKey(now);
    if (pet.lastLoginDate !== key) {
      const consecutive = pet.lastLoginDate && dayDiff(pet.lastLoginDate, key) === 1;
      pet.loginStreak = consecutive ? pet.loginStreak + 1 : 1;
      pet.lastLoginDate = key;
      if (!isNew) pet.hunger = clamp(pet.hunger - 5);
      pet.mood = clamp(pet.mood + 2);
      pet.coins += 2;
      addExperience(pet, pet.loginStreak * 2);
    }
    const inactiveDays = Math.max(0, Math.floor((new Date(now) - new Date(pet.lastWorkAt)) / DAY));
    if (inactiveDays > pet.inactivityPenaltyDays) {
      pet.hunger = clamp(pet.hunger - (inactiveDays - pet.inactivityPenaltyDays) * 10);
      pet.inactivityPenaltyDays = inactiveDays;
    }
    syncDailyStats(data, now);
    checkAchievements(pet);
    return pet;
  }

  function moodModifier(data, now) {
    const key = dateKey(now);
    const tasks = (data.tasks || []).filter(item => item.date === key);
    const completed = tasks.filter(item => item.done).length;
    const rate = tasks.length ? completed / tasks.length : null;
    const overdue = (data.tasks || []).filter(item => !item.done && item.date < key).length;
    let modifier = rate !== null && rate >= 0.8 ? 5 : rate !== null && rate <= 0.3 ? -5 : 0;
    if (overdue >= 3) modifier -= 10;
    return modifier;
  }

  function refreshMood(data, now = new Date()) {
    const pet = data.pet || ensureState(data, now);
    const key = dateKey(now);
    const previous = Number(pet.moodAdjustments[key]) || 0;
    const next = moodModifier(data, now);
    pet.mood = clamp(pet.mood + next - previous);
    pet.moodAdjustments[key] = next;
    syncDailyStats(data, now);
    checkAchievements(pet);
    return pet.mood;
  }

  function completeTask(data, task, now = new Date()) {
    const pet = data.pet || ensureState(data, now);
    const important = task.priority === '高' || task.important === true;
    pet.hunger = clamp(pet.hunger + 5);
    pet.coins += important ? 4 : 1;
    pet.totalCompleted += 1;
    pet.lastWorkAt = new Date(now).toISOString();
    pet.inactivityPenaltyDays = 0;
    addExperience(pet, important ? 8 : 3);
    refreshMood(data, now);
    syncDailyStats(data, now, true);
    checkAchievements(pet);
    return pet;
  }

  function petPet(data, now = new Date()) {
    const pet = data.pet || ensureState(data, now);
    const key = dateKey(now);
    const count = Number(pet.petCounts[key]) || 0;
    if (count >= 3) return { rewarded: false, count };
    pet.petCounts[key] = count + 1;
    pet.mood = clamp(pet.mood + 2);
    syncDailyStats(data, now);
    return { rewarded: true, count: pet.petCounts[key] };
  }

  function syncDailyStats(data, now = new Date(), active = false) {
    if (!data.pet) return;
    const key = dateKey(now);
    const tasks = (data.tasks || []).filter(item => item.date === key);
    const previous = data.pet.dailyStats[key] || {};
    data.pet.dailyStats[key] = {
      total: tasks.length,
      completed: tasks.filter(item => item.done).length,
      active: Boolean(previous.active || active),
      mood: data.pet.mood
    };
  }

  function longestStreak(stats, predicate) {
    const keys = Object.keys(stats).sort();
    let best = 0, current = 0, previous = '';
    keys.forEach(key => {
      if (!predicate(stats[key])) { current = 0; previous = key; return; }
      current = previous && dayDiff(previous, key) === 1 ? current + 1 : 1;
      best = Math.max(best, current);
      previous = key;
    });
    return best;
  }

  function checkAchievements(pet) {
    const unlock = id => { if (!pet.owned.includes(id)) pet.owned.push(id); };
    const stats = pet.dailyStats || {};
    if (longestStreak(stats, day => day.total > 0 && day.completed === day.total) >= 7) unlock('D25');
    if (longestStreak(stats, day => day.active && day.completed >= 1) >= 30) unlock('D26');
    if (pet.level >= 50) unlock('D27');
    if (pet.totalCompleted >= 1000) unlock('D28');
    if (longestStreak(stats, day => day.mood >= 80) >= 7) unlock('D29');
    if (pet.level >= 100) unlock('D30');
    return pet.owned;
  }

  function purchaseDecoration(pet, id) {
    if (!(id in PRICES)) return { ok: false, reason: 'not-for-sale' };
    if (pet.owned.includes(id)) return { ok: false, reason: 'owned' };
    if (pet.coins < PRICES[id]) return { ok: false, reason: 'coins' };
    pet.coins -= PRICES[id];
    pet.owned.push(id);
    return { ok: true };
  }

  function toggleDecoration(pet, id) {
    if (!pet.owned.includes(id)) return { ok: false, reason: 'locked' };
    if (pet.equipped.includes(id)) {
      if (pet.equipped.length <= 1) return { ok: false, reason: 'minimum' };
      pet.equipped = pet.equipped.filter(item => item !== id);
      return { ok: true, equipped: false };
    }
    if (pet.equipped.length >= 3) return { ok: false, reason: 'limit' };
    pet.equipped.push(id);
    return { ok: true, equipped: true };
  }

  return {
    DECORATIONS, ACHIEVEMENTS, LEVEL_UNLOCKS, PRICES, dateKey, threshold,
    ensureState, addExperience, runTimeChecks, refreshMood, completeTask,
    petPet, purchaseDecoration, toggleDecoration, checkAchievements
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PetCore;
