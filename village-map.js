/* D14 village geography. All coordinates describe the same playable village. */
(function(root,factory){
  const village=factory();
  if(typeof module==='object'&&module.exports)module.exports=village;
  else root.DemonVillage=village;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const width=3072,height=2064;
  const place=(id,name,x,y,zone,extra={})=>({id,name,x,y,zone,...extra});
  const locations={
    bell:place('bell','圣钟',1536,800,'钟楼广场',{bounds:{x:1376,y:640,w:320,h:280}}),
    execution:place('execution','处刑架',1536,1080,'钟楼广场',{bounds:{x:1476,y:1032,w:120,h:96}}),
    'side-door':place('side-door','广场侧门',1536,1264,'钟楼广场',{bounds:{x:1446,y:1255,w:180,h:18}}),
    infirmary:place('infirmary','包扎棚',2200,1352,'东巷',{bounds:{x:2070,y:1260,w:260,h:172}}),
    scribe:place('scribe','抄写台',880,1450,'西南旧屋',{entry:{x:880,y:1580},bounds:{x:690,y:1330,w:380,h:230}}),
    mill:place('mill','河岸磨坊',880,1800,'南边河岸',{entry:{x:880,y:1840},bounds:{x:720,y:1640,w:320,h:176}}),
    post:place('post','驿站',1536,240,'北门内',{bounds:{x:1616,y:120,w:280,h:216}}),
    'north-gate':place('north-gate','北门',1536,96,'北村界'),
    'south-gate':place('south-gate','南门',1536,1900,'南村界',{bounds:{x:1456,y:1850,w:160,h:96}}),
    'lian-lock':place('lian-lock','见证锁',1615,900,'钟楼广场',{bounds:{x:1591,y:876,w:48,h:48}}),
    'supply-west':place('supply-west','西侧线路',1296,980,'钟楼广场',{bounds:{x:1272,y:956,w:48,h:48}}),
    'supply-east':place('supply-east','东侧线路',1776,980,'钟楼广场',{bounds:{x:1752,y:956,w:48,h:48}}),
    smith:place('smith','钟匠工坊',820,840,'西街',{entry:{x:820,y:980},bounds:{x:650,y:620,w:340,h:290}}),
    market:place('market','集市',2272,900,'东街',{bounds:{x:2080,y:740,w:480,h:300}}),
    well:place('well','水井',1830,1536,'南街',{bounds:{x:1798,y:1504,w:64,h:64}}),
    granary:place('granary','谷仓',2230,1650,'东南田边',{entry:{x:2230,y:1710},bounds:{x:2080,y:1450,w:300,h:210}})
  };
  const house=(id,name,x,y,w,h,extra={})=>({id,name,x,y,w,h,type:'house',hp:1e9,...extra});
  const buildings=[
    house('post-house','驿站',1616,120,280,216,{role:'post'}),
    house('north-west-home','北街民居',1020,230,260,205),house('north-east-home','北街民居',1980,250,270,205),
    house('weaver','织坊',520,280,310,220),house('brewery','酒坊',480,1040,300,180),
    house('smith-house','钟匠工坊',650,620,340,290,{role:'smith',interior:true}),
    house('scribe-house','旧屋',690,1330,380,230,{role:'scribe',interior:true}),
    house('mill-house','磨坊',720,1640,320,176,{role:'mill',interior:true}),
    house('grain-house','谷仓',2080,1450,300,210,{role:'granary',interior:true}),
    house('east-home-a','东巷民居',2416,300,300,210),house('east-home-b','东巷民居',2630,640,270,230),
    house('east-home-c','东巷民居',2580,1120,290,210),house('east-home-d','田边民居',2580,1510,280,220),
    house('west-home-a','西巷民居',130,650,300,225),house('west-home-b','西巷民居',130,1130,285,220),
    house('north-store','旅舍',1180,400,245,190),house('east-store','杂货铺',1810,460,270,190),
    house('infirmary-roof','包扎棚',2070,1260,260,172,{role:'infirmary',open:true})
  ];
  const roads=[
    {id:'main-street',name:'南北主街',x:1456,y:72,w:160,h:1890},
    {id:'north-lane',name:'北街',x:450,y:530,w:2370,h:110},
    {id:'cross-street',name:'钟楼横街',x:420,y:930,w:2490,h:128},
    {id:'west-lane',name:'西巷',x:1070,y:560,w:100,h:1110},
    {id:'east-lane',name:'东巷',x:2370,y:540,w:100,h:1310},
    {id:'infirmary-lane',name:'包扎棚巷',x:1510,y:1312,w:930,h:96},
    {id:'south-street',name:'南街',x:455,y:1560,w:2340,h:112},
    {id:'mill-lane',name:'磨坊路',x:820,y:1536,w:120,h:360},
    {id:'river-road',name:'河岸路',x:440,y:1824,w:2350,h:112}
  ];
  const fields=[{id:'west-field',x:128,y:1570,w:350,h:330},{id:'south-field',x:1740,y:1710,w:550,h:198},{id:'east-field',x:2620,y:1780,w:288,h:160}];
  const decorations=[
    {id:'market-west',kind:'stall',x:2100,y:790,w:120,h:72},{id:'market-east',kind:'stall',x:2320,y:790,w:120,h:72},
    {id:'market-south',kind:'stall',x:2180,y:1048,w:148,h:64},
    {id:'well',kind:'well',x:1798,y:1504,w:64,h:64},
    {id:'scribe-table',kind:'table',x:825,y:1370,w:110,h:36},
    {id:'mill-wheel',kind:'wheel',x:692,y:1695,w:38,h:80},
    {id:'river',kind:'river',x:60,y:1976,w:2952,h:58}
  ];
  const solids=[];
  for(const b of buildings){
    if(b.open)continue;
    if(!b.interior){solids.push({...b});continue;}
    const t=16,door=110,side=(b.w-door)/2;
    for(const [suffix,x,y,w,h] of [['back',b.x,b.y,b.w,t],['west',b.x,b.y,t,b.h],['east',b.x+b.w-t,b.y,t,b.h],['front-west',b.x,b.y+b.h-t,side,t],['front-east',b.x+side+door,b.y+b.h-t,side,t]])solids.push(house(b.id+'-'+suffix,b.name+'墙',x,y,w,h,{interiorWall:true,buildingId:b.id}));
  }
  for(const d of decorations)if(['stall','well','table','wheel','river'].includes(d.kind))solids.push(house(d.id,d.kind,d.x,d.y,d.w,d.h,{decoration:true}));
  const props=[
    {id:'barrel-west',kind:'barrel',x:1366,y:1110,w:32,h:32},{id:'barrel-east',kind:'barrel',x:1674,y:1130,w:32,h:32},
    {id:'wood-support',kind:'support',x:1180,y:1160,w:28,h:40},{id:'fallen-gate',kind:'gate',x:1160,y:1220,w:160,h:18,state:'waiting',hp:0},
    {id:'alarm-bell',kind:'alarm',x:1842,y:1104,w:28,h:32},{id:'side-door',kind:'side-door',x:1446,y:1255,w:180,h:18}
  ];
  solids.push(house('d10-side-west','侧门墙',1426,1170,20,190,{sceneBarrier:true}),house('d10-side-east','侧门墙',1626,1170,20,190,{sceneBarrier:true}));
  const reportPosts=[{id:'north',name:'北门驿站',x:locations.post.x,y:locations.post.y}];
  const actors={lianStart:{x:1590,y:1090},guardStart:{x:1650,y:1120},lianDoor:{x:1504,y:1220},guardDoor:{x:1564,y:1218}};
  const routes={guardRetreat:[{x:1536,y:1352},{x:2200,y:1352}],evidenceRoute:[{x:880,y:1580},{x:1536,y:1580},{x:1536,y:240}]};
  const nightStarts=[{x:1536,y:1080},{x:880,y:1490},{x:1536,y:1070}];
  return {version:'D14-1',width,height,locations,buildings,roads,fields,decorations,props,solids,reportPosts,actors,routes,nightStarts,bellPosition:{x:1536,y:800},playerStart:{...nightStarts[0]},heroStart:{x:1536,y:905}};
});
