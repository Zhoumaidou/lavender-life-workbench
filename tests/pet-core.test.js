const test = require('node:test');
const assert = require('node:assert/strict');
const PetCore = require('../pet-core.js');

const at = value => new Date(value);

function task(overrides = {}) {
  return {
    id: Math.random().toString(36),
    name: '测试任务',
    date: '2026-08-10',
    priority: '中',
    done: false,
    ...overrides
  };
}

test('initializes the pet with the requested defaults', () => {
  const data = { tasks: [] };
  const pet = PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));

  assert.equal(pet.hunger, 80);
  assert.equal(pet.mood, 77);
  assert.equal(pet.level, 1);
  assert.equal(pet.coins, 2);
  assert.deepEqual(pet.owned, ['D01']);
  assert.deepEqual(pet.equipped, ['D01']);
});

test('rewards a normal and an important completed task', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));

  PetCore.completeTask(data, task(), at('2026-08-10T09:00:00+08:00'));
  assert.equal(data.pet.hunger, 85);
  assert.equal(data.pet.exp, 5);
  assert.equal(data.pet.coins, 3);

  PetCore.completeTask(data, task({ priority: '高' }), at('2026-08-10T10:00:00+08:00'));
  assert.equal(data.pet.exp, 13);
  assert.equal(data.pet.coins, 7);
  assert.equal(data.pet.totalCompleted, 2);
});

test('levels repeatedly and unlocks level decorations', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));
  data.pet.exp = 44;

  PetCore.addExperience(data.pet, 1);

  assert.equal(data.pet.level, 3);
  assert.equal(data.pet.exp, 0);
  assert.ok(data.pet.owned.includes('D02'));
  assert.ok(data.pet.owned.includes('D03'));
});

test('applies daily login and inactivity decay once', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-07T08:00:00+08:00'));
  data.pet.hunger = 80;
  data.pet.lastWorkAt = at('2026-08-07T09:00:00+08:00').toISOString();

  PetCore.runTimeChecks(data, at('2026-08-10T08:00:00+08:00'));
  assert.equal(data.pet.hunger, 55);
  assert.equal(data.pet.loginStreak, 1);
  assert.equal(data.pet.coins, 4);

  PetCore.runTimeChecks(data, at('2026-08-10T08:30:00+08:00'));
  assert.equal(data.pet.hunger, 55);
  assert.equal(data.pet.coins, 4);
});

test('keeps daily mood rules idempotent as completion changes', () => {
  const tasks = [task(), task(), task(), task(), task()];
  const data = { tasks };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));
  const initial = data.pet.mood;

  PetCore.refreshMood(data, at('2026-08-10T09:00:00+08:00'));
  assert.equal(data.pet.mood, initial - 5);

  tasks.slice(0, 4).forEach(item => { item.done = true; });
  PetCore.refreshMood(data, at('2026-08-10T10:00:00+08:00'));
  assert.equal(data.pet.mood, initial + 5);

  PetCore.refreshMood(data, at('2026-08-10T11:00:00+08:00'));
  assert.equal(data.pet.mood, initial + 5);
});

test('limits petting mood rewards to three times per day', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));
  const initial = data.pet.mood;

  assert.equal(PetCore.petPet(data, at('2026-08-10T09:00:00+08:00')).rewarded, true);
  PetCore.petPet(data, at('2026-08-10T10:00:00+08:00'));
  PetCore.petPet(data, at('2026-08-10T11:00:00+08:00'));
  assert.equal(PetCore.petPet(data, at('2026-08-10T12:00:00+08:00')).rewarded, false);
  assert.equal(data.pet.mood, initial + 6);
});

test('purchases, equips and caps decorations at three', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));
  data.pet.coins = 100;

  assert.equal(PetCore.purchaseDecoration(data.pet, 'D16').ok, true);
  assert.equal(PetCore.purchaseDecoration(data.pet, 'D17').ok, true);
  assert.equal(PetCore.purchaseDecoration(data.pet, 'D21').ok, true);
  PetCore.toggleDecoration(data.pet, 'D16');
  PetCore.toggleDecoration(data.pet, 'D17');
  assert.equal(PetCore.toggleDecoration(data.pet, 'D21').ok, false);
  assert.deepEqual(data.pet.equipped, ['D01', 'D16', 'D17']);
});

test('keeps at least one decoration equipped', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));

  const result = PetCore.toggleDecoration(data.pet, 'D01');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'minimum');
  assert.deepEqual(data.pet.equipped, ['D01']);
});

test('unlocks achievement decorations from recorded history', () => {
  const data = { tasks: [] };
  PetCore.ensureState(data, at('2026-08-10T08:00:00+08:00'));
  data.pet.level = 50;
  data.pet.totalCompleted = 1000;
  data.pet.dailyStats = {};
  for (let day = 4; day <= 10; day += 1) {
    const key = `2026-08-${String(day).padStart(2, '0')}`;
    data.pet.dailyStats[key] = { total: 2, completed: 2, active: true, mood: 85 };
  }

  PetCore.checkAchievements(data.pet);

  ['D25', 'D27', 'D28', 'D29'].forEach(id => assert.ok(data.pet.owned.includes(id)));
});
