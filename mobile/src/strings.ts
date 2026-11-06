import type { VesselKind } from './vesselArt';
export type Lang = 'zh'|'en';
export const S = {
 zh: {
  title:'時光膠囊',sub:'把時間，交還給時間。',home:'收件',waiting:'等待',opening:'打開',seal:'封存',journey:'旅程',cabinet:'收藏',reset:'重設示範',english:'EN',inbox:'收件',sent:'寄件',from:'來自',to:'寄給',days:'天',daysUntil:'天後打開',kmAway:'公里之外',ready:'現在可以打開',new:'寄一個膠囊',openScene:'進入開啟儀式',waitingTitle:'時間還在路上',waitingSub:'有些話，值得慢慢抵達。',waited:'已經等了',hintHold:'長按容器，看看提示',hint:'記得那天的風，和我們說過的話。',openingTitle:'打開這段時間',openingSub:'按住光圈，讓封印慢慢鬆開',hold:'按住打開',release:'鬆開會重新封存',dragLetter:'把信向上拉',letter:'給未來的你：\n\n如果你正讀到這裡，願你還記得我們一起看過的那片海。時間真的走過了，而你也來到了這裡。\n\n要好好生活。',openedAt:'打開於',place:'澳門 · 議事亭前地',write:'寫一行想留給未來的話',sample:'挑一句示範文字',sampleText:'願我們在時間的另一邊，仍然認得彼此。',choose:'選擇容器',dragSeal:'把紅色封蠟拖到信上',sentAway:'已封存，正寄往未來',again:'再寄一封',mapTitle:'沿途的印記',mapSub:'每個地點，都是一段真的走過的路。',simulate:'模擬到達',passport:'時光護照',stamp:'已抵達',collected:'枚印記已收集',close:'收起',cabinetTitle:'你的收藏櫃',cabinetSub:'傾斜手機，看看玻璃上的光。',spin:'左右拖曳，轉動容器',edition:'限量編號',select:'挑選這個容器',tap:'輕點取出',arrival:'已抵達',location:'示範地點',navHome:'首頁',sealed:'封存中',more:'還有一些路要走',notice:'所有內容只在此示範畫面中',resetDone:'示範已重設'
 },
 en: {
  title:'Time Capsule',sub:'Let time do its work.',home:'Inbox',waiting:'Waiting',opening:'Open',seal:'Seal',journey:'Journey',cabinet:'Cabinet',reset:'Reset demo',english:'中',inbox:'Inbox',sent:'Sent',from:'From',to:'To',days:'days',daysUntil:'days to open',kmAway:'km away',ready:'Ready to open',new:'Send a capsule',openScene:'Opening ritual',waitingTitle:'Time is on its way',waitingSub:'Some words deserve a slow arrival.',waited:'Waiting for',hintHold:'Hold the vessel for a hint',hint:'Remember the wind that day, and what we said.',openingTitle:'Open this moment',openingSub:'Hold the halo to release the seal',hold:'Hold to open',release:'Release to seal it again',dragLetter:'Pull the letter up',letter:'Dear future you,\n\nIf you are reading this, I hope you remember the sea we watched together. Time has passed, and you made it here.\n\nTake care.',openedAt:'Opened at',place:'Macau · Senado Square',write:'Write one line for the future',sample:'Pick a sample line',sampleText:'May we still know each other on the other side of time.',choose:'Choose a vessel',dragSeal:'Drag the red wax onto the letter',sentAway:'Sealed and sent to the future',again:'Send another',mapTitle:'Marks along the way',mapSub:'Every place is a journey you really made.',simulate:'Simulate arrival',passport:'Time passport',stamp:'Arrived',collected:'stamps collected',close:'Close',cabinetTitle:'Your cabinet',cabinetSub:'Tilt your phone to catch the light.',spin:'Drag sideways to spin the vessel',edition:'Limited edition',select:'Choose this vessel',tap:'Tap to lift out',arrival:'Arrived',location:'Demo place',navHome:'Home',sealed:'Sealed',more:'A little farther to go',notice:'All content stays in this demo',resetDone:'Demo reset'
 }
} as const;
export type Copy = typeof S['zh'];

export const NAMES:Record<VesselKind,{zh:string;en:string}>={dome:{zh:'玻璃罩藍玫瑰',en:'Blue rose dome'},bottle:{zh:'漂流瓶',en:'Message bottle'},envelope:{zh:'封蠟信封',en:'Wax envelope'},tin:{zh:'時光鐵盒',en:'Time tin'},lantern:{zh:'中秋花燈',en:'Moon lantern'},musicbox:{zh:'木製音樂盒',en:'Music box'},maison:{zh:'Maison Aurèle 戒指盒',en:'Maison Aurèle ring box'}};
export const PLACES=[
 {zh:'澳門 · 議事亭前地',en:'Macau · Senado Square',x:235,y:190},
 {zh:'香港 · 尖沙咀鐘樓',en:'Hong Kong · TST Clock Tower',x:249,y:184},
 {zh:'台北 · 台北 101',en:'Taipei · Taipei 101',x:291,y:161},
 {zh:'東京 · 淺草寺',en:'Tokyo · Sensō-ji',x:363,y:99},
 {zh:'京都 · 伏見稻荷',en:'Kyoto · Fushimi Inari',x:341,y:115},
 {zh:'首爾 · 景福宮',en:'Seoul · Gyeongbokgung',x:305,y:91},
 {zh:'新加坡 · 魚尾獅',en:'Singapore · Merlion',x:204,y:280},
 {zh:'曼谷 · 大皇宮',en:'Bangkok · Grand Palace',x:158,y:224},
 {zh:'北京 · 故宮',en:'Beijing · Forbidden City',x:251,y:100},
 {zh:'吉隆坡 · 雙子塔',en:'Kuala Lumpur · Petronas',x:196,y:261},
];
