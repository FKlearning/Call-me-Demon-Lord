/* Encounter messages: one living carrier, observed casts rather than victim counts. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DemonReports = api; if (root.DemonDemo) api.install(root.DemonDemo); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function install(api) {
    const P = api.Game.prototype;
    if (P.encounterReportsInstalled) return api;
    P.encounterReportsInstalled = true;
    const { distance, DIRECTIONS } = api;
    const posts = api.REPORT_POSTS || [{ id:'north',x:1024,y:85 },{ id:'west',x:80,y:740 },{ id:'east',x:1968,y:740 }];
    const nightLength = api.NIGHT_LENGTH || 150;
    const baseScare = P.scare, baseInteract = P.interact;
    const clone = v => JSON.parse(JSON.stringify(v));
    P.initReports = function () {
      this.messages = { serial:0, actions:[], candidates:[], facts:[], observations:{}, viewTraits:{}, factWitnesses:{}, latestByDirection:{}, settledTokens:{}, started:0, lastSeen:0, latest:null, sent:[], tutorialShown:false };
      this.knownTraits={flame:0,fear:0,force:0,dragon:0,field:0,chain:0,echo:0,phantom:0,judgement:0,earth:0,return:0,plunge:0};
    };
    P.activeReport = function () { return this.entities.find(e=>!e.gone&&e.hp>0&&e.report) || null; };
    P.reportStatus = function () {
      const e=this.activeReport();
      if(!e)return {active:false};
      const r=e.report, stage=r.stage || 'prepare';
      return {active:true,id:e.id,kind:r.kind,stage,stageName:{prepare:'准备出发',travel:'前往驿站',sending:'正在送信'}[stage],
        post:clone(r.post), progress:stage==='sending'?r.sendProgress/2.5:stage==='prepare'?1-r.prepare:0,
        remaining:stage==='prepare'?r.prepare:stage==='sending'?2.5-r.sendProgress:distance(e,r.post)/82+2.5};
    };
    P.recordAction = function (dir, trait=dir) {
      if(!this.messages)this.initReports();
      if(this.phase!=='raid'||!DIRECTIONS[dir])return null;
      const m=this.messages;
      const action={id:++m.serial,dir,trait,time:this.time,x:this.player.x,y:this.player.y,seen:false,synthetic:false};
      m.latest=action;m.latestByDirection[dir]=action;
      return action.id;
    };
    P.observeAction = function (witness, dir, trait) {
      if(this.phase!=='raid'||this.reportSlots>=3||this.time>nightLength-35||!witness||witness.storyActor||witness.gone||witness.hp<=0||witness.type!=='villager')return false;
      if(!this.messages)this.initReports();
      const m=this.messages;
      let action=m.latestByDirection[dir];
      if(!action||action.synthetic&&m.settledTokens[action.id]) {
        // Direct simulation calls also count one cast, never one record per damaged target.
        action={id:++m.serial,dir,trait:trait||dir,time:this.time,x:this.player.x,y:this.player.y,seen:false,synthetic:true};m.latest=action;m.latestByDirection[dir]=action;
      }
      if(m.settledTokens[action.id])return false;
      if(!m.actions.some(a=>a.id===action.id)) {
        m.actions.push({...action,seen:true}); if(m.actions.length===1)m.started=this.time;
        m.lastSeen=this.time;
      }
      m.observations[witness.id]=m.observations[witness.id]||[];
      if(!m.observations[witness.id].includes(action.id))m.observations[witness.id].push(action.id);
      m.viewTraits[witness.id]=m.viewTraits[witness.id]||[];
      if(!m.viewTraits[witness.id].includes(trait||action.trait||dir))m.viewTraits[witness.id].push(trait||action.trait||dir);
      if(!witness.report&&!m.candidates.includes(witness.id)){m.candidates.push(witness.id);witness.pendingWitness=true;}
      return true;
    };
    P.scare = function (e,kind,canReport=true,awardFear=true) {
      if(canReport)this.observeAction(e,kind,this.attackTrait||(this.messages&&this.messages.latestByDirection[kind]||{}).trait||kind);
      return baseScare.call(this,e,kind,false,awardFear);
    };
    P.witnessAttack = function (victim,kind) {
      if(this.phase!=='raid'||kind==='burn'||!victim||victim.storyActor)return;
      const dir=['dash','earth','plunge','return'].includes(kind)?'force':['roar','echo','phantom','judgement'].includes(kind)?'fear':'flame';
      const latest=this.messages&&this.messages.latestByDirection[dir];
      const trait=this.attackTrait||(['earth','plunge','return','phantom','judgement','beam','explosion'].includes(kind)?({beam:'dragon',explosion:'chain'}[kind]||kind):latest&&latest.trait)||dir;
      const token=(latest?latest.id:Math.floor(this.time*10)+'-'+dir)+'-'+trait;
      if(victim.witnessAction===token)return;
      const witnesses=this.entities.filter(e=>e!==victim&&e.type==='villager'&&!e.storyActor&&!e.gone&&e.hp>0
        &&distance(e,victim)<260&&this.clearLine(e,victim,2));
      if(witnesses.length){victim.witnessAction=token;for(const witness of witnesses)this.observeAction(witness,dir,trait);}
    };
    P.observeStoryFact = function (fact,position) {
      if(this.phase!=='raid'||!this.messages)return false;
      const witnesses=this.entities.filter(e=>e.type==='villager'&&!e.storyActor&&!e.gone&&e.hp>0&&distance(e,position)<300&&this.clearLine(e,position,2));
      if(!witnesses.length)return false;
      if(!this.messages.facts.includes(fact))this.messages.facts.push(fact);
      for(const e of witnesses){this.messages.factWitnesses[e.id]=this.messages.factWitnesses[e.id]||[];
        if(!this.messages.factWitnesses[e.id].includes(fact))this.messages.factWitnesses[e.id].push(fact);
        if(!e.report&&!this.messages.candidates.includes(e.id)){this.messages.candidates.push(e.id);e.pendingWitness=true;}}
      return true;
    };
    P.observableCast=function(dir,trait,source,radius){
      if(this.phase!=='raid')return;
      for(const e of this.entities)if(e.type==='villager'&&!e.storyActor&&!e.gone&&e.hp>0&&distance(e,source)<Math.min(480,radius+180)&&this.clearLine(e,source,2))this.observeAction(e,dir,trait);
    };
    P.chooseReportPost = function (e) {
      const choices=(this.reportPosts||posts).map(p=>({...p,d:distance(e,p)}));
      // A nearby edge cannot instantly remove a witness. Prefer a route long enough to respond.
      return choices.sort((a,b)=>Math.abs(a.d-900)-Math.abs(b.d-900))[0];
    };
    P.releaseEncounter = function () {
      const m=this.messages;if(!m||!m.actions.length||this.activeReport()||this.reportSlots>=3||this.time>nightLength-35)return false;
      const candidates=m.candidates.map(id=>this.entities.find(e=>e.id===id&&!e.gone&&e.hp>0&&!e.report&&!e.storyActor))
        .filter(e=>e&&(m.observations[e.id]||[]).length);
      if(!candidates.length){this.clearEncounter();return false;}
      // Surviving witnesses are preferred; the cast record never invents a replacement person.
      const e=candidates.sort((a,b)=>distance(b,this.player)-distance(a,this.player))[0];
      const actions=m.actions.filter(a=>(m.observations[e.id]||[]).includes(a.id));
      const totals={flame:0,fear:0,force:0};for(const a of actions)totals[a.dir]++;
      let roll=this.random()*actions.length,kind='flame';
      for(const d of Object.keys(totals)){roll-=totals[d];if(roll<0){kind=d;break;}}
      const traits=[...(m.viewTraits[e.id]||[])];
      e.report={kind,trait:traits.find(t=>t!==kind)||kind,traits,actions:clone(actions),facts:[...(m.factWitnesses[e.id]||[])],age:0,stage:'prepare',prepare:1,sendProgress:0,post:this.chooseReportPost(e)};
      e.pendingWitness=false;e.feared=true;e.path=null;e.pathTimer=0;this.reportSlots++;
      for(const id of m.candidates){const w=this.entities.find(a=>a.id===id);if(w)w.pendingWitness=false;}
      this.clearEncounter();
      this.emit('report-created',{text:DIRECTIONS[kind].name+'见闻 · 一名报信者',kind,x:e.x,y:e.y});
      if(!m.tutorialShown){m.tutorialShown=true;this.emit('report-hint',{text:'追上按 E 截住，或让这条见闻传出去。'});}
      return true;
    };
    P.clearEncounter = function () {
      if(!this.messages)return;
      for(const a of this.messages.actions)this.messages.settledTokens[a.id]=true;
      for(const id of this.messages.candidates){const e=this.entities.find(a=>a.id===id);if(e)e.pendingWitness=false;}
      Object.assign(this.messages,{actions:[],candidates:[],facts:[],observations:{},viewTraits:{},factWitnesses:{},started:0,lastSeen:0});
    };
    P.tickReports = function () {
      if(this.phase!=='raid'||!this.messages)return;
      const m=this.messages;
      m.candidates=m.candidates.filter(id=>this.entities.some(e=>e.id===id&&!e.gone&&e.hp>0));
      if(m.actions.length&&(this.time-m.lastSeen>=2||this.time-m.started>=12))this.releaseEncounter();
    };
    P.tickWitness = function (e,dt) {
      // The waiting witness is still a normal, vulnerable person; no coloured marker yet.
      const dx=e.x-this.player.x,dy=e.y-this.player.y,d=Math.hypot(dx,dy)||1;
      if(d<170)this.move(e,dx/d*45*dt,dy/d*45*dt);
    };
    P.tickReporter = function (e,dt) {
      const r=e.report;if(!r||e.gone||e.hp<=0)return;
      r.age+=dt;
      if(r.stage==='prepare'){r.prepare=Math.max(0,r.prepare-dt);if(r.prepare===0)r.stage='travel';return;}
      if(distance(e,r.post)>32){r.stage='travel';r.sendProgress=0;this.walkTo(e,r.post,82,dt);return;}
      r.stage='sending';r.sendProgress+=dt;if(r.sendProgress>=2.5)this.deliverReport(e);
    };
    P.deliverReport = function (e) {
      if(!e.report||e.hp<=0||e.gone)return false;
      const r=e.report;
      this.rumors[r.kind]=(this.rumors[r.kind]||0)+1;
      for(const t of r.traits||[r.trait])if(t){
        this.knownTraits[t]=(this.knownTraits[t]||0)+1;
        if(!DIRECTIONS[t])this.rumors[t]=(this.rumors[t]||0)+1;
      }
      this.stats.delivered++;
      const sent={night:this.night,kind:r.kind,traits:[...(r.traits||[])],facts:[...(r.facts||[])],source:e.character||e.name||'村民',actions:clone(r.actions||[])};
      this.messages.sent.push(sent);
      if(this.onStoryMessage)this.onStoryMessage(sent);
      this.addLog('一名幸存者抵达驿站，讲述了'+DIRECTIONS[r.kind].name+'见闻。');
      this.emit('delivered',{text:'见闻送达 · '+DIRECTIONS[r.kind].name+'成长偏向增加',kind:r.kind});
      e.report=null;e.pendingWitness=false;e.gone=true;return true;
    };
    P.interact = function () {
      const e=this.activeReport();
      if(e&&distance(e,this.player)<80){e.report=null;e.pendingWitness=false;e.feared=true;this.stats.intercepted++;
        this.emit('intercepted',{text:'见闻已截住 · 这封消息没有送达'});this.addLog('你截住了信，放报信人离开。');return;}
      return baseInteract.call(this);
    };
    P.settleReports = function () {
      const e=this.activeReport();if(e){e.report=null;e.pendingWitness=false;this.emit('report-expired',{text:'夜已结束 · 未抵达驿站的消息没有送达'});}
      this.clearEncounter();if(this.messages){this.messages.latest=null;this.messages.latestByDirection={};}
    };
    return api;
  }
  return { install };
});
