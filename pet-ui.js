(() => {
  const SPECIES = {
    'british-shorthair': '缅英猫',
    'blue-cat': '蓝猫',
    'rough-collie': '苏牧',
    'border-collie': '边牧'
  };
  const MESSAGES = {
    positive: ['主人今天好棒！✨', '继续加油，我们是最佳搭档！💪', '今天的工作状态满分！🌟', '主人专注的样子真帅！😎'],
    neutral: ['有点饿了，主人要不要完成一个任务喂我？🍽️', '今天工作有点少，我还可以撑一天~'],
    negative: ['好饿啊...主人今天好忙吗？😢', '再不来任务我就要饿晕了...🥺', '主人是不是忘记我了？💔']
  };
  let managerTab = 'wardrobe';
  let petClickTimer = 0;
  let bubbleTimer = 0;

  const decoration = id => PetCore.DECORATIONS.find(item => item.id === id);
  const escapeText = value => esc(String(value));

  function petMood(pet) {
    if (pet.hunger < 30 || pet.mood < 30) return { key: 'low', label: '有点低落' };
    if (pet.hunger >= 70 && pet.mood >= 70) return { key: 'happy', label: '精神满满' };
    if (pet.hunger >= 50 && pet.mood >= 50) return { key: 'calm', label: '安静陪伴' };
    return { key: 'tired', label: '需要休息' };
  }

  function petFace(pet) {
    const mood = petMood(pet);
    const decorations = pet.equipped.map(decoration).filter(Boolean);
    return `<button class="pet-avatar species-${pet.species} mood-${mood.key} ${pet.level >= 50 ? 'is-glowing' : ''}" data-pet-click aria-label="和${SPECIES[pet.species]}互动，双击打开装扮">
      <span class="pet-decorations" aria-hidden="true">${decorations.map(item => `<i>${item.emoji}</i>`).join('')}</span>
      <span class="pet-ear pet-ear-left"></span><span class="pet-ear pet-ear-right"></span>
      <span class="pet-head"><i class="pet-patch"></i><i class="pet-eye pet-eye-left"></i><i class="pet-eye pet-eye-right"></i><i class="pet-nose"></i><i class="pet-mouth"></i></span>
      <span class="pet-tooltip" role="tooltip">饱食度 ${pet.hunger}　情绪 ${pet.mood}<br>等级 ${pet.level}　经验 ${pet.exp}/${PetCore.threshold(pet.level)}</span>
    </button>`;
  }

  function petCard() {
    const pet = data.pet;
    const mood = petMood(pet);
    const threshold = PetCore.threshold(pet.level);
    const progress = pet.level >= 100 ? 100 : Math.round(pet.exp / threshold * 100);
    const next = Object.entries(PetCore.LEVEL_UNLOCKS).find(([id, level]) => level > pet.level && !pet.owned.includes(id));
    const nextText = next ? `再升到 ${next[1]} 级可获得${decoration(next[0]).name}` : '等级装饰已全部收入衣橱';
    return `<section class="section pet-section" aria-labelledby="pet-title">
      <div class="section-head"><h2 class="section-title" id="pet-title">今日搭档</h2><span class="pet-coins">🪙 ${pet.coins}</span></div>
      <div class="pet-card card" data-pet-drop>
        <div class="pet-stage"><div class="pet-speech" aria-live="polite"></div>${petFace(pet)}<span class="pet-drop-hint">把待办拖到这里喂我</span></div>
        <div class="pet-details">
          <div class="pet-name-row"><div><strong>${SPECIES[pet.species]}</strong><span>${mood.label}</span></div><button class="text-btn pet-manage" data-pet-open>装扮</button></div>
          <div class="pet-stat-grid">
            <span><small>饱食度</small><b>${pet.hunger}</b></span><span><small>情绪</small><b>${pet.mood}</b></span>
            <span><small>等级</small><b>Lv.${pet.level}</b></span><span><small>经验</small><b>${pet.level >= 100 ? 'MAX' : `${pet.exp}/${threshold}`}</b></span>
          </div>
          <div class="pet-exp" aria-label="经验进度 ${progress}%"><i style="width:${progress}%"></i></div>
          <p class="pet-next">${nextText}</p>
        </div>
      </div>
    </section>`;
  }

  function decorate() {
    if (!data.pet) {
      PetCore.ensureState(data);
      save();
    }
    document.querySelectorAll('.task').forEach(element => {
      element.draggable = !element.classList.contains('done');
      const toggle = element.querySelector('[data-toggle-task]');
      if (toggle) element.dataset.petTaskId = toggle.dataset.toggleTask;
    });
    const hero = document.querySelector('.sun-card');
    if (hero && !document.querySelector('.pet-section')) hero.insertAdjacentHTML('afterend', petCard());
  }

  function messageFor(pet) {
    const pool = pet.hunger >= 60 ? MESSAGES.positive : pet.hunger >= 40 ? MESSAGES.neutral : MESSAGES.negative;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showBubble(message) {
    clearTimeout(bubbleTimer);
    const bubble = document.querySelector('.pet-speech');
    if (!bubble) return;
    bubble.textContent = message;
    bubble.classList.add('is-visible');
    bubbleTimer = setTimeout(() => bubble.classList.remove('is-visible'), 3200);
  }

  function interact() {
    const result = PetCore.petPet(data);
    const message = messageFor(data.pet);
    save();
    render();
    showBubble(message);
    if (!result.rewarded) toast('今天已经摸过三次啦');
  }

  function itemButton(item) {
    const pet = data.pet;
    const owned = pet.owned.includes(item.id);
    const equipped = pet.equipped.includes(item.id);
    if (managerTab === 'store') {
      if (owned) return '<button class="pet-item-action" disabled>已拥有</button>';
      return `<button class="pet-item-action" data-pet-buy="${item.id}">${PetCore.PRICES[item.id]} 币兑换</button>`;
    }
    if (!owned) return '<span class="pet-item-lock">尚未解锁</span>';
    return `<button class="pet-item-action ${equipped ? 'is-equipped' : ''}" data-pet-equip="${item.id}">${equipped ? '取下' : '穿戴'}</button>`;
  }

  function achievementState(id) {
    const pet = data.pet;
    if (pet.owned.includes(id)) return '已解锁';
    if (id === 'D27') return `${pet.level}/50 级`;
    if (id === 'D28') return `${pet.totalCompleted}/1000 个`;
    if (id === 'D30') return `${pet.level}/100 级`;
    return '继续保持每日节奏';
  }

  function managerItems() {
    if (managerTab === 'achievements') {
      return PetCore.ACHIEVEMENTS.map(entry => {
        const item = decoration(entry.id);
        const unlocked = data.pet.owned.includes(entry.id);
        return `<article class="pet-achievement ${unlocked ? 'is-unlocked' : ''}"><span>${item.emoji}</span><div><b>${entry.name}</b><small>奖励 ${item.name}</small></div><em>${achievementState(entry.id)}</em></article>`;
      }).join('');
    }
    const items = managerTab === 'store'
      ? PetCore.DECORATIONS.filter(item => item.type === 'coins')
      : PetCore.DECORATIONS.filter(item => data.pet.owned.includes(item.id));
    return `<div class="pet-item-grid">${items.map(item => `<article class="pet-item"><span>${item.emoji}</span><b>${item.name}</b><small>${item.id}</small>${itemButton(item)}</article>`).join('')}</div>`;
  }

  function openManager(tab = managerTab) {
    managerTab = tab;
    const pet = data.pet;
    modalRoot.innerHTML = `<div class="modal-wrap pet-modal-wrap"><section class="modal pet-modal" role="dialog" aria-modal="true" aria-labelledby="pet-manager-title">
      <div class="modal-head"><div><h2 id="pet-manager-title">宠物衣橱</h2><p>可同时穿戴 1-3 件装饰品</p></div><button class="icon-btn" data-close aria-label="关闭">×</button></div>
      <div class="pet-species" aria-label="选择宠物形象">${Object.entries(SPECIES).map(([id, name]) => `<button class="${pet.species === id ? 'active' : ''}" data-pet-species="${id}"><span class="species-dot species-${id}"></span>${name}</button>`).join('')}</div>
      <div class="segmented pet-tabs"><button class="segment ${tab === 'wardrobe' ? 'active' : ''}" data-pet-tab="wardrobe">已拥有</button><button class="segment ${tab === 'store' ? 'active' : ''}" data-pet-tab="store">宠物商店</button><button class="segment ${tab === 'achievements' ? 'active' : ''}" data-pet-tab="achievements">成就</button></div>
      <div class="pet-manager-body">${managerItems()}</div>
    </section></div>`;
  }

  function rewardTask(task) {
    PetCore.completeTask(data, task);
    save();
    render();
    toast(task.priority === '高' ? '重要事项完成，奖励 4 宠物币' : '任务已喂给宠物，奖励 1 宠物币');
    showBubble(messageFor(data.pet));
  }

  document.addEventListener('click', event => {
    const oldButton = event.target.closest('button');
    if (oldButton?.dataset.toggleTask && oldButton.getAttribute('aria-label') === '完成任务') {
      const task = data.tasks.find(item => item.id === oldButton.dataset.toggleTask);
      if (task?.done) rewardTask(task);
      return;
    }
    if (event.target.closest('[data-pet-click]')) {
      clearTimeout(petClickTimer);
      petClickTimer = setTimeout(interact, 240);
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.petOpen !== undefined) openManager();
    else if (button.dataset.petTab) openManager(button.dataset.petTab);
    else if (button.dataset.petSpecies) {
      data.pet.species = button.dataset.petSpecies;
      save(); render(); openManager();
    } else if (button.dataset.petBuy) {
      const result = PetCore.purchaseDecoration(data.pet, button.dataset.petBuy);
      if (!result.ok) toast(result.reason === 'coins' ? '宠物币还不够' : '暂时无法兑换');
      else toast('装饰品已放入衣橱');
      save(); render(); openManager('store');
    } else if (button.dataset.petEquip) {
      const result = PetCore.toggleDecoration(data.pet, button.dataset.petEquip);
      if (!result.ok) toast(result.reason === 'limit' ? '最多同时穿戴 3 件' : '至少保留 1 件装饰');
      save(); render(); openManager('wardrobe');
    }
  });

  document.addEventListener('dblclick', event => {
    if (!event.target.closest('[data-pet-click]')) return;
    clearTimeout(petClickTimer);
    openManager();
  });

  document.addEventListener('dragstart', event => {
    const task = event.target.closest('[data-pet-task-id]');
    if (!task || task.classList.contains('done')) return;
    event.dataTransfer.setData('text/pet-task', task.dataset.petTaskId);
    event.dataTransfer.effectAllowed = 'move';
    task.classList.add('is-dragging');
  });
  document.addEventListener('dragend', event => {
    event.target.closest('[data-pet-task-id]')?.classList.remove('is-dragging');
    document.querySelector('[data-pet-drop]')?.classList.remove('is-dragover');
  });
  document.addEventListener('dragover', event => {
    const target = event.target.closest('[data-pet-drop]');
    if (!target) return;
    event.preventDefault();
    target.classList.add('is-dragover');
  });
  document.addEventListener('dragleave', event => {
    const target = event.target.closest('[data-pet-drop]');
    if (target && !target.contains(event.relatedTarget)) target.classList.remove('is-dragover');
  });
  document.addEventListener('drop', event => {
    const target = event.target.closest('[data-pet-drop]');
    if (!target) return;
    event.preventDefault();
    target.classList.remove('is-dragover');
    const task = data.tasks.find(item => item.id === event.dataTransfer.getData('text/pet-task'));
    if (!task || task.done) return;
    task.done = true;
    rewardTask(task);
  });

  PetCore.ensureState(data);
  save();
  const baseRender = render;
  render = function () {
    if (!data.pet) PetCore.ensureState(data);
    baseRender();
    decorate();
  };
  setInterval(() => {
    const before = JSON.stringify(data.pet);
    PetCore.runTimeChecks(data);
    if (before !== JSON.stringify(data.pet)) { save(); render(); }
  }, 3600000);
  render();
})();
