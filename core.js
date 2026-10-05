/* Simulation only: no DOM, no network, seeded randomness for reproducible tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    require('./reports.js').install(api);
    require('./story.js').install(api);
  }
  else root.DemonDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = 1024, H = 688, WORLD_W = 2048, WORLD_H = 1376, NIGHT_LENGTH = 150;
  const BELL_POSITION = { x: 1024, y: 570 };
  const REPORT_POSTS = [{ id: 'north', x: 1024, y: 85 }, { id: 'west', x: 80, y: 740 }, { id: 'east', x: 1968, y: 740 }];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const copy = v => JSON.parse(JSON.stringify(v));
  const circleRect = (x, y, r, b) => Math.hypot(x - clamp(x, b.x, b.x + b.w), y - clamp(y, b.y, b.y + b.h)) < r;
  const XP = [40, 105, 190, 290, 410, 550];
  const PREPARATIONS = {
    shield: { name: '防火盾', description: '格挡正面的火焰。冲撞破盾，或绕侧攻击。' },
    thrust: { name: '猎龙突刺', description: '试探后切入施法位置。红色直线标出攻击路线。' },
    ward: { name: '净火圣旗', description: '清除附近火场、抵抗吼声。冲撞可毁掉旗座。' },
    spacing: { name: '分散阵型', description: '民兵远离彼此。可把燃烧民兵撞向勇者。' },
    brace: { name: '稳心护架', description: '听见震慑见闻后准备，减轻控制，不能免除震击伤害。冲撞可以破架。' },
    echoStep: { name: '错拍步', description: '看见回声后等待第二波，短暂侧步。把勇者压向障碍可封住退路。' },
    anchor: { name: '镇魂锚点', description: '根据恐影见闻设置锚点，降低附近恐影输出。震击或冲撞可摧毁锚点。' },
    focus: { name: '凝神架势', description: '收到声印见闻后，在蓄声时短暂减轻审判伤害。骗出架势，再等窗口。' },
    oblique: { name: '斜列架盾', description: '面对冲撞改用侧向架势，正面减轻撞击与裂地。换个角度仍能突破。' },
    returnTrap: { name: '回路伏击', description: '见过折返后瞄准你的原起点。落点预警有延迟，可以放弃折返。' },
    landingTrap: { name: '诱落反击', description: '见过天坠后侧移，再反击预告的落点。短蓄、改落点可以抢先落地。' }
  };
  const DIRECTIONS = { flame: { name: '火焰', color: '#ff9e52', mark: '炎' }, fear: { name: '震慑', color: '#c0a0ef', mark: '惧' }, force: { name: '魔躯', color: '#70d8df', mark: '躯' } };
  const TERMS = {
    F01: { dir: 'flame', cap: 3, name: '炽热核心', description: '炎息伤害每级增加基础值的 20%。' },
    F02: { dir: 'flame', cap: 3, name: '长息', description: '炎息距离每级增加基础值的 15%；火场投放距离同步增加。' },
    F03: { dir: 'flame', cap: 2, name: '扩幅', description: '炎息角度、火场和爆炸半径每级增加基础值的 15%。' },
    F04: { dir: 'flame', cap: 2, name: '余烬容器', description: '炎息容量 +25，只补入新增容量；恢复速度不变。' },
    S01: { dir: 'fear', cap: 3, name: '广域回响', description: '吼声范围每级增加基础值的 20%。' },
    S02: { dir: 'fear', cap: 3, name: '深震', description: '震击伤害每级 +12；普通敌人失衡 +0.20 秒。勇者控制时间减半、至多 0.5 秒。' },
    S03: { dir: 'fear', cap: 2, name: '急促咆哮', description: '吼声冷却每级减少 0.4 秒，基础 3.2 秒；不重置当前冷却。' },
    S04: { dir: 'fear', cap: 2, name: '推山之声', description: '吼声击退每级 +15。勇者每次吼声总击退至多 18。' },
    M01: { dir: 'force', cap: 3, name: '铁撞', description: '冲撞敌人伤害每级 +14，基础 40；冲撞障碍伤害每级 +20。' },
    M02: { dir: 'force', cap: 2, name: '连冲', description: '增加 1 次冲撞储存，补入新增次数；最多储存 3 次。' },
    M03: { dir: 'force', cap: 3, name: '重铸魔躯', description: '最大生命 +25，只恢复新增的 25 点生命。' },
    M04: { dir: 'force', cap: 2, name: '蓄势', description: '每次冲撞恢复时间减少 0.35 秒，基础 2.6 秒；不重置当前倒计时。' },
    FQ01: { dir: 'flame', cap: 1, quality: true, path: 'dragon', name: '熔穿龙息', description: '持续喷火 1.2 秒后松开，另耗 15 炎息发射熔穿束；可贯穿 3 人、打开防火盾 1.5 秒。', tip: '喷火蓄热 → 留 15 炎息 → 松开发射' },
    FQ02: { dir: 'flame', cap: 1, quality: true, path: 'field', name: '织火领域', description: '左键单击布火种：每次 16 炎息，数量不限。F 同时引爆，爆燃与不同火堆完整叠伤；未燃火种不怕圣旗。', tip: '单击囤火 → 松开恢复 → F 引爆；火堆持续 6 秒' },
    FQ03: { dir: 'flame', cap: 1, quality: true, path: 'chain', name: '爆燃接力', description: '重击持续燃烧的目标，另耗 10 炎息引爆；向 90 内燃烧目标接力，最多 3 个爆点。', tip: '先点燃 0.5 秒 → 再烧中 → 爆燃接力' },
    SQ01: { dir: 'fear', cap: 1, quality: true, name: '回声王冠', description: '吼声 0.65 秒后再释放更远的回声，造成首波 70% 震击伤害；勇者不会被重复打断。', tip: 'Q 首波震击 → 延迟回声连击' },
    SQ02: { dir: 'fear', cap: 1, quality: true, name: '惊惧化形', description: 'Q 召出追击战斗者的恐影，最多 3 只、各持续 6 秒；不会自动追杀报信者。', tip: 'Q 震击 → 恐影追击；打碎镇魂锚点' },
    SQ03: { dir: 'fear', cap: 1, quality: true, name: '敕令审判', description: '短按 Q 给震慑命中的全部存活敌人加声印，最多 3 层；长按 0.5 秒后松开，引爆声印。审判独立冷却 0.8 秒。', tip: '短按 Q 群体积印 → 长按 Q → 松开审判' },
    MQ01: { dir: 'force', cap: 1, quality: true, name: '裂地冲撞', description: '完成冲撞后向原方向释放裂地波，造成一次完整冲撞伤害；波长 120。', tip: '空格冲撞 → 落地裂波双重命中' },
    MQ02: { dir: 'force', cap: 1, quality: true, name: '回返魔躯', description: '冲撞结束后保留 2 秒回路；再次短按空格回到起点，去返合计只耗一次储存。去返各命中一次。', tip: '短按空格冲入 → 2 秒内再短按空格折返' },
    MQ03: { dir: 'force', cap: 1, quality: true, name: '天坠魔躯', description: '短按空格普通冲撞；长按 0.45 秒后松开，跃向准星落点造成范围砸击。', tip: '长按空格选落点 → 松开天坠' }
  };
  const segmentDistance = (e, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((e.x-a.x)*dx+(e.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
    return Math.hypot(e.x-a.x-t*dx,e.y-a.y-t*dy);
  };

  class Game {
    constructor(seed = Date.now()) {
      this.seed = seed >>> 0 || 1; this.rngState = this.seed; this.nextId = 1;
      this.worldWidth = WORLD_W; this.worldHeight = WORLD_H;
      this.bellPosition = { ...BELL_POSITION }; this.reportPosts = REPORT_POSTS.map(p => ({ ...p }));
      this.phase = 'intro'; this.previousPhase = 'raid'; this.night = 1; this.time = 0; this.totalTime = 0;
      this.level = 0; this.fear = 0; this.path = null; this.legend = false; this.pendingUpgrade = false;
      this.combatGrowthCount = 0; this.rewardCount = 0; this.completedNights = 0; this.rewardedNights = [];
      this.ranks = Object.fromEntries(Object.keys(TERMS).map(k => [k, 0])); this.choicePage = null; this.chainTimer = 0; this.scheduled = [];
      this.nextGrowthAt = 18; this.nightGrowthStart = 0;
      this.retreatAt = 50;
      this.player = { x: 900, y: 930, r: 18, hp: 140, maxHp: 140, energy: 100, maxEnergy: 100,
        angle: -Math.PI / 2, dashTime: 0, dashCharges: 1, dashMax: 1, dashRegen: 0, invuln: 0,
        roarCooldown: 0, judgementCooldown: 0, stun: 0, breathTime: 0, fireActive: false, fieldCooldown: 0, igniteHeld: false, dashHits: [],
        fireHeld: false, extinguished: false, idleTime: 0, heatInterrupted: false, roarHeld: false, roarCharge: 0,
        dashHeld: false, dashCharge: 0, returnTrail: null, returnQueued: false, igniteQueued: false, returnTarget: null, returnAttempt: null, skillFeedback: null, plunge: null };
      this.rumors = { flame: 0, fear: 0, force: 0, dragon: 0, field: 0, chain: 0, echo: 0, phantom: 0, judgement: 0, earth: 0, return: 0, plunge: 0 };
      this.stats = { scared: 0, defeated: 0, villagersDefeated: 0, broken: 0, intercepted: 0, delivered: 0 };
      this.characters = {
        smith: { name: '洛安', role: '铁匠', x: 302, y: 470, down: false },
        grain: { name: '阿禾', role: '守粮人', x: 739, y: 438, down: false }
      };
      this.downed = [];
      this.entities = []; this.fields = []; this.pets = []; this.effects = []; this.events = []; this.log = [];
      this.reportSlots = 0; this.spawnTimer = 0; this.hero = null; this.checkpoint = null;
      this.personality = this.random() < .5 ? 'cautious' : 'aggressive';
      this.rescue = { active: false, status: 'waiting', x: 777, y: 350, danger: 0, progress: 0, rescuer: null, heat: 0 };
      this.solids = [
        { id: 'home-west', x: 106, y: 94, w: 166, h: 108, type: 'house', name: '民居', hp: 1e9 },
        { id: 'home-east', x: 728, y: 87, w: 166, h: 111, type: 'house', name: '民居', hp: 1e9 },
        { id: 'smith', x: 106, y: 463, w: 158, h: 111, type: 'house', name: '铁匠铺', hp: 1e9 },
        { id: 'grain', x: 767, y: 455, w: 164, h: 126, type: 'house', name: '粮仓', hp: 1e9 },
        { id: 'fence-west', x: 305, y: 285, w: 124, h: 15, type: 'fence', hp: 58 },
        { id: 'fence-east', x: 614, y: 297, w: 119, h: 15, type: 'fence', hp: 58 },
        { id: 'fence-south', x: 469, y: 518, w: 124, h: 15, type: 'fence', hp: 58 }
      ];
      for (const b of this.solids) { b.x *= 2; b.y *= 2; b.w *= 2; b.h *= 2; }
      for (const c of Object.values(this.characters)) { c.x *= 2; c.y *= 2; }
      this.rescue.x *= 2; this.rescue.y *= 2;
      this.addLog('他们已经替你写好了名字。你还没有开口。');
      if (this.initReports) this.initReports();
      if (this.initStory) this.initStory();
    }

    random() { this.rngState = (Math.imul(1664525, this.rngState) + 1013904223) >>> 0; return this.rngState / 4294967296; }
    emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 220) this.events.shift(); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    addLog(text) { this.log.unshift({ text, night: this.night }); this.log = this.log.slice(0, 12); }
    effect(kind, x, y, radius = 30, life = .45, angle = 0) {
      this.effects.push({ kind, x, y, radius, life, maxLife: life, angle });
      if (this.effects.length > 110) this.effects.shift();
    }
    start() { this.phase = 'raid'; this.time = 0; this.populateNight(); this.emit('start'); }
    populateNight() {
      this.entities = []; this.downed = []; this.reportSlots = 0; this.spawnTimer = 5;
      this.nightGrowthStart = this.combatGrowthCount;
      const spots = [[680,340],[1040,480],[1360,400],[1340,800],[720,780],[1020,760],[590,660],[1380,1080],[780,1100]];
      for (let i = 0; i < spots.length; i++) this.spawn('villager', spots[i][0], spots[i][1]);
      for (const [id, character] of Object.entries(this.characters)) {
        if (character.down) continue;
        const e = this.spawn('villager', character.x, character.y);
        e.character = id; e.name = character.name; e.role = character.role; e.hp = e.maxHp = 60;
      }
      const count = 3 + this.night;
      for (let i = 0; i < count; i++) this.spawn('militia', 730 + (i % 3) * 230, 420 + Math.floor(i / 3) * 240);
      this.addLog(['第一夜：村民第一次看见你。','第二夜：民兵在保护通向广场的道路。','第三夜：你的传说已经有了形状。'][this.night - 1]);
    }
    spawn(type, x, y) {
      const hp = type === 'villager' ? 36 : 52;
      const e = { id: this.nextId++, type, x, y, r: type === 'villager' ? 11 : 13, hp,
        maxHp: hp, speed: type === 'villager' ? 82 : 72 + this.night * 4, fear: 0, feared: false, burn: 0,
        chainCooldown: 0, stun: 0, cooldown: this.random(), attackTimer: 0, aim: 0,
        report: null, path: null, pathTimer: 0, wander: this.random() * Math.PI * 2, life: 0 };
      this.entities.push(e); return e;
    }
    blocked(x, y, r = 16) {
      return x < r + 20 || y < r + 30 || x > this.worldWidth - r - 20 || y > this.worldHeight - r - 23 || this.solids.some(b => b.hp > 0 && circleRect(x, y, r, b));
    }
    move(e, dx, dy) {
      const x = clamp(e.x + dx, e.r + 22, this.worldWidth - e.r - 22), y = clamp(e.y + dy, e.r + 32, this.worldHeight - e.r - 25);
      if (!this.blocked(x, e.y, e.r)) e.x = x;
      if (!this.blocked(e.x, y, e.r)) e.y = y;
    }
    clearLine(a, b, r = 14) {
      const steps = Math.ceil(distance(a, b) / 4);
      for (let i = 1; i <= steps; i++) if (this.blocked(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, r)) return false;
      return true;
    }
    findPath(a, b, r = 14) {
      const size = 32, cols = Math.ceil(this.worldWidth / size), rows = Math.ceil(this.worldHeight / size);
      const sx = clamp(Math.floor(a.x / size), 1, cols - 2), sy = clamp(Math.floor(a.y / size), 1, rows - 2);
      let tx = clamp(Math.floor(b.x / size), 1, cols - 2), ty = clamp(Math.floor(b.y / size), 1, rows - 2);
      if (this.blocked(tx * size + 16, ty * size + 16, r)) {
        let best = Infinity;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = tx + dx, y = ty + dy;
          const d = dx * dx + dy * dy;
          if (d < best && !this.blocked(x * size + 16, y * size + 16, r)) { best = d; b = { x: x * size + 16, y: y * size + 16 }; }
        }
        tx = Math.floor(b.x / size); ty = Math.floor(b.y / size);
      }
      const key = (x, y) => y * cols + x, start = key(sx, sy), goal = key(tx, ty);
      const queue = [start], parents = new Map([[start, -1]]);
      for (let n = 0; n < queue.length && n < cols * rows; n++) {
        const k = queue[n]; if (k === goal) break;
        const x = k % cols, y = Math.floor(k / cols);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy, nk = key(nx, ny);
          if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1 || parents.has(nk) || this.blocked(nx * size + 16, ny * size + 16, r)) continue;
          parents.set(nk, k); queue.push(nk);
        }
      }
      if (!parents.has(goal)) return [];
      const out = []; let k = goal;
      while (k !== start && k !== -1) { out.push({ x: (k % cols) * size + 16, y: Math.floor(k / cols) * size + 16 }); k = parents.get(k); }
      return out.reverse();
    }
    walkTo(e, target, speed, dt) {
      let aim = target;
      if (!this.clearLine(e, target, e.r)) {
        e.pathTimer = (e.pathTimer || 0) - dt;
        if (!e.path || e.pathTimer <= 0) { e.path = this.findPath(e, target, e.r); e.pathTimer = .65; }
        while (e.path.length && distance(e, e.path[0]) < 8) e.path.shift();
        if (e.path.length) aim = e.path[0];
      } else e.path = null;
      const d = distance(e, aim);
      if (d > 3) this.move(e, (aim.x - e.x) / d * Math.min(speed * dt, d), (aim.y - e.y) / d * Math.min(speed * dt, d));
    }
    gainFear(amount, x, y) {
      this.fear += amount; this.emit('fear', { amount, x, y });
      this.checkGrowth();
    }
    checkGrowth() {
      if (this.phase === 'raid' && this.combatGrowthCount < XP.length && this.fear >= XP[this.combatGrowthCount]
        && this.time >= 18 && this.totalTime >= this.nextGrowthAt && this.combatGrowthCount - this.nightGrowthStart < 2) {
        if(!this.openChoices('upgrade')){this.combatGrowthCount++;this.nextGrowthAt=this.totalTime+32;}
      }
    }
    directionProbabilities(keys = Object.keys(DIRECTIONS)) {
      const total = keys.reduce((s,k) => s + this.rumors[k] + 1, 0);
      return Object.fromEntries(keys.map(k => [k, (this.rumors[k]+1)/total]));
    }
    qualities() { return Object.keys(TERMS).filter(k => TERMS[k].quality && this.ranks[k]); }
    growthProbabilities() {
      const legal=this.legalTerms(),dirs=Object.keys(DIRECTIONS).filter(d=>legal.some(k=>TERMS[k].dir===d)),prob=this.directionProbabilities(dirs);
      return Object.fromEntries(Object.keys(DIRECTIONS).map(d=>[d,prob[d]||0]));
    }
    qualityEligible(dir) {
      return this.completedNights >= 1 && this.rumors[dir] >= 2 && this.qualities().length < 2
        && !this.qualities().some(k => TERMS[k].dir === dir)
        && Object.keys(TERMS).filter(k => !TERMS[k].quality && TERMS[k].dir === dir && this.ranks[k] > 0).length >= 2;
    }
    legalTerms(excluded = [], allowQuality = true) {
      return Object.keys(TERMS).filter(k => !excluded.includes(k) && this.ranks[k] < TERMS[k].cap
        && (!TERMS[k].quality || allowQuality && this.qualityEligible(TERMS[k].dir)));
    }
    weightedDirection(keys) {
      const weights = this.directionProbabilities(keys); let roll = this.random();
      for (const k of keys) { roll -= weights[k]; if (roll <= 0) return k; } return keys[keys.length-1];
    }
    generateChoices(kind) {
      const picked = []; let offeredQuality = false;
      for (let i=0;i<3;i++) {
        const legal = this.legalTerms(picked, !offeredQuality); if (!legal.length) break;
        const dir = this.weightedDirection(Object.keys(DIRECTIONS).filter(d => legal.some(k=>TERMS[k].dir===d)));
        const normal = legal.filter(k=>TERMS[k].dir===dir&&!TERMS[k].quality), quality = legal.filter(k=>TERMS[k].dir===dir&&TERMS[k].quality);
        const useQuality = !normal.length || kind === 'upgrade' && quality.length && this.random() < .2;
        const pool = useQuality ? quality : normal;
        const key = pool[Math.floor(this.random()*pool.length)]; picked.push(key); offeredQuality ||= !!TERMS[key].quality;
      }
      if (kind === 'reward' && !offeredQuality) {
        const slots = picked.map((k,i)=>i).filter(i=>this.qualityEligible(TERMS[picked[i]].dir));
        if (slots.length) { const slot=slots[Math.floor(this.random()*slots.length)], dir=TERMS[picked[slot]].dir;
          const pool=this.legalTerms(picked).filter(k=>TERMS[k].quality&&TERMS[k].dir===dir);
          if(pool.length) picked[slot]=pool[Math.floor(this.random()*pool.length)];
        }
      }
      return picked;
    }
    openChoices(kind) {
      this.clearActionInput();
      this.previousPhase = kind === 'reward' ? 'interlude' : 'raid';
      this.choicePage = { kind, keys: this.generateChoices(kind), probabilities: this.growthProbabilities() };
      this.choicePage.levels=Object.fromEntries(this.choicePage.keys.map(k=>[k,this.ranks[k]+1]));this.choicePage.rngState=this.rngState;
      if (!this.choicePage.keys.length) { this.phase = this.previousPhase; this.choicePage=null;this.pendingUpgrade=false;this.emit('pool-empty', { text: '本局可用词条已完成' }); return false; }
      this.phase = kind; this.pendingUpgrade = true; this.emit(kind);return true;
    }
    getChoices() {
      return this.choicePage ? [...this.choicePage.keys] : [];
    }
    termPreview(key) {
      const n=this.ranks[key]+1;
      const values={ F01:`伤害 ${(38*(1+.2*n)).toFixed(1)} / 秒`, F02:`距离 ${160*(1+.15*n)}`,
        F03:`面积宽度倍率 ${(1+.15*n).toFixed(2)}`, F04:`炎息容量 ${100+25*n}`,
        S01:`震击内圈 ${(80*(1+.2*n)).toFixed(0)} / 外圈 ${(148*(1+.2*n)).toFixed(0)}`, S02:`伤害 ${34+12*n} / 失衡 ${( .65+.2*n).toFixed(2)} 秒`, S03:`冷却 ${(3.2-.4*n).toFixed(1)} 秒`, S04:`击退 ${40+15*n}`,
        M01:`敌人伤害 ${40+14*n} / 障碍 ${85+20*n}`, M02:`冲撞储存 ${1+n}`, M03:`最大生命 ${140+25*n}`, M04:`恢复 ${(2.6-.35*n).toFixed(2)} 秒` };
      return TERMS[key].quality ? TERMS[key].tip : values[key];
    }
    chooseUpgrade(key) {
      if (!['upgrade','reward'].includes(this.phase) || !this.getChoices().includes(key)) return false;
      const reward=this.phase==='reward', term=TERMS[key]; this.ranks[key]++;
      if (term.path) this.path=term.path;
      if (key==='M02') {this.player.dashMax++; this.player.dashCharges++;}
      if (key==='M03') {this.player.maxHp+=25; this.player.hp+=25;}
      if (key==='F04') {this.player.maxEnergy+=25; this.player.energy+=25;}
      if (key==='F03') this.syncFieldRadii();
      if (term.quality) { this.legend=true; this.emit('legend',{text:'传说成真 · '+term.name}); this.effect('legend',this.player.x,this.player.y,190,1.1); }
      this.level++;
      if(reward) this.rewardCount++;
      else { this.combatGrowthCount++; this.player.hp=Math.min(this.player.maxHp,this.player.hp+16); this.nextGrowthAt=this.totalTime+32; }
      this.pendingUpgrade = false; this.phase = this.previousPhase;
      this.choicePage=null; this.player.breathTime=0; this.player.fireActive=false; this.player.fireHeld=false; this.player.idleTime=0;
      this.emit('chosen', { key, text: term.name, tip: term.quality ? term.tip : this.termPreviewAfter(key) });
      this.effect('level', this.player.x, this.player.y, 95, .7); return true;
    }
    termPreviewAfter(key) { this.ranks[key]--; const text=this.termPreview(key); this.ranks[key]++; return text; }
    scare(e, kind, canReport = true, awardFear = true) {
      if (e.type !== 'villager' || e.feared || e.gone) return;
      e.feared = true; e.fear = 20; this.stats.scared++; if(awardFear)this.gainFear(4, e.x, e.y);
      if (canReport && this.phase !== 'boss' && this.reportSlots < 3) {
        this.reportSlots++; e.report = { kind, trait: kind === 'flame' ? (this.attackTrait || 'flame') : kind, age: 0 };
        this.emit('report-created', { text: `${DIRECTIONS[kind].mark} · ${DIRECTIONS[kind].name}见闻正在传出`, x: e.x, y: e.y });
      }
      this.effect('panic', e.x, e.y - 18, 16, .7);
    }
    witnessAttack(victim, kind) {
      if (this.phase === 'boss' || victim.witnessed || this.reportSlots >= 3 || kind === 'burn') return;
      const flame=this.flameStats();
      const witness=this.entities.filter(e=>e!==victim&&e.type==='villager'&&!e.gone&&!e.feared
        && distance(e,victim)<240&&this.clearLine(e,victim,2)
        && (kind!=='fire'&&kind!=='explosion' || (this.path==='field'
          ? !this.fields.some(f=>f.state==='burning'&&distance(e,f)<f.r+e.r+20)
          : !this.inCone(e,flame.range+20,flame.width+.1))))
        .sort((a,b)=>distance(a,victim)-distance(b,victim))[0];
      if (witness) {
        victim.witnessed=true;
        this.scare(witness,['dash','earth'].includes(kind)?'force':'flame');
      }
    }
    deliverReport(e) {
      if (!e.report || e.hp <= 0) return;
      const { kind, trait } = e.report;
      this.rumors[kind]++; if (trait !== kind) this.rumors[trait]++;
      this.stats.delivered++;
      const quotes = { flame: '“他的火焰，比昨天更像传说里的样子。”', fear: '“一声吼，整条路上的人都站不稳了。”', force: '“围栏和民兵一起被他撞开了。”' };
      this.addLog(quotes[kind]); this.emit('delivered', { text: '见闻送达 · ' + ({ flame: '烈焰', fear: '恐惧', force: '蛮力' }[kind]) });
      e.report = null; e.gone = true;
    }
    interact() {
      const p = this.player;
      if (this.rescue.active && this.rescue.status === 'trapped' && distance(p, this.rescue) < 85) return;
      const e = this.entities.find(e => !e.gone && e.report && distance(p, e) < 80);
      if (e) { e.report = null; e.gone = true; this.stats.intercepted++; this.emit('intercepted', { text: '你截住了这次见闻，也放弃了它带来的传说力量。' }); this.addLog('一条故事没有走到广场。'); }
    }
    activateRescue() {
      if (this.rescue.active) return;
      this.rescue.active = true; this.rescue.status = 'trapped';
      this.solids.push({ id: 'beam', x: 737, y: 327, w: 86, h: 16, type: 'beam', hp: 75 });
      this.emit('crisis', { text: '粮仓失火！民兵黎安被倒下的木梁困住。靠近按住 E，或冲撞木梁。' });
      this.addLog('守粮人：“黎安还在那边！谁能把他带出来？”');
    }
    saveVillager(who) {
      if (this.rescue.status !== 'trapped') return;
      this.rescue.status = 'saved'; this.rescue.rescuer = who; this.rescue.progress = 1;
      const beam = this.solids.find(b => b.id === 'beam'); if (beam) beam.hp = 0;
      this.effect('rescue', this.rescue.x, this.rescue.y, 90, 1);
      this.emit('rescued', { text: who === 'player' ? '你救出了黎安。有人看见了这一幕。' : '勇者救出了黎安。他还没有忘记自己的承诺。' });
      this.addLog(who === 'player' ? '黎安：“我不知道为什么……是魔王推开了木梁。”' : '守粮人：“他把黎安带回来了。至少这一次。”');
    }
    damageSolid(b, amount, kind) {
      if (b.hp <= 0 || b.type === 'house') return;
      b.hp -= amount;
      if (b.hp <= 0) {
        this.effect('debris', b.x + b.w / 2, b.y, b.w / 2, .6); this.emit('break', { x: b.x, y: b.y });
        if (b.type === 'beam') this.saveVillager('player');
        else { this.stats.broken++; this.gainFear(10, b.x, b.y); this.addLog('铁匠：“那道围栏撑不过一次袭击。”'); }
      }
    }
    playerDamage(amount) {
      const p = this.player;
      if (p.invuln > 0 || p.dashTime > 0 || !['raid','boss'].includes(this.phase)) return;
      p.hp = Math.max(0, p.hp - amount); p.invuln = .55;
      this.emit('player-hit', { amount, x: p.x, y: p.y }); this.effect('hit', p.x, p.y, 35, .25);
      if (p.hp <= 0) { this.fields=[]; this.pets=[]; if(!this.onPlayerDefeated||!this.onPlayerDefeated()){this.phase = 'defeat'; this.emit('defeat');} }
    }
    damageEnemy(e, amount, kind, source = this.player, quiet = false) {
      if (e.gone || e.hp <= 0) return 0;
      this.witnessAttack(e,kind);
      if (e.type === 'villager') this.scare(e, ['fire','explosion','beam'].includes(kind) ? 'flame' : ['dash','earth'].includes(kind) ? 'force' : 'fear', false);
      if (e === this.hero && kind === 'fire' && e.guard > 0) {
        const from = Math.atan2(source.y - e.y, source.x - e.x);
        if (Math.abs(angleDiff(from, e.angle)) < 1.12) amount *= .16;
      }
      if (e === this.hero && kind === 'earth' && e.guard > 0 && Math.abs(angleDiff(Math.atan2(source.y-e.y,source.x-e.x),e.angle)) < 1.12) amount *= .25;
      if (e === this.hero && ['dash','earth','plunge'].includes(kind) && (e.preps||[]).includes('oblique') && e.obliqueGuard > 0
        && Math.abs(angleDiff(Math.atan2(source.y-e.y,source.x-e.x),e.angle)) < .75) amount *= .45;
      if (e === this.hero && kind === 'judgement' && e.focus > 0) amount *= .4;
      if (e === this.hero && e.state === 'recover') amount *= 1.25;
      e.hp = Math.max(0, e.hp - amount);
      if(!quiet)e.pendingDamage = (e.pendingDamage || 0) + amount;
      if (!quiet && (this.totalTime - (e.lastFloat ?? -1) > .28 || e.hp <= 0)) {
        this.emit('damage', { amount: Math.max(1, Math.round(e.pendingDamage)), x: e.x, y: e.y });
        e.pendingDamage = 0; e.lastFloat = this.totalTime;
      }
      if (['fire','explosion','beam'].includes(kind)) { if(!e.burn) e.burnAge=0; e.burn = Math.max(e.burn, 2.5); }
      e.flash = .13;
      if (e !== this.hero && e.hp <= 0) {
        const carried = !!e.report;
        e.report = null; e.gone = true; this.stats.defeated++;
        if (e.type === 'villager') this.stats.villagersDefeated++;
        this.downed.push({ x: e.x, y: e.y, life: 8, name: e.name || '', type: e.type });
        if (e.character) {
          this.characters[e.character].down = true;
          this.addLog(`${e.role}${e.name}被你击倒；这件事会进入最后的证言。`);
        }
        this.gainFear(e.type === 'villager' ? 6 : 13, e.x, e.y);
        this.emit('enemy-down', { x: e.x, y: e.y, text: e.name ? `${e.name}被击倒` : '击倒', carried });
        if (carried) { this.stats.intercepted++; this.emit('intercepted', { text: '报信者被击倒 · 携带的见闻中断' }); }
      }
      if (e === this.hero && e.hp <= 0) { this.fields=[];this.pets=[]; if(!this.onHeroDefeated||!this.onHeroDefeated()){this.phase = 'victory'; this.emit('victory');} }
      return amount;
    }
    inCone(e, range, width) { return distance(this.player, e) < range + (e.r || 0) && Math.abs(angleDiff(Math.atan2(e.y - this.player.y, e.x - this.player.x), this.player.angle)) < width; }
    flameStats() {
      const r=this.ranks, width=1+.15*r.F03;
      return { range:160*(1+.15*r.F02), width:.44*width, damage:38*(1+.2*r.F01), fieldRadius:(this.path==='field'?60:46)*width, explosionRadius:52*width };
    }
    syncFieldRadii() {
      const radius=this.flameStats().fieldRadius;
      for(const field of this.fields)field.r=radius;
    }
    skillBlocked(skill,text) {
      const p=this.player,previous=p.skillFeedback;
      if(!previous||previous.life<=0||previous.skill!==skill||previous.text!==text){
        p.skillFeedback={skill,text,life:1.5};this.emit('skill-blocked',{skill,text,x:p.x,y:p.y});
      }
      return false;
    }
    clearActionInput() {
      const p=this.player;
      p.fireHeld=false;p.igniteHeld=false;p.roarHeld=false;p.dashHeld=false;
      p.roarCharge=0;p.dashCharge=0;p.dashChargeMode=null;
      p.returnQueued=false;p.igniteQueued=false;p.fireActive=false;p.breathTime=0;p.heatInterrupted=true;
    }
    targets() { return [...this.entities,...(this.hero?[this.hero]:[])].filter(e=>!e.gone&&e.hp>0&&e.type!=='storyActor'&&!e.storyActor); }
    combatAction(dir,trait=dir) {
      if(this.recordAction)this.recordAction(dir,trait);
      const h=this.hero;
      if(this.phase==='boss'&&h&&h.hp>0&&distance(h,this.player)<480&&this.clearLine(h,this.player,2)) {
        h.observations=h.observations||{flame:0,fear:0,force:0};h.observations[dir]++;
        h.lastSeenAction={dir,trait,time:this.totalTime};
        if(dir==='fear'&&h.preps.includes('echoStep')){h.echoDodgeIn=.48;h.echoDodgeReady=false;}
        if(dir==='force'&&h.preps.includes('returnTrap')&&this.player.returnTrail&&h.counterCooldown<=0){
          h.counterTell={kind:'return',...this.player.returnTrail.start,r:68,life:1.2};h.counterCooldown=6;this.emit('hero-tell',{text:'回路伏击 · 原起点出现预警'});}
      }
    }
    stopFlame() { const p=this.player; p.extinguished=true; p.fireActive=false; p.breathTime=0; p.heatInterrupted=true; }
    fire(dt, aim) {
      const p=this.player,s=this.flameStats();
      if(this.path==='field') {
        this.plantSeed(aim);
      } else {
        const activeDt=Math.min(dt,p.energy/22); if(activeDt<=0){this.stopFlame();return;}
        p.fireActive=true;p.breathTime+=activeDt;p.energy=Math.max(0,p.energy-activeDt*22);
        const hit=this.targets().filter(e=>this.inCone(e,s.range,s.width)&&this.clearLine(p,e,2));
        const initial=hit.find(e=>(e.burnAge||0)>=.5);
        for(const e of hit) this.damageEnemy(e,s.damage*activeDt,'fire');
        for(const b of this.solids) if(b.hp>0&&b.type!=='house'&&this.inCone({x:b.x+b.w/2,y:b.y+b.h/2},s.range,s.width+.15)) this.damageSolid(b,s.damage*activeDt,'fire');
        if(this.path==='chain'&&initial&&this.chainTimer<=0&&p.energy>=10)this.startChain(initial);
        if(p.energy<=0)this.stopFlame();
      }
    }
    seedPlacement(aim) {
      const p=this.player,s=this.flameStats(),d=Math.min(1.25*s.range,distance(p,aim));
      const angle=Math.atan2(aim.y-p.y,aim.x-p.x);
      const point={x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d,r:s.fieldRadius};
      const previous=this.fields[this.fields.length-1];
      point.valid=this.clearLine(p,point,2);
      point.link=previous&&distance(previous,point)<=160&&this.clearLine(previous,point,2)?previous.id:null;
      return point;
    }
    plantSeed(aim) {
      const p=this.player;
      if(p.fieldCooldown>0)return this.skillBlocked('field','布种尚未就绪');
      if(p.energy<16){this.stopFlame();this.emit('seed-blocked',{text:'炎息不足 · 松开恢复'});return;}
      const point=this.seedPlacement(aim);
      if(!point.valid){this.emit('seed-blocked',{text:'障碍阻挡 · 换个落点'});return;}
      const f={...point,id:this.nextId++,state:'seed',life:null,maxLife:6};
      this.fields.push(f);p.energy-=16;p.fieldCooldown=.5;p.fireActive=true;
      this.emit('seed-placed',{x:f.x,y:f.y,count:this.fields.length});
      if(p.energy<16)this.stopFlame();
    }
    igniteSeeds() {
      const seeds=this.fields.filter(f=>f.state==='seed');
      if(this.path!=='field')return false;
      if(!seeds.length)return this.skillBlocked('ignite','还没有待引爆的火种');
      this.syncFieldRadii();
      this.combatAction('flame','field');
      // All bursts settle before the ward removes burning fields. Placement is prepaid.
      for(const f of seeds){f.state='burning';f.life=6;this.effect('ignition',f.x,f.y,f.r,.65);}
      this.attackTrait='field';
      const amounts=new Map(),targets=this.targets(),damage=this.flameStats().damage;
      for(const f of seeds){
        for(const e of targets)if(!e.gone&&e.hp>0&&distance(e,f)<f.r+e.r&&this.clearLine(f,e,2)){
          const amount=this.damageEnemy(e,damage,'fire',f,true);
          amounts.set(e,(amounts.get(e)||0)+amount);
        }
        for(const b of this.solids)if(b.hp>0&&b.type!=='house'&&circleRect(f.x,f.y,f.r,b))this.damageSolid(b,damage,'fire');
      }
      this.attackTrait=null;
      for(const [e,amount] of amounts)this.emit('ignition-damage',{x:e.x,y:e.y,amount:Math.round(amount)});
      this.emit('ignition',{count:seeds.length,x:this.player.x,y:this.player.y});
      this.clearWardFields();
      return true;
    }
    releaseLance() {
      const p=this.player,s=this.flameStats();
      if(this.path!=='dragon'||p.breathTime<1.2||p.energy<15||p.heatInterrupted||p.extinguished)return;
      p.energy-=15;
      this.combatAction('flame','dragon');
      // Clip the actual beam and its damage at walls, not just its visual endpoint.
      let clipped={x:p.x,y:p.y};
      for(let d=2;d<=s.range*1.35;d+=2){const point={x:p.x+Math.cos(p.angle)*d,y:p.y+Math.sin(p.angle)*d};if(this.blocked(point.x,point.y,1))break;clipped=point;}
      this.attackTrait='dragon';
      const hit=this.targets().filter(e=>segmentDistance(e,p,clipped)<=11+e.r&&this.clearLine(p,e,2)).sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,3);
      for(const e of hit){if(e===this.hero&&e.guard>0&&Math.abs(angleDiff(Math.atan2(p.y-e.y,p.x-e.x),e.angle))<1.12){e.guard=0;e.guardCooldown=Math.max(e.guardCooldown,1.5);e.shieldOpen=1.5;this.effect('shield-crack',e.x,e.y,40,.7);this.emit('opening',{text:'熔穿防火盾 · 1.5 秒窗口'});}this.damageEnemy(e,s.damage,'beam');}
      this.attackTrait=null;this.effect('beam',p.x,p.y,distance(p,clipped),.4,p.angle);this.emit('lance',{x:p.x,y:p.y});
    }
    startChain(initial) {
      const p=this.player,s=this.flameStats();p.energy-=10;this.chainTimer=1.5;
      this.combatAction('flame','chain');
      const chainId=this.nextId++;
      this.scheduled.push({kind:'chain',wait:0,node:{id:initial.id,x:initial.x,y:initial.y},remaining:2,chainId,damage:.6*s.damage,radius:s.explosionRadius});
      this.chainStates=this.chainStates||{};this.chainStates[chainId]={hits:[],visited:[],last:null};
    }
    roarStats() { const r=this.ranks;return{radius:148*(1+.2*r.S01),inner:80*(1+.2*r.S01),damage:34+12*r.S02,duration:.65+.2*r.S02,knock:40+15*r.S04,cooldown:3.2-.4*r.S03}; }
    forceStats() {return{damage:40+14*this.ranks.M01,solid:85+20*this.ranks.M01,recovery:2.6-.35*this.ranks.M04};}
    roarWave(source,radius,duration,knock,echo=false,damage=this.roarStats().damage,inner=this.roarStats().inner) {
      source.heroKnock=source.heroKnock||0;
      if(echo&&this.observableCast)this.observableCast('fear','echo',source,radius);
      this.effect(echo?'echo':'roar',source.x,source.y,radius,.6);this.emit(echo?'echo':'roar');
      for(const e of this.targets()) {
        if(distance(source,e)>radius||!this.clearLine(source,e,2))continue;
        if(distance(source,e)<inner+e.r)this.damageEnemy(e,damage,'roar',source);
        if(e.gone||e.hp<=0)continue;
        const flag=this.hero&&this.hero.ward&&distance(e,this.hero.ward)<this.hero.ward.r;
        if(e.type==='villager')this.scare(e,'fear',!echo,!echo);
        const brace=e===this.hero&&(e.preps||[]).includes('brace'),control=flag?0:brace ? .35 : 1;
        if(e!==this.hero)e.stun=Math.max(e.stun,duration*control);
        else if(!echo)e.stun=Math.max(e.stun,Math.min(.5,duration*.5)*control);
        const d=Math.max(1,distance(source,e)), amount=(e===this.hero?Math.min(knock,Math.max(0,18-source.heroKnock)):knock)*control;
        if(e===this.hero)source.heroKnock+=amount;
        this.move(e,(e.x-source.x)/d*amount,(e.y-source.y)/d*amount);
        if(e===this.hero&&!echo&&control>0&&e.state==='windup'){e.state='recover';e.timer=.85;this.emit('opening',{text:'你打断了勇者 · 爆发机会'});}
      }
      if(this.hero&&this.hero.anchor&&distance(source,this.hero.anchor)<inner+this.hero.anchor.r){this.hero.anchor.hp-=damage;if(this.hero.anchor.hp<=0){this.hero.anchor=null;this.emit('opening',{text:'镇魂锚点被震碎 · 恐影恢复追击'});}}
    }
    shout(aim) {
      const p=this.player;
      if(p.stun>0)return this.skillBlocked('roar','失衡中，暂时无法震慑');
      if(p.roarCooldown>0)return this.skillBlocked('roar','震慑尚未冷却');
      const {radius,inner,damage,duration,knock,cooldown}=this.roarStats();
      // Capture the affected set before knockback; aim position never limits a roar.
      const markTargets=this.ranks.SQ03?this.targets().filter(e=>distance(p,e)<=radius&&this.clearLine(p,e,2)):[];
      const trait=this.ranks.SQ02&&this.pets.length<3?'phantom':markTargets.length?'judgement':'fear';
      this.combatAction('fear',trait);p.roarCooldown=cooldown;
      const source={x:p.x,y:p.y,heroKnock:0};this.roarWave(source,radius,duration,knock);
      for(const target of markTargets)if(!target.gone&&target.hp>0){
        target.voiceMarks=Math.min(3,(target.voiceMarks||0)+1);target.voiceMarkFlash=.5;
        this.effect('voice-mark',target.x,target.y,32,.8);this.emit('voice-mark',{x:target.x,y:target.y,count:target.voiceMarks});
      }
      if(this.ranks.SQ01)this.scheduled.push({kind:'echo',wait:.65,source,radius:1.25*radius,inner:1.25*inner,damage:.7*damage,duration:.5*duration,knock:.5*knock});
      if(this.ranks.SQ02&&this.pets.length<3){const pet={id:this.nextId++,type:'phantom',x:p.x+Math.cos(p.angle)*24,y:p.y+Math.sin(p.angle)*24,r:10,life:6,cooldown:0,damage:.45*damage};this.pets.push(pet);this.effect('phantom-summon',pet.x,pet.y,45,.6);this.emit('phantom',{count:this.pets.length});}
      return true;
    }
    judgement() {
      const p=this.player;if(!this.ranks.SQ03)return false;
      if(p.stun>0)return this.skillBlocked('judgement','失衡中，暂时无法审判');
      if(p.judgementCooldown>0)return this.skillBlocked('judgement','审判尚未冷却');
      const s=this.roarStats(),marked=this.targets().filter(e=>e.voiceMarks>0&&distance(p,e)<s.radius*2.5&&this.clearLine(p,e,2));
      if(!marked.length)return this.skillBlocked('judgement','附近没有可引爆的声印');
      this.combatAction('fear','judgement');p.judgementCooldown=.8;
      for(const e of marked){const stacks=e.voiceMarks;e.voiceMarks=0;this.damageEnemy(e,s.damage*(1+1.2*stacks),'judgement');this.effect('judgement',e.x,e.y,44+stacks*10,.75);}
      this.emit('judgement',{count:marked.length});
      return true;
    }
    charge(returning=false) {
      const p=this.player,trail=p.returnTrail;
      if(p.stun>0)return this.skillBlocked('dash','失衡中，暂时无法冲撞');
      if(p.plunge)return this.skillBlocked('dash','落地后才能再次冲撞');
      if(returning&&p.dashTime>0&&!p.dashReturning&&trail){p.returnQueued=true;this.emit('return-queued',{text:'已准备折返 · 冲撞结束后返回'});return true;}
      if(p.dashTime>0)return false;
      if(returning){
        if(!trail||trail.life<=0)return this.skillBlocked('return','回路已消失');
        if(!this.clearLine(p,trail.start,p.r)){trail.blocked=true;return this.skillBlocked('return','回路受阻 · 绕开障碍后重试');}
      }else if(p.dashCharges<=0)return this.skillBlocked('dash','冲撞次数尚未恢复');
      if(!returning)p.dashCharges--;
      p.dashTime=.3;p.dashAngle=p.angle;p.dashHits=[];p.invuln=.32;
      p.dashOrigin={x:p.x,y:p.y};p.dashReturning=returning;
      if(returning){
        p.returnAttempt={...trail};p.returnTarget={...trail.start};p.dashAngle=Math.atan2(trail.start.y-p.y,trail.start.x-p.x);p.dashTime=distance(p,trail.start)/620;
        p.returnTrail=null;p.returnQueued=false;p.invuln=p.dashTime+.02;
        if(p.dashTime<1e-9){p.dashTime=0;p.dashReturning=false;p.returnTarget=null;p.returnAttempt=null;}
      }else if(this.ranks.MQ02)p.returnTrail={start:{x:p.x,y:p.y},end:{x:p.x,y:p.y},life:2,ready:false,blocked:false};
      this.combatAction('force',returning?'return':'force');
      p.breathTime=0;p.heatInterrupted=true;p.fireActive=false;
      if(!p.dashRegen)p.dashRegen=this.forceStats().recovery;
      this.effect('dash',p.x,p.y,34,.45,p.dashAngle);this.emit('dash',{returning});
      return true;
    }
    plungePlacement(aim,chargeTime=this.player.dashCharge||0) {
      const p=this.player;
      const reach=200+Math.min(1.2,chargeTime)*70,angle=Math.atan2(aim.y-p.y,aim.x-p.x),len=Math.min(reach,distance(p,aim));
      let end={x:p.x,y:p.y};for(let d=2;d<=len;d+=2){const point={x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d};if(this.blocked(point.x,point.y,p.r))break;end=point;}
      return {...end,radius:85+Math.min(.8,chargeTime)*20,valid:distance(p,end)>=12};
    }
    beginPlunge(aim,chargeTime) {
      const p=this.player;if(!this.ranks.MQ03)return false;
      if(p.stun>0)return this.skillBlocked('plunge','失衡中，暂时无法天坠');
      if(p.dashCharges<=0)return this.skillBlocked('plunge','冲撞次数尚未恢复');
      if(p.dashTime>0||p.plunge)return this.skillBlocked('plunge','落地后才能再次天坠');
      const point=this.plungePlacement(aim,chargeTime);if(!point.valid)return this.skillBlocked('plunge','落点受阻 · 换个位置');
      const end={x:point.x,y:point.y};
      p.dashCharges--;if(!p.dashRegen)p.dashRegen=this.forceStats().recovery;
      p.plunge={id:this.nextId++,start:{x:p.x,y:p.y},end,progress:0,duration:.45,radius:point.radius,damage:this.forceStats().damage*(1.4+Math.min(.8,chargeTime)*.5)};
      p.invuln=.5;p.breathTime=0;p.heatInterrupted=true;p.fireActive=false;
      this.combatAction('force','plunge');this.effect('plunge-tell',end.x,end.y,p.plunge.radius,.5);this.emit('plunge',{x:end.x,y:end.y});
      const h=this.hero;if(h&&h.preps.includes('landingTrap')&&h.counterCooldown<=0){h.counterTell={kind:'landing',plungeId:p.plunge.id,x:end.x,y:end.y,r:85,life:.95};h.counterCooldown=6;}
      return true;
    }
    tickPlunge(dt) {
      const p=this.player,f=p.plunge;if(!f)return;
      f.progress=Math.min(1,f.progress+dt/f.duration);p.x=f.start.x+(f.end.x-f.start.x)*f.progress;p.y=f.start.y+(f.end.y-f.start.y)*f.progress;
      if(f.progress<1)return;
      for(const e of this.targets())if(distance(e,f.end)<f.radius+e.r&&this.clearLine(f.end,e,2))this.damageEnemy(e,f.damage,'plunge',f.start);
      for(const b of this.solids)if(b.hp>0&&b.type!=='house'&&circleRect(f.end.x,f.end.y,f.radius,b))this.damageSolid(b,f.damage,'plunge');
      this.breakHeroDevices(f.end,f.radius);this.effect('plunge-impact',f.end.x,f.end.y,f.radius,.7);this.emit('plunge-impact',{x:f.end.x,y:f.end.y});p.plunge=null;
    }
    breakHeroDevices(point,radius=48) {
      const h=this.hero;if(!h)return;
      if(h.ward&&distance(point,h.ward)<radius){h.ward=null;this.emit('opening',{text:'圣旗被撞毁 · 火场恢复'});this.effect('debris',point.x,point.y,45,.6);}
      if(h.anchor&&distance(point,h.anchor)<radius){h.anchor=null;this.emit('opening',{text:'镇魂锚点被撞毁 · 恐影恢复'});}
    }
    tickPets(dt) {
      for(const pet of this.pets){pet.life-=dt;pet.cooldown-=dt;
        const target=this.targets().filter(e=>e.type!=='villager'&&!e.report&&!e.pendingWitness).sort((a,b)=>distance(pet,a)-distance(pet,b))[0];
        if(!target)continue;
        pet.target=target.id;this.walkTo(pet,target,195,dt);
        if(distance(pet,target)<target.r+24&&pet.cooldown<=0){let damage=pet.damage;
          if(this.hero&&this.hero.anchor&&distance(pet,this.hero.anchor)<this.hero.anchor.r)damage*=.25;
          this.damageEnemy(target,damage,'phantom',pet);pet.cooldown=.65;this.effect('phantom-hit',target.x,target.y,26,.25);}
      }
      this.pets=this.pets.filter(p=>p.life>0);
    }
    earthWave() {
      const p=this.player, angle=p.dashAngle, end={x:p.x+Math.cos(angle)*120,y:p.y+Math.sin(angle)*120};
      let length=120;for(let d=2;d<=120;d+=2)if(this.blocked(p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d,1)){length=d-2;break;}
      end.x=p.x+Math.cos(angle)*length;end.y=p.y+Math.sin(angle)*length;
      this.attackTrait='earth';
      if(this.observableCast)this.observableCast('force','earth',p,length+45);
      for(const e of this.targets())if(segmentDistance(e,p,end)<=24+e.r&&this.clearLine(p,e,2)){
        this.damageEnemy(e,this.forceStats().damage,'earth');
        if(e!==this.hero)this.move(e,Math.cos(angle)*35,Math.sin(angle)*35);
      }
      this.attackTrait=null;
      this.effect('earth',p.x,p.y,length,.65,angle);this.emit('earth',{x:p.x,y:p.y});
    }
    tickScheduled(dt) {
      this.chainTimer=Math.max(0,this.chainTimer-dt);
      const ready=[];this.scheduled=this.scheduled.filter(task=>{task.wait-=dt;if(task.wait<=0){ready.push(task);return false;}return true;});
      for(const task of ready){
        if(task.kind==='echo'){this.attackTrait='echo';this.roarWave(task.source,task.radius,task.duration,task.knock,true,task.damage,task.inner);this.attackTrait=null;}
        else {
          const state=this.chainStates[task.chainId];
          const next=task.next?this.targets().filter(e=>e.burn>0&&!state.visited.includes(e.id)&&distance(state.last,e)<=90&&this.clearLine(state.last,e,2)).sort((a,b)=>distance(state.last,a)-distance(state.last,b)||String(a.id).localeCompare(String(b.id)))[0]:task.node;
          if(!next){delete this.chainStates[task.chainId];continue;}
          const node={id:next.id,x:next.x,y:next.y};this.attackTrait='chain';
          this.effect('explosion',node.x,node.y,task.radius,.45);this.emit('explosion',node);
          if(state.last)this.effect('chain-link',state.last.x,state.last.y,distance(state.last,node),.5,Math.atan2(node.y-state.last.y,node.x-state.last.x));
          state.visited.push(node.id);
          for(const e of this.targets())if(!state.hits.includes(e.id)&&distance(e,node)<task.radius+e.r&&this.clearLine(node,e,2)){state.hits.push(e.id);this.damageEnemy(e,task.damage,'explosion',node);}
          this.attackTrait=null;state.last=node;
          if(task.remaining>0)this.scheduled.push({...task,next:true,node:null,wait:.16,remaining:task.remaining-1});else delete this.chainStates[task.chainId];
        }
      }
    }
    tickPlayer(dt,input) {
      const p=this.player;
      // The opening requires actually breaking the shackle; no farming from the frame.
      if(this.story&&!this.story.disabled&&!this.story.flags.escaped)input={...input,fire:false,placePressed:false,ignite:false,roar:false,roarPressed:false,roarHeld:false,dash:false,dashPressed:false,dashHeld:false};
      p.invuln=Math.max(0,p.invuln-dt);p.stun=Math.max(0,p.stun-dt);p.roarCooldown=Math.max(0,p.roarCooldown-dt);p.judgementCooldown=Math.max(0,(p.judgementCooldown||0)-dt);p.fieldCooldown=Math.max(0,p.fieldCooldown-dt);
      if(p.skillFeedback)p.skillFeedback.life=Math.max(0,p.skillFeedback.life-dt);
      const aim=input.aim||{x:p.x+Math.cos(p.angle)*100,y:p.y+Math.sin(p.angle)*100};
      const wanted=Math.atan2(aim.y-p.y,aim.x-p.x);p.angle+=clamp(angleDiff(wanted,p.angle),-12*dt,12*dt);
      const held=!!input.fire,pressed=(held&&!p.fireHeld)||!!input.placePressed,released=!held&&p.fireHeld;
      const ignitePressed=!!input.ignite&&!p.igniteHeld;p.igniteHeld=!!input.ignite;
      if(released){if(p.dashTime<=0&&p.stun<=0)this.releaseLance();p.breathTime=0;p.idleTime=0;p.heatInterrupted=false;}
      if(pressed&&p.extinguished&&p.energy>=p.maxEnergy*.3)p.extinguished=false;
      p.fireHeld=held;p.fireActive=false;
      if(p.returnTrail&&p.returnTrail.ready!==false){p.returnTrail.life-=dt;p.returnTrail.blocked=!this.clearLine(p,p.returnTrail.start,p.r);if(p.returnTrail.life<=0){p.returnTrail=null;p.returnQueued=false;}}
      if(p.returnAttempt)p.returnAttempt.life=Math.max(0,p.returnAttempt.life-dt);
      if(p.dashCharges<p.dashMax){p.dashRegen-=dt;if(p.dashRegen<=0){p.dashCharges++;p.dashRegen=p.dashCharges<p.dashMax?this.forceStats().recovery:0;}}
      const qHeld=!!input.roarHeld,qPress=!!input.roarPressed,qRelease=!qHeld&&(p.roarHeld||qPress);
      if(this.ranks.SQ03&&input.roarHeld!==undefined){
        if(qPress)p.roarCharge=0;if(qHeld)p.roarCharge+=dt;
        if(qRelease){if(p.roarCharge+1e-9>=.5)this.judgement();else this.shout(aim);p.roarCharge=0;}
      }else if(qPress||input.roar)this.shout(aim);
      p.roarHeld=qHeld;
      const dHeld=!!input.dashHeld,dPress=!!input.dashPressed,dRelease=!dHeld&&(p.dashHeld||dPress);
      if(dPress){
        p.dashCharge=0;p.dashChargeMode=this.ranks.MQ03?'plunge':null;
        if(!p.dashChargeMode){
          const returning=!!(this.ranks.MQ02&&p.returnTrail);
          // A cast uses the current cursor, not the unfinished idle turn animation.
          if(!returning)p.angle=wanted;
          this.charge(returning);
        }
      }
      if(dHeld&&p.dashChargeMode)p.dashCharge+=dt;
      if(dRelease&&p.dashChargeMode){
        if(p.dashChargeMode==='plunge'&&p.dashCharge+1e-9>=.45)this.beginPlunge(aim,p.dashCharge);
        else {p.angle=wanted;this.charge();}
        p.dashCharge=0;p.dashChargeMode=null;
      }
      if(input.dash){p.angle=wanted;this.charge();}p.dashHeld=dHeld;
      if(ignitePressed&&p.dashTime>0&&this.path==='field'&&!p.igniteQueued){p.igniteQueued=true;this.emit('ignite-queued',{text:'已准备引爆 · 冲撞结束后释放'});}
      if(input.interactPressed)this.interact();
      if(p.plunge)this.tickPlunge(dt);
      else if(p.dashTime>0){
        const activeDt=Math.min(dt,p.dashTime),from={x:p.x,y:p.y};
        p.dashTime=Math.max(0,p.dashTime-dt);if(p.dashTime<1e-9)p.dashTime=0;
        const dx=Math.cos(p.dashAngle),dy=Math.sin(p.dashAngle);
        for(const b of this.solids)if(b.hp>0&&b.type!=='house'&&circleRect(p.x+dx*29,p.y+dy*29,25,b)&&!p.dashHits.includes(b.id)){p.dashHits.push(b.id);this.damageSolid(b,85+20*this.ranks.M01,'dash');}
        const destination=p.dashReturning&&p.returnTarget&&!p.dashTime?p.returnTarget:{x:p.x+dx*620*activeDt,y:p.y+dy*620*activeDt};
        if(p.dashReturning&&!this.clearLine(p,destination,p.r)){
          p.dashTime=0;if(p.returnAttempt&&p.returnAttempt.life>0)p.returnTrail={...p.returnAttempt,ready:true,blocked:true};
          this.skillBlocked('return','回路受阻 · 折返已停止');
        }
        else this.move(p,destination.x-p.x,destination.y-p.y);
        for(const e of this.targets())if(segmentDistance(e,from,p)<e.r+33&&this.clearLine(p,e,2)&&!p.dashHits.includes(e.id)){
          p.dashHits.push(e.id);this.damageEnemy(e,this.forceStats().damage,'dash',p.dashOrigin);
          if(!e.gone&&e!==this.hero){e.stun=.6;this.move(e,dx*74,dy*74);}
          if(e===this.hero&&e.guard>0){e.guard=0;e.state='recover';e.timer=1.8;this.emit('opening',{text:'防火盾失衡 · 绕侧或喷火反击'});}
        }
        this.breakHeroDevices(p);
        if(p.returnTrail&&!p.dashReturning)p.returnTrail.end={x:p.x,y:p.y};
        if(!p.dashTime){
          if(this.ranks.MQ01)this.earthWave();
          p.dashReturning=false;p.returnTarget=null;p.returnAttempt=null;
          if(p.returnTrail&&p.returnTrail.ready===false){p.returnTrail.ready=true;p.returnTrail.life=2;}
          if(p.igniteQueued){p.igniteQueued=false;if(p.stun<=0)this.igniteSeeds();else this.skillBlocked('ignite','失衡中，引爆已取消');}
          if(p.returnQueued){p.returnQueued=false;this.charge(true);}
        }
      }else if(p.stun<=0){
        const mx=input.mx||0,my=input.my||0,len=Math.hypot(mx,my);
        const speed=held&&!p.extinguished&&this.path!=='field'?130:185;
        if(len)this.move(p,mx/len*speed*dt,my/len*speed*dt);
        if((this.path==='field'?pressed:held)&&!p.extinguished){if(pressed){p.heatInterrupted=false;if(this.path!=='field'&&p.energy>0)this.combatAction('flame','flame');}this.fire(dt,aim);}
        else if(pressed&&p.extinguished)this.skillBlocked('fire','炎息熄灭 · 松开并恢复至三成后重按');
        if(ignitePressed)this.igniteSeeds();
      }else{p.breathTime=0;p.heatInterrupted=true;if(ignitePressed)this.skillBlocked('ignite','失衡中，暂时无法引爆');if(pressed)this.skillBlocked('fire','失衡中，暂时无法喷火');}
      // Holding a dry trigger never restores fuel. Recovery starts only after release.
      if(held||input.placePressed)p.idleTime=0;
      else{const before=p.idleTime;p.idleTime+=dt;p.energy=Math.min(p.maxEnergy,p.energy+20*Math.max(0,p.idleTime-.8-Math.max(0,before-.8)));}
      if(input.interact&&this.rescue.status==='trapped'&&distance(p,this.rescue)<85){this.rescue.progress+=dt/1.7;if(this.rescue.progress>=1)this.saveVillager('player');}
      else if(this.rescue.status==='trapped')this.rescue.progress=Math.max(0,this.rescue.progress-dt*.25);
    }
    tickEntities(dt) {
      for (const e of this.entities) {
        if (e.gone) continue;
        if(e.type==='storyActor'||e.storyActor){if(this.tickStoryActor)this.tickStoryActor(e,dt);continue;}
        e.life += dt; e.stun = Math.max(0, e.stun - dt); e.cooldown -= dt; e.chainCooldown -= dt; e.flash = Math.max(0, (e.flash || 0) - dt);e.voiceMarkFlash=Math.max(0,(e.voiceMarkFlash||0)-dt);
        if (e.burn > 0) { e.burnAge=(e.burnAge||0)+dt; e.burn=Math.max(0,e.burn-dt); this.damageEnemy(e, dt * 5, 'burn'); } else e.burnAge=0;
        if (e.gone || e.stun > 0) continue;
        if(e.report&&this.tickReporter){this.tickReporter(e,dt);continue;}
        if(e.pendingWitness&&this.tickWitness){this.tickWitness(e,dt);continue;}
        if (e.type === 'villager') {
          if (e.report) {
            e.report.age += dt; this.walkTo(e, { x: 512, y: 242 }, 82, dt);
            if (distance(e, { x: 512, y: 242 }) < 28) this.deliverReport(e);
          } else if (e.feared) {
            const target = this.village ? this.village.locations['south-gate'] : e.x < this.worldWidth/2 ? { x: 80, y: 740 } : { x: this.worldWidth-80, y: 740 };
            this.walkTo(e, target, 103, dt); if (distance(e, target) < 35 || e.life > 44) e.gone = true;
          } else {
            const p = this.player;
            if (distance(e, p) < 45) { this.scare(e, 'fear'); continue; }
            this.move(e, Math.cos(e.wander) * 10 * dt, Math.sin(e.wander) * 10 * dt);
          }
        } else {
          const p = this.player;
          if (e.attackTimer > 0) {
            e.attackTimer -= dt;
            if (e.attackTimer <= 0) {
              if (distance(e, p) < 61 && Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim)) < 1.15) this.playerDamage(10);
              this.effect('slash', e.x, e.y, 50, .22, e.aim); e.cooldown = 2.1;
            }
          } else if (distance(e, p) < 49 && e.cooldown <= 0) { e.attackTimer = .65; e.aim = Math.atan2(p.y - e.y, p.x - e.x); }
          else {
            let target = p;
            if (this.phase === 'boss' && this.hero && this.hero.preps.includes('spacing') && e.burn > 0) {
              const dx = e.x - this.hero.x, dy = e.y - this.hero.y, d = Math.max(1, Math.hypot(dx, dy));
              target = { x: e.x + dx / d * 90, y: e.y + dy / d * 90 };
            } else if (this.phase === 'boss' && this.hero && this.hero.preps.includes('spacing') && distance(e, this.hero) < 120 && distance(e, p) > 120) {
              const a = e.id * 2.4; target = { x: this.hero.x + Math.cos(a) * 170, y: this.hero.y + Math.sin(a) * 170 };
            }
            this.walkTo(e, target, e.speed, dt);
          }
        }
      }
      this.entities = this.entities.filter(e => !e.gone);
    }
    fieldLinks(burningOnly=true) {
      const eligible=this.fields.filter(f=>!burningOnly||f.state==='burning'),byId=new Map(eligible.map(f=>[f.id,f]));
      return eligible.filter(f=>f.link&&byId.has(f.link)).map(f=>({a:byId.get(f.link),b:f}));
    }
    clearWardFields() {
      const ward=this.hero&&this.hero.ward;
      if(!ward)return;
      for(const f of this.fields)if(f.state==='burning'&&distance(f,ward)<ward.r+f.r*.5)f.life=0;
      for(const {a,b} of this.fieldLinks())if(segmentDistance(ward,a,b)<ward.r+12)b.link=null;
      this.fields=this.fields.filter(f=>f.state==='seed'||f.life>0);
    }
    tickFields(dt) {
      const damage=this.flameStats().damage*.75;
      this.syncFieldRadii();
      for(const f of this.fields)if(f.state==='burning')f.life-=dt;
      this.fields=this.fields.filter(f=>f.state==='seed'||f.life>0);
      this.clearWardFields();
      const burning=this.fields.filter(f=>f.state==='burning'),links=new Map(this.fieldLinks().map(link=>[link.b.id,link]));
      this.attackTrait='field';
      for(const e of this.targets()){
        for(const f of burning){
          const link=links.get(f.id);
          const inField=distance(e,f)<f.r+e.r&&this.clearLine(f,e,2);
          const inLink=link&&segmentDistance(e,link.a,f)<12+e.r&&this.clearLine(link.a,e,2);
          if(inField||inLink)this.damageEnemy(e,damage*dt,'fire',f);
        }
      }
      this.attackTrait=null;
      for(const b of this.solids)if(b.hp>0&&b.type!=='house')for(const f of burning)if(circleRect(f.x,f.y,f.r,b))this.damageSolid(b,damage*dt,'fire');
      if(this.rescue.status==='trapped'&&burning.some(f=>distance(f,this.rescue)<f.r+35))this.rescue.heat+=dt*.09;
    }
    preparationWeights() {
      const r = {...this.rumors,...Object.fromEntries(Object.entries(this.knownTraits||{}).filter(([,n])=>n>0))}, cautious = this.personality === 'cautious';
      // Generic sword/shield remain available. Specialist gear requires delivered evidence;
      // ranks and the currently equipped qualities are deliberately never read here.
      const weights={shield:1+(r.flame||0)*.4+(r.dragon||0)*2+(cautious?1:0),thrust:1+(r.dragon||0)*1.7+(cautious?0:1)};
      const add=(key,evidence,mult=2.5)=>{if(evidence>0)weights[key]=1+evidence*mult;};
      add('ward',r.field,2.8);add('spacing',r.chain,3);add('brace',r.fear,1.3);
      add('echoStep',r.echo);add('anchor',r.phantom);add('focus',r.judgement);
      add('oblique',(r.force||0)+(r.earth||0));add('returnTrap',r.return);add('landingTrap',r.plunge);
      return weights;
    }
    choosePreparations() {
      const weights = this.preparationWeights(), picked = [];
      for (let i = 0; i < 2; i++) {
        const keys = Object.keys(weights).filter(k => !picked.includes(k));
        let n = this.random() * keys.reduce((sum, k) => sum + weights[k], 0), choice = keys[0];
        for (const k of keys) { n -= weights[k]; if (n <= 0) { choice = k; break; } }
        picked.push(choice);
      }
      return picked;
    }
    finishNight() {
      if (this.phase !== 'raid') return;
      if(this.settleReports)this.settleReports();else for (const e of this.entities) if (e.report) this.deliverReport(e);
      this.entities = []; this.fields = [];this.pets=[]; this.scheduled=[]; this.completedNights=Math.max(this.completedNights,this.night); this.phase = 'interlude';
      this.player.energy = this.player.maxEnergy; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      this.player.fireActive=false;this.player.fireHeld=false;this.player.breathTime=0;this.player.extinguished=false;this.player.idleTime=0;
      this.player.roarHeld=false;this.player.dashHeld=false;this.player.roarCharge=0;this.player.dashCharge=0;this.player.dashChargeMode=null;this.player.returnTrail=null;this.player.plunge=null;
      this.clearActionInput();this.player.returnTarget=null;this.player.returnAttempt=null;this.player.dashReturning=false;this.player.dashTime=0;
      if(!this.rewardedNights.includes(this.night)){this.rewardedNights.push(this.night);this.openChoices('reward');}this.emit('interlude');
    }
    retreat() { if (this.phase === 'raid' && this.time >= this.retreatAt) this.finishNight(); }
    continue() {
      if (this.phase !== 'interlude') return;
      if (this.night < 3) {
        this.night++; this.time = 0; this.phase = 'raid'; this.player.x = 900; this.player.y = 930;
        this.player.dashCharges = this.player.dashMax; this.player.roarCooldown = 0;this.player.judgementCooldown=0;
        this.populateNight();
      } else this.startBoss();
    }
    startBoss() {
      this.phase = 'boss'; this.time = 0; this.fields = [];this.pets=[]; this.entities = []; this.scheduled=[];this.player.fireHeld=false;this.player.igniteHeld=false;this.player.fireActive=false;this.player.extinguished=false;this.player.breathTime=0;
      this.player.roarHeld=false;this.player.dashHeld=false;this.player.roarCharge=0;this.player.dashCharge=0;this.player.dashChargeMode=null;this.player.returnTrail=null;this.player.plunge=null;
      this.clearActionInput();this.player.returnTarget=null;this.player.returnAttempt=null;this.player.dashReturning=false;this.player.judgementCooldown=0;
      this.player.x = 896; this.player.y = 930; this.player.hp = Math.max(this.player.hp, this.player.maxHp * .8);
      this.player.energy = this.player.maxEnergy; this.player.roarCooldown = 0; this.player.dashCharges = this.player.dashMax; this.player.dashTime = 0;
      this.hero = { id: 'hero', type: 'hero', x: 1088, y: 488, r: 17, hp: 2200, maxHp: 2200, angle: 1.9, burn: 0,
        chainCooldown: 0, stun: 0, flash: 0, state: 'approach', timer: 1.1, attackCooldown: 1.1, guard: 0,
        guardCooldown: 2, ward: null, wardCooldown: 4, preps: this.choosePreparations(), observed: 0,
        observationCooldown: 0, adapted: false, aim: 0, action: null, rescueProgress: 0, stage: 1, pathTimer: 0,
        observations:{flame:0,fear:0,force:0},anchor:null,anchorCooldown:3,focus:0,focusCooldown:1,counterCooldown:2,obliqueGuard:0,echoDodgeIn:-1 };
      if(this.village){Object.assign(this.player,this.village.nightStarts[2]);Object.assign(this.hero,this.village.heroStart);}
      const formation = this.hero.preps.includes('spacing');
      for (let i = 0; i < 4; i++) {
        const x=this.village?this.hero.x+(i%2?1:-1)*(formation?310:170):formation?660+(i%2)*680:910+(i%2)*210;
        const y=this.village?this.hero.y+Math.floor(i/2)*190:436+Math.floor(i/2)*184;
        if(!this.village||!this.blocked(x,y,13))this.spawn('militia',x,y);
      }
      this.addLog('勇者：“他们让我杀死魔王。但我得先把人带回去。”');
      this.emit('boss', { text: '勇者到来 · ' + this.hero.preps.map(k => PREPARATIONS[k].name).join(' / ') });
      const savedEvents = this.events; this.events = [];
      this.checkpoint = copy({ ...this, checkpoint: null }); this.events = savedEvents;
    }
    retryBoss() {
      if (!this.checkpoint) return false;
      const cp = copy(this.checkpoint); Object.assign(this, cp); this.checkpoint = copy(cp); this.emit('boss', { text: '同一套构筑，再试一次。' }); return true;
    }
    beginHeroAction(action) {
      const h = this.hero, p = this.player;
      h.action = action; h.state = 'windup'; h.timer = action === 'thrust' ? .8 : action === 'heavy' ? 1 : .65;
      h.aim = Math.atan2(p.y - h.y, p.x - h.x); h.angle = h.aim;
      h.lockedTarget = { x: p.x, y: p.y }; h.hitPlayer = false;
      if (action === 'thrust') this.emit('hero-tell', { text: '猎龙突刺 · 侧移避开红线' });
    }
    tickHeroCounters(dt) {
      const h=this.hero,p=this.player;
      h.focus=Math.max(0,(h.focus||0)-dt);h.focusCooldown=(h.focusCooldown||0)-dt;
      h.anchorCooldown=(h.anchorCooldown||0)-dt;h.counterCooldown=(h.counterCooldown||0)-dt;h.obliqueGuard=Math.max(0,(h.obliqueGuard||0)-dt);
      if(h.anchor){h.anchor.life-=dt;if(h.anchor.life<=0||h.anchor.hp<=0)h.anchor=null;}
      if(h.counterTell){const t=h.counterTell;t.life-=dt;
        if(t.life<=0){if(distance(p,t)<t.r)this.playerDamage(t.kind==='return'?19:23);this.effect('hero-counter',t.x,t.y,t.r,.35);h.counterTell=null;}}
      if(h.echoDodgeIn>=0){h.echoDodgeIn-=dt;if(h.echoDodgeIn<=0)h.echoDodgeReady=true;}
      if(h.stun>0)return;
      if(h.echoDodgeReady){h.echoDodgeIn=-1;h.echoDodgeReady=false;h.counterStep={angle:Math.atan2(h.y-p.y,h.x-p.x),life:.22};this.emit('hero-tell',{text:'错拍步 · 勇者撤向回声外侧'});}
      if(h.counterStep){this.move(h,Math.cos(h.counterStep.angle)*420*dt,Math.sin(h.counterStep.angle)*420*dt);h.counterStep.life-=dt;if(h.counterStep.life<=0)h.counterStep=null;}
      if(h.preps.includes('anchor')&&this.pets.length&&h.anchorCooldown<=0&&!h.anchor){h.anchor={x:h.x,y:h.y,r:90,hp:70,life:9};h.anchorCooldown=14;this.emit('hero-tell',{text:'镇魂锚点 · 震击或冲撞摧毁'});}
      if(h.preps.includes('focus')&&p.roarCharge>.16&&h.focusCooldown<=0){h.focus=1.05;h.focusCooldown=5;this.emit('hero-tell',{text:'凝神架势 · 等待金光结束再审判'});}
      if(h.preps.includes('oblique')&&p.dashTime>0&&h.counterCooldown<=0){h.obliqueGuard=1.1;h.counterCooldown=4;this.emit('hero-tell',{text:'斜列架盾 · 改变冲入角度'});}
      if(h.preps.includes('landingTrap')&&p.plunge&&h.lastPlungeDodge!==p.plunge.id&&h.counterTell&&h.counterTell.kind==='landing'&&h.counterTell.plungeId===p.plunge.id&&distance(h,p.plunge.end)<p.plunge.radius+35){
        h.lastPlungeDodge=p.plunge.id;
        h.counterStep={angle:Math.atan2(h.y-p.plunge.end.y,h.x-p.plunge.end.x),life:.25};
        this.emit('hero-tell',{text:'诱落反击 · 勇者避开预告落点'});
      }
      if(!h.patternAdapted&&Math.max(h.observations?.fear||0,h.observations?.force||0)>=3){h.patternAdapted=true;
        this.emit('adapt',{text:(h.observations.force||0)>(h.observations.fear||0)?'勇者记住了冲入方向 · 开始停步诱撞':'勇者记住了吼声间隔 · 开始在空档进攻'});}
    }
    tickHero(dt) {
      const h = this.hero, p = this.player; if (!h || h.hp <= 0) return;
      h.stun = Math.max(0, h.stun - dt); h.flash = Math.max(0, h.flash - dt); h.guard = Math.max(0, h.guard - dt);h.voiceMarkFlash=Math.max(0,(h.voiceMarkFlash||0)-dt);
      h.shieldOpen=Math.max(0,(h.shieldOpen||0)-dt); h.guardCooldown -= dt; h.wardCooldown -= dt; h.attackCooldown -= dt; h.observationCooldown -= dt; h.chainCooldown -= dt;
      if (h.burn > 0) { h.burnAge=(h.burnAge||0)+dt; h.burn=Math.max(0,h.burn-dt); this.damageEnemy(h, 5 * dt, 'burn'); } else h.burnAge=0;
      if (h.ward) { h.ward.life -= dt; if (h.ward.life <= 0) h.ward = null; }
      this.tickHeroCounters(dt);
      if (p.fireActive && p.breathTime > .85 && h.observationCooldown <= 0) { h.observed++; h.observationCooldown = 3.2; }
      if (h.observed >= 3 && !h.adapted) { h.adapted = true; this.addLog('勇者：“你总会在这里停下来。我记住了。”'); this.emit('adapt', { text: '勇者改变节奏：他开始等待你长时间施法。' }); }
      if (h.hp < h.maxHp * .48 && h.stage === 1) { h.stage = 2; this.emit('adapt', { text: '勇者放下完美的姿态 · 攻击节奏加快' }); this.effect('hero-aura', h.x, h.y, 130, .9); }
      if (h.stun > 0) return;
      if (h.state === 'recover') { h.timer -= dt; if (h.timer <= 0) h.state = 'approach'; return; }
      if (h.state === 'windup') {
        h.timer -= dt;
        if (h.timer <= 0) {
          if (h.action === 'thrust') { h.state = 'thrust'; h.timer = .55; }
          else {
            if (h.action === 'heavy' && h.lockedTarget && !this.blocked(h.lockedTarget.x, h.lockedTarget.y, h.r)) { h.x = h.lockedTarget.x; h.y = h.lockedTarget.y; }
            const d = distance(h, p);
            if ((h.action === 'heavy' && d < 102) || (h.action === 'slash' && d < 83 && Math.abs(angleDiff(Math.atan2(p.y - h.y, p.x - h.x), h.aim)) < 1.15)) this.playerDamage(h.action === 'heavy' ? 24 : 18);
            this.effect(h.action === 'heavy' ? 'hero-aura' : 'slash', h.x, h.y, h.action === 'heavy' ? 105 : 85, .3, h.aim);
            h.state = 'recover'; h.timer = .85; h.attackCooldown = h.stage === 2 ? 1.4 : 2.1;
          }
        }
        return;
      }
      if (h.state === 'thrust') {
        this.move(h, Math.cos(h.aim) * 475 * dt, Math.sin(h.aim) * 475 * dt); h.timer -= dt;
        if (!h.hitPlayer && distance(h, p) < 41) { this.playerDamage(23); h.hitPlayer = true; }
        if (h.timer <= 0) { h.state = 'recover'; h.timer = 1.1; h.attackCooldown = 2.5; }
        return;
      }
      const r = this.rescue, shouldRescue = r.status === 'trapped' && (r.danger > (this.personality === 'cautious' ? .28 : .5) || h.hp < h.maxHp * .55);
      if (shouldRescue) {
        h.state = 'rescue';
        if (distance(h, r) > 63) this.walkTo(h, { x: r.x - 38, y: r.y + 34 }, 113, dt);
        else { h.rescueProgress += dt / 3; if (h.rescueProgress >= 1) { this.saveVillager('hero'); h.state = 'recover'; h.timer = 1; } }
        return;
      }
      h.state = 'approach';
      if (h.preps.includes('ward') && h.wardCooldown <= 0 && (this.fields.some(f=>f.state==='burning') || p.roarCooldown > 4)) {
        h.ward = { x: h.x, y: h.y, r: 88, life: 9 }; h.wardCooldown = 14;
        this.emit('hero-ward', { text: '净火圣旗 · 冲撞旗座或把勇者推出保护范围' });
      }
      if (h.preps.includes('shield') && h.guardCooldown <= 0 && !h.shieldOpen && p.fireActive && distance(h, p) < 300) { h.guard = 2.7; h.guardCooldown = 7; }
      h.angle = Math.atan2(p.y - h.y, p.x - h.x);
      const d = distance(h, p);
      const fearAdapt=h.patternAdapted&&(h.observations.fear||0)>=(h.observations.force||0);
      if (h.preps.includes('thrust') && h.attackCooldown <= 0 && d > 75 && d < 335 && (p.breathTime > (h.adapted ? .55 : 1.15) || h.stage === 2 && this.random() < dt * .6)) {
        this.beginHeroAction('thrust'); return;
      }
      const fearWindow=!fearAdapt||p.roarCooldown>.45;
      if (h.attackCooldown <= 0 && d > 85 && d < 270&&fearWindow) { this.beginHeroAction('heavy'); return; }
      if (d < 79 && h.attackCooldown <= 0&&fearWindow) { this.beginHeroAction(this.random() < .4 ? 'heavy' : 'slash'); return; }
      const forceWait=h.patternAdapted&&(h.observations.force||0)>(h.observations.fear||0)&&p.dashCharges>0&&d<230;
      if (d > 55&&!h.counterStep&&!forceWait)this.walkTo(h,p,h.guard>0||h.obliqueGuard>0?60:fearAdapt&&p.roarCooldown>.8?164:h.stage===2?152:137,dt);
    }
    tickRescue(dt) {
      const r = this.rescue;
      if (!r.active || r.status !== 'trapped') return;
      r.danger += dt * (.007 + Math.min(.015, r.heat * .025)); r.heat = Math.max(0, r.heat - dt * .035);
      if (r.danger >= 1) { r.status = 'lost'; r.rescuer = null; this.addLog('守粮人：“我们没有把黎安带回来。”'); this.emit('lost', { text: '粮仓的火吞没了最后的呼救。' }); }
    }
    tick(dt, input = {}) {
      dt = clamp(dt, 0, .05);
      if(this.phase==='resolution'){if(this.tickResolution)this.tickResolution(dt,input);return;}
      if (!['raid','boss'].includes(this.phase)) return;
      this.time += dt; this.totalTime += dt;
      this.effects.forEach(e => e.life -= dt); this.effects = this.effects.filter(e => e.life > 0);
      this.downed.forEach(e => e.life -= dt); this.downed = this.downed.filter(e => e.life > 0);
      this.tickPlayer(dt, input);
      if (!['raid','boss','upgrade'].includes(this.phase)) return;
      this.tickScheduled(dt); this.tickFields(dt);this.tickPets(dt); this.tickEntities(dt); if (this.phase === 'boss') this.tickHero(dt);
      this.tickRescue(dt);
      if(this.tickReports)this.tickReports(dt);
      if(this.tickStory)this.tickStory(dt,input);
      if (this.phase === 'raid') {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.entities.length < 21 && this.time < NIGHT_LENGTH - 7) {
          const spots = [[640,416],[1400,440],[600,880],[1380,810],[1100,1170]];
          const spot = spots[Math.floor(this.random() * spots.length)];
          this.spawn('militia', spot[0], spot[1]);
          if (this.time < NIGHT_LENGTH-20) this.spawn('villager', spot[0] + 26, spot[1] + 24);
          this.spawnTimer = this.night === 3 ? 6.8 : 9.3;
        }
        this.checkGrowth();
        if (this.time >= NIGHT_LENGTH) this.finishNight();
      }
    }
    testimony() {
      const r = this.rescue;
      return [
        { name: '铁匠洛安', text: this.characters.smith.down ? '“它把我打倒在铁匠铺外。就算围栏能修好，我也忘不了那一下。”' : this.stats.broken ? `“${this.stats.broken} 道围栏倒了。重建的时候，我们还会想起他。”` : '“围栏还在。我不知道这算克制，还是它根本不在乎。”' },
        { name: '守粮人阿禾', text: this.characters.grain.down ? r.rescuer === 'player' ? '“它伤过我，也救过黎安。这两件事，没有一件能抵消另一件。”' : '“我是被它打倒的。勇者输赢，都不会改变这件事。”' : r.rescuer === 'player' ? '“它放了火。也是它，把黎安带了出来。这两件事我都记得。”' : r.rescuer === 'hero' ? '“勇者输了这场战斗，但他没有丢下黎安。”' : r.status === 'trapped' ? '“黎安还在粮仓旁。我们不知道赢家会不会回头。”' : '“故事里的力量很壮观。可我们失去的人不会回来。”' },
        { name: '年轻民兵黎安', text: r.status === 'saved' ? r.rescuer === 'player' ? '“他们说魔王没有选择。可它明明停下来，推开了木梁。”' : '“他也会害怕。把我带出去的时候，他的手一直在抖。”' : '这份证言没有被写下。' }
      ];
    }
  }
  return { Game, W, H, WORLD_W, WORLD_H, BELL_POSITION, REPORT_POSTS, NIGHT_LENGTH, XP, TERMS, DIRECTIONS, PREPARATIONS, segmentDistance, clamp, distance, angleDiff, circleRect };
});
