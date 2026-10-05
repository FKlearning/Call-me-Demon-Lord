/* Complete, isolated campaign. Historical Game and D10Game remain unchanged. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){
    const base=require('./core.js'),api=factory(base,require('./d10.js'),require('./village-map.js'));module.exports=api;
    require('./campaign-story.js').install(api.CampaignGame,base);
    require('./d12.js').install(api.CampaignGame,base);
  }else{const api=factory(root.DemonDemo,root.DemonD10,root.DemonVillage);root.DemonCampaign=api;root.DemonDemo.CampaignGame=api.CampaignGame;}
})(typeof globalThis!=='undefined'?globalThis:this,function(api,d10,village){
  'use strict';
  const {Game,TERMS,NIGHT_LENGTH,distance,clamp}=api,{D10Game}=d10;
  const NIGHTS=3,WAVES=9,WAVE_INTERVAL=16;
  // Cumulative XP; reaching it always opens a genuine card page immediately.
  // First ten levels use the tested D10 curve. Later supply grows from 81 to
  // 108/135 soldiers, while the increments rise to 160 and then 235 XP.
  function threshold(level){if(level<=0)return 0;if(level<=10)return 80+(level-1)*113;if(level<=18)return 1097+(level-10)*160;return 2377+(level-18)*235;}
  const clone=value=>JSON.parse(JSON.stringify(value));
  class CampaignGame extends D10Game{
    constructor(seed){
      super(seed);this.isCampaign=true;this.campaignVersion='0.11.0';this.story.disabled=true;
      if(!village)throw new Error('D14 village-map.js must load before campaign.js');
      this.village=village;this.worldWidth=village.width;this.worldHeight=village.height;
      this.bellPosition={...village.bellPosition};this.reportPosts=clone(village.reportPosts);this.solids=clone(village.solids);
      Object.assign(this.player,village.playerStart);Object.assign(this.characters.smith,village.locations.smith);Object.assign(this.characters.grain,village.locations.granary);
      this.initD10Scenes();
      this.campaignGrowthHistory=[];this.campaignNightStats=[];this.bossRetries=0;this.campaignDefeatedHero=false;
      this.nightEndQueued=false;this._campaignNightCommitted=0;this._campaignClaimedRewards=[];this.growthPoolEnded=false;
      if(this.initCampaignStory)this.initCampaignStory();
    }
    populateNight(){
      const sent=clone(this.messages?.sent||[]),traits={...(this.knownTraits||{})},serial=this.messages?.serial||0,tutorialShown=!!this.messages?.tutorialShown;
      D10Game.prototype.populateNight.call(this);
      Object.assign(this.player,village.nightStarts[this.night-1]||village.playerStart);
      this.entities=[];
      // Villagers share the current encounter's neighbourhood. Expanding the
      // village must not make early reports and combat depend on a long walk.
      const p=this.player;
      for(const [dx,dy] of [[-115,-90],[100,-65],[-165,95],[150,90],[-230,20],[220,0],[60,175],[-70,170]]){
        if(!this.blocked(p.x+dx,p.y+dy,11))this.spawn('villager',p.x+dx,p.y+dy);
      }
      // Encounter buffers are per night. Already delivered intelligence is a
      // campaign fact, so it survives the D10 sample's per-night reset.
      this.messages.sent=sent;this.messages.serial=serial;this.messages.tutorialShown=tutorialShown;Object.assign(this.knownTraits,traits);
      this.nightEndQueued=false;this._campaignNightDelivered=this.stats.delivered;
      if(this.night>1){this.addLog(this.night===2?'第二夜：村落集结。幸存者会记得自己亲眼见过的力量。':'第三夜：军队来到钟下。第三夜黎明前，勇者将带着收到的见闻挑战你。');}
      if(this.populateCampaignNight)this.populateCampaignNight(this.night);
    }
    checkGrowth(){
      if(!['raid','boss'].includes(this.phase)||this.fear<threshold(this.combatGrowthCount+1))return false;
      if(!this.legalTerms([],true).length){if(!this.growthPoolEnded){this.growthPoolEnded=true;this.emit('pool-empty',{text:'本局可用词条已完成'});}return false;}
      return this.openChoices('upgrade');
    }
    openChoices(kind){
      if(!['upgrade','reward'].includes(kind))return false;
      if(this.choicePage||this.pendingUpgrade)return this.phase===kind&&!!this.choicePage;
      if(kind==='upgrade'&&!['raid','boss'].includes(this.phase))return false;
      if(kind==='reward'&&(this.phase!=='interlude'||this.completedNights!==this.night||this._campaignClaimedRewards.includes(this.night)))return false;
      const returnPhase=kind==='reward'?'interlude':this.phase,opened=D10Game.prototype.openChoices.call(this,kind);
      this.previousPhase=returnPhase;if(!opened){this.phase=returnPhase;if(kind==='reward')this._campaignClaimedRewards.push(this.night);}
      return opened;
    }
    chooseUpgrade(key){
      if(!['upgrade','reward'].includes(this.phase)||!this.choicePage||!this.getChoices().includes(key)||!TERMS[key]||this.ranks[key]>=TERMS[key].cap)return false;
      const kind=this.phase,returnPhase=this.previousPhase;
      if(TERMS[key].quality&&!this.qualityEligible(TERMS[key].dir))return false;
      if(!Game.prototype.chooseUpgrade.call(this,key))return false;
      this.nextGrowthAt=0;this.level=this.combatGrowthCount;this.phase=returnPhase;
      if(kind==='upgrade'){
        const entry={level:this.combatGrowthCount,night:this.night,time:this.time,totalTime:this.totalTime,totalXP:this.fear,key,quality:!!TERMS[key].quality};
        this.campaignGrowthHistory.push(entry);this.d10GrowthHistory.push({...entry});
        this.checkGrowth();
      }else{this._campaignClaimedRewards.push(this.night);this.emit('night-reward-claimed',{night:this.night,text:'本夜奖励已领取 · 战斗等级与经验门槛不变'});}
      return true;
    }
    growthStatus(){
      const level=this.combatGrowthCount,last=threshold(level),next=threshold(level+1),required=next-last;
      return {level,nextLevel:level+1,xp:Math.max(0,this.fear-last),nextXP:required,progress:clamp((this.fear-last)/required,0,1),totalXP:this.fear,nextThreshold:next,rewards:this.rewardCount,firstQualityAt:6,poolEnded:!!this.growthPoolEnded};
    }
    spawnD10Group(){
      const w=this.d10Wave,anchors=[[1230,760],[760,780],[1310,1080],[760,1100]],a=anchors[(w.index-1)%anchors.length],count=2+this.night;
      for(let i=0;i<count;i++){
        let p={x:a[0]+(i-(count-1)/2)*30,y:a[1]+w.groups*26};
        if(this.blocked(p.x,p.y,13))p={x:a[0]+(i-(count-1)/2)*30,y:a[1]-70-w.groups*24};
        if(this.blocked(p.x,p.y,13))continue;
        const e=this.spawn('militia',p.x,p.y);e.d10Wave=w.index;e.campaignWave=w.index;
        // Veterans use the existing readable melee AI; their health is modest,
        // rather than scaling all soldiers into damage sponges.
        if(this.night>1&&i===0&&w.groups===1){e.elite=true;e.name=this.night===2?'誓卫':'王庭誓卫';e.hp=e.maxHp=this.night===2?66:76;e.r=15;}
      }
      if(w.groups===0&&w.index%3===0){const p={x:a[0]-110,y:a[1]+115};if(!this.blocked(p.x,p.y,11)){const e=this.spawn('villager',p.x,p.y);e.d10Wave=w.index;}}
      w.groups++;this.emit('wave-group',{index:w.index,group:w.groups,night:this.night});
    }
    tick(dt,input={}){
      dt=clamp(dt,0,.05);
      if(this.phase==='resolution'){if(this.tickCampaignResolution)this.tickCampaignResolution(dt,input);return;}
      Game.prototype.tick.call(this,dt,input);
      if(this.phase==='raid')this.tickD10Waves();
      if(this.phase==='boss')this.checkGrowth();
    }
    finishNight(){
      if(this.phase!=='raid'||this.nightEndQueued||this.completedNights>=this.night||this.night>NIGHTS)return false;
      this.nightEndQueued=true;
      if(this.requestD10NightEnd&&this.requestD10NightEnd())return true;
      return this.finishCampaignAfterScene();
    }
    finishD10AfterScene(){return this.finishCampaignAfterScene();}
    finishCampaignAfterScene(){
      if(!this.nightEndQueued||this.completedNights>=this.night||this._campaignNightCommitted>=this.night)return false;
      this._campaignNightCommitted=this.night;
      this.campaignNightStats.push({night:this.night,seconds:this.time,levels:this.combatGrowthCount-this.nightGrowthStart,delivered:this.stats.delivered-this._campaignNightDelivered,xp:this.fear,hp:this.player.hp});
      this.phase='raid';Game.prototype.finishNight.call(this);return true;
    }
    continue(){
      if(this.phase!=='interlude'||this.choicePage||this.pendingUpgrade||this.completedNights!==this.night)return false;
      Game.prototype.continue.call(this);return true;
    }
    startBoss(){
      if(this.completedNights<NIGHTS||this.phase!=='interlude'||this.choicePage||this.pendingUpgrade||this.hero)return false;
      Game.prototype.startBoss.call(this);this.spawnTimer=1e9;this.bossRetries=0;this.createBossCheckpoint();return true;
    }
    createBossCheckpoint(){
      if(!this.hero||this.hero.hp<=0)return false;
      const savedEvents=this.events;this.events=[];
      this.checkpoint=clone({...this,phase:'boss',d10Scene:null,checkpoint:null,choicePage:null,pendingUpgrade:false});this.events=savedEvents;return true;
    }
    retryBoss(){
      if(this.phase!=='defeat'||!this.checkpoint||!this.checkpoint.hero||this.checkpoint.hero.hp<=0)return false;
      const retries=this.bossRetries+1,cp=clone(this.checkpoint);Object.assign(this,cp);this.checkpoint=clone(cp);this.bossRetries=retries;
      // JSON gives the two public collections separate copies. Relink physical
      // objects so subsequent scene changes still update their true collision.
      this.sceneProps=this.sceneProps.map(p=>this.solids.find(s=>s.scenePropId===p.id)||p);
      this.emit('boss',{text:'回到勇者交战前 · 构筑与已送达见闻保留'});return true;
    }
    onHeroDefeated(){
      if(this.campaignDefeatedHero||this.campaignStory?.stage==='defense')return true;
      this.campaignDefeatedHero=true;this.choicePage=null;this.pendingUpgrade=false;
      if(this.onCampaignHeroDefeated&&this.onCampaignHeroDefeated())return true;
      this.phase='victory';this.emit('victory');return true;
    }
    onPlayerDefeated(){return !!(this.onCampaignPlayerDefeated&&this.onCampaignPlayerDefeated());}
    bossStatus(){const h=this.hero;return h?{stage:h.stage,health:h.hp,maxHealth:h.maxHp,preparations:[...h.preps],elapsed:this.time,retryAvailable:!!this.checkpoint&&this.phase==='defeat',defense:this.campaignStory?.stage==='defense'}:null;}
  }
  return {CampaignGame,NIGHTS,WAVES,WAVE_INTERVAL,threshold};
});
