import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, type SharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Circle as SkCircle, RadialGradient, vec } from '@shopify/react-native-skia';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useFonts } from 'expo-font';
import { NotoSerifTC_400Regular } from '@expo-google-fonts/noto-serif-tc/400Regular';
import { NotoSerifTC_700Bold } from '@expo-google-fonts/noto-serif-tc/700Bold';
import { NotoSansTC_400Regular } from '@expo-google-fonts/noto-sans-tc/400Regular';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Vessel } from './Vessel';
import { VesselKind } from './vesselArt';
import { C, serif, sans } from './theme';
import { Lang, S, NAMES, PLACES } from './strings';

const KINDS:VesselKind[]=['dome','bottle','envelope','tin','lantern','musicbox','maison'];
type Scene='home'|'waiting'|'opening'|'seal'|'journey'|'cabinet';
const SCENES:Scene[]=['home','waiting','opening','seal','journey','cabinet'];
const tick=()=>{ if(Platform.OS!=='web') Haptics.selectionAsync().catch(()=>{}); };
const impact=(style:Haptics.ImpactFeedbackStyle)=>{if(Platform.OS!=='web') Haptics.impactAsync(style).catch(()=>{});};
const spring={damping:15,stiffness:170,mass:.85};
const label=(kind:VesselKind,lang:Lang)=>NAMES[kind][lang];

function Title({small,children}: {small?:boolean;children:React.ReactNode}) {return <Text style={[styles.title,small&&{fontSize:24}]}>{children}</Text>}
function Body({children,style}: {children:React.ReactNode;style?:any}) {return <Text style={[styles.body,style]}>{children}</Text>}
function Button({children,onPress,secondary=false,disabled=false}: {children:React.ReactNode;onPress:()=>void;secondary?:boolean;disabled?:boolean}) {return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.buttonSecondary,disabled&&{opacity:.45},pressed&&{transform:[{scale:.97}]}]}><Text style={[styles.buttonText,secondary&&{color:C.blue}]}>{children}</Text></Pressable>}
function Halo({size=280,light=false}: {size?:number;light?:boolean}) {return <Canvas style={{width:size,height:size,position:'absolute',alignSelf:'center'}} pointerEvents="none"><SkCircle cx={size/2} cy={size/2} r={size*.48}><RadialGradient c={vec(size/2,size/2)} r={size*.48} colors={light?['#FFE9A4DD','#DFEDF288','#FFFFFF00']:['#D7E8F3BB','#EDF3F777','#FFFFFF00']} /></SkCircle></Canvas>}

function HomeCard({kind,i,offset,step,width,lang,onPress,reduced}: {kind:VesselKind;i:number;offset:SharedValue<number>;step:number;width:number;lang:Lang;onPress:()=>void;reduced:boolean}) {
 const breathe=useSharedValue(0);
 useEffect(()=>{if(!reduced)breathe.value=withRepeat(withTiming(1,{duration:2400,easing:Easing.inOut(Easing.ease)}),-1,true);return()=>cancelAnimation(breathe)},[reduced]);
 const a=useAnimatedStyle(()=>{const d=(i*step+offset.value)/step;const ad=Math.min(1,Math.abs(d));return {transform:[{perspective:800},{translateX:i*step+offset.value},{translateY:ad*22-(1-ad)*(6+breathe.value*4)},{scale:1-ad*.11},{rotateY:`${-d*12}deg`}],opacity:1-ad*.46,zIndex:10-Math.round(ad*4)};});
 const isReady=i===2;
 return <Animated.View style={[styles.homeCard,{width,left:(Dimensions.get('window').width-width)/2},a]}><Pressable onPress={onPress} style={{flex:1,alignItems:'center'}} accessibilityRole="button" accessibilityLabel={label(kind,lang)}>
  <Text style={styles.cardTop}>{kind==='maison'?'MAISON AURÈLE · No.017 / 300':lang==='zh'?'時光膠囊':'TIME CAPSULE'}</Text>
  <View style={{height:205,justifyContent:'center'}}><Vessel kind={kind} size={154}/></View>
  <Text style={styles.cardName}>{label(kind,lang)}</Text>
  <View style={styles.cardRule}><Text style={styles.cardNumber}>{isReady?'✦':i%3===0?'30':i%3===1?'8.6':'12'}</Text><Text style={styles.cardRuleText}>{isReady?S[lang].ready:i%3===1?S[lang].kmAway:S[lang].daysUntil}</Text></View>
  <Text style={styles.cardPlace}>⌖  {i%3===1?(lang==='zh'?'香港 · 尖沙咀鐘樓':'Hong Kong · TST Clock Tower'):S[lang].place}</Text>
  <View style={styles.cardFoot}><Text style={styles.cardFootText}>{S[lang].from}  ◉  {['Thor','Ching','媽媽','Roy'][i%4]}</Text><Text style={styles.cardFootText}>2026 / 11 / 06</Text></View>
 </Pressable></Animated.View>;
}

function Home({lang,setLang,navigate,setKind,reduced}: {lang:Lang;setLang:(l:Lang)=>void;navigate:(s:Scene)=>void;setKind:(k:VesselKind)=>void;reduced:boolean}) {
 const [selected,setSelected]=useState(0);const w=Dimensions.get('window').width;const cardW=Math.min(310,w*.75),step=cardW+18;const offset=useSharedValue(0);
 const snap=(n:number)=>{setSelected(n);tick()};
 const pan=Gesture.Pan().activeOffsetX([-8,8]).onUpdate(e=>{offset.value=-selected*step+e.translationX}).onEnd(e=>{const next=Math.max(0,Math.min(KINDS.length-1,Math.round(selected-(e.translationX+e.velocityX*.16)/step)));offset.value=withSpring(-next*step,spring);runOnJS(snap)(next)});
 const bg=useAnimatedStyle(()=>({transform:[{translateX:offset.value*.055}]}));
 return <View style={{flex:1}}>
  <View style={styles.homeHead}><View><Text style={styles.brand}>{S[lang].title}</Text><Text style={styles.kicker}>{S[lang].sub}</Text></View><Pressable style={styles.lang} onPress={()=>{setLang(lang==='zh'?'en':'zh');tick()}}><Text style={{color:C.blue,fontWeight:'700'}}>{S[lang].english}</Text></Pressable></View>
  <View style={styles.segment}><View style={styles.segmentActive}><Text style={styles.segmentActiveText}>{S[lang].inbox}</Text></View><Pressable onPress={()=>navigate('seal')} style={styles.segmentOther}><Text style={styles.segmentText}>{S[lang].sent}</Text></Pressable></View>
  <GestureDetector gesture={pan}><View style={styles.rail}><Animated.View style={[styles.parallax,bg]}><View style={styles.parallaxCircle}/><View style={[styles.parallaxCircle,{left:260,top:180,width:150,height:150,opacity:.3}]}/></Animated.View>{KINDS.map((k,i)=><HomeCard key={k} kind={k} i={i} width={cardW} step={step} offset={offset} lang={lang} reduced={reduced} onPress={()=>{if(i!==selected){offset.value=withSpring(-i*step,spring);snap(i)}else {setKind(k);navigate('waiting')}}}/>)}</View></GestureDetector>
  <View style={styles.dots}>{KINDS.map((_,i)=><View key={i} style={[styles.dot,i===selected&&styles.dotOn]}/>)}</View>
  <Body style={{textAlign:'center',fontSize:12,marginBottom:12}}>{S[lang].notice}</Body>
  <View style={{paddingHorizontal:24,paddingBottom:12}}><Button onPress={()=>{setKind(KINDS[selected]);navigate('waiting')}}>{S[lang].openScene}  →</Button></View>
 </View>;
}

function Waiting({lang,kind,navigate,reduced}: {lang:Lang;kind:VesselKind;navigate:(s:Scene)=>void;reduced:boolean}) {
 const sway=useSharedValue(0);const float=useSharedValue(0);const glow=useSharedValue(.3);const progress=useSharedValue(0);const [hint,setHint]=useState(false);
 useEffect(()=>{progress.value=reduced?.72:withTiming(.72,{duration:2400});if(!reduced){sway.value=withRepeat(withTiming(3,{duration:2200,easing:Easing.inOut(Easing.ease)}),-1,true);float.value=withRepeat(withTiming(1,{duration:1900,easing:Easing.inOut(Easing.ease)}),-1,true);glow.value=withRepeat(withTiming(1,{duration:2900}),-1,true)}return()=>{cancelAnimation(sway);cancelAnimation(float);cancelAnimation(glow)}},[reduced]);
 const vesselStyle=useAnimatedStyle(()=>({transform:[{translateY:kind==='bottle'?float.value*-9:float.value*-3},{rotate:`${kind==='lantern'?sway.value*.5:sway.value*.3}deg`}]}));
 const glowStyle=useAnimatedStyle(()=>({opacity:glow.value*.6}));
 const progressStyle=useAnimatedStyle(()=>({width:`${progress.value*100}%`}));
 const hintGesture=Gesture.LongPress().minDuration(550).onStart(()=>{runOnJS(setHint)(true);runOnJS(impact)(Haptics.ImpactFeedbackStyle.Soft)});
 return <View style={styles.scene}><Text style={styles.eyebrow}>{label(kind,lang)}  ·  {S[lang].sealed}</Text><Title>{S[lang].waitingTitle}</Title><Body style={{textAlign:'center'}}>{S[lang].waitingSub}</Body>
  <GestureDetector gesture={hintGesture}><View style={styles.waitStage}><Animated.View style={[StyleSheet.absoluteFill,glowStyle]}><Halo size={310} light={kind==='lantern'}/></Animated.View><Animated.View style={vesselStyle}><Vessel kind={kind} size={230} contentSway={sway}/></Animated.View></View></GestureDetector>
  <View style={styles.counter}><Text style={styles.counterLabel}>{S[lang].waited}</Text><Text style={styles.counterNumber}>1,362</Text><Text style={styles.counterLabel}>{S[lang].days}</Text><View style={styles.progressTrack}><Animated.View style={[styles.progressFill,progressStyle]}/></View></View>
  <View style={styles.hint}><Text style={[styles.hand,{opacity:hint?1:.55}]}>{hint?`「${S[lang].hint}」`:S[lang].hintHold}</Text></View>
  <View style={{marginTop:'auto',width:'100%',gap:10}}><Button onPress={()=>{impact(Haptics.ImpactFeedbackStyle.Medium);navigate('opening')}}>{S[lang].openScene}</Button><Button secondary onPress={()=>navigate('home')}>{S[lang].navHome}</Button></View>
 </View>;
}

function Opening({lang,kind,onOpened,reduced}: {lang:Lang;kind:VesselKind;onOpened:()=>void;reduced:boolean}) {
 const [phase,setPhase]=useState<'sealed'|'unfold'|'read'>('sealed');const [record,setRecord]=useState(false);
 const charge=useSharedValue(0),lid=useSharedValue(0),burst=useSharedValue(0),letterY=useSharedValue(150),stamp=useSharedValue(0),thumbX=useSharedValue(50),thumbY=useSharedValue(50);
 const timers=React.useRef<ReturnType<typeof setTimeout>[]>([]);const completed=React.useRef(false);
 const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[]};
 const finish=()=>{if(completed.current)return;completed.current=true;clear();impact(Haptics.ImpactFeedbackStyle.Heavy);lid.value=reduced?1:withSpring(1,{damping:8,stiffness:115});burst.value=withSequence(withTiming(1,{duration:350}),withTiming(0,{duration:900}));setTimeout(()=>{setPhase('unfold');letterY.value=reduced?0:withSpring(110,spring)},reduced?100:650)};
 const start=(e:any)=>{if(completed.current)return;thumbX.value=e.nativeEvent.locationX;thumbY.value=e.nativeEvent.locationY;charge.value=withTiming(1,{duration:2200,easing:Easing.in(Easing.quad)},done=>{if(done)runOnJS(finish)()});timers.current=[setTimeout(()=>impact(Haptics.ImpactFeedbackStyle.Light),450),setTimeout(()=>impact(Haptics.ImpactFeedbackStyle.Medium),1100),setTimeout(()=>impact(Haptics.ImpactFeedbackStyle.Heavy),1750)]};
 const release=()=>{if(completed.current)return;clear();cancelAnimation(charge);charge.value=withSpring(0,{damping:15,stiffness:120});lid.value=withSpring(0,spring)};
 useEffect(()=>()=>clear(),[]);
 const ring=useAnimatedStyle(()=>({left:thumbX.value-60,top:thumbY.value-60,transform:[{scale:1+charge.value*.25}],opacity:.25+charge.value*.7}));
 const tremble=useAnimatedStyle(()=>({transform:[{translateX:Math.sin(charge.value*56)*charge.value*3},{rotate:`${Math.sin(charge.value*35)*charge.value*2}deg`},{scale:1+charge.value*.045}]}));
 const seam=useAnimatedStyle(()=>({opacity:charge.value*.85+burst.value*.7,transform:[{scale:1+charge.value*.18+burst.value*.65}]}));
 const burstStyle=useAnimatedStyle(()=>({opacity:burst.value,transform:[{scale:.4+burst.value*2}]}));
 const paperStyle=useAnimatedStyle(()=>({transform:[{translateY:letterY.value},{rotateX:`${Math.max(0,letterY.value/150)*-35}deg`}],opacity:interpolate(letterY.value,[0,150],[1,.65],Extrapolation.CLAMP)}));
 const drag=Gesture.Pan().onUpdate(e=>{letterY.value=Math.max(0,Math.min(140,110+e.translationY))}).onEnd(e=>{if(e.translationY < -35){letterY.value=withSpring(0,spring);runOnJS(setPhase)('read');runOnJS(onOpened)();runOnJS(setRecord)(true);stamp.value=withDelay(300,withSpring(1,{damping:8,stiffness:280}))}else letterY.value=withSpring(110,spring)});
 const stampStyle=useAnimatedStyle(()=>({opacity:stamp.value,transform:[{scale:1.9-stamp.value*.9},{rotate:'-8deg'}]}));
 return <View style={styles.scene}><Text style={styles.eyebrow}>03 / 06  ·  {S[lang].opening}</Text><Title>{S[lang].openingTitle}</Title><Body style={{textAlign:'center'}}>{phase==='sealed'?S[lang].openingSub:S[lang].dragLetter}</Body>
  <View style={[styles.openStage,phase!=='sealed'&&{height:155,marginTop:0}]}><Animated.View style={[StyleSheet.absoluteFill,seam]}><Halo size={phase==='sealed'?330:190} light/></Animated.View><Animated.View style={[styles.burst,burstStyle]}><Canvas style={{width:300,height:300}} pointerEvents="none">{Array.from({length:32},(_,i)=>{const a=i*2.399,r=48+(i%4)*25;return <SkCircle key={i} cx={150+Math.cos(a)*r} cy={150+Math.sin(a)*r} r={i%3===0?3:1.5} color={i%2?'#C9A15A':'#F8DF9A'}/>})}</Canvas></Animated.View><Animated.View style={tremble}><Vessel kind={kind} size={phase==='sealed'?235:125} lidLift={lid}/></Animated.View></View>
  {phase==='sealed'?<View style={{marginTop:'auto',width:'100%',alignItems:'center'}}><Pressable onPressIn={start} onPressOut={release} onTouchMove={e=>{thumbX.value=e.nativeEvent.locationX;thumbY.value=e.nativeEvent.locationY}} style={styles.hold} accessibilityRole="button" accessibilityLabel={S[lang].hold}><Animated.View style={[styles.holdRing,ring]}/><Text style={styles.holdText}>{S[lang].hold}</Text></Pressable><Body style={{fontSize:12,marginTop:10}}>{S[lang].release}</Body></View>:<GestureDetector gesture={drag}><Animated.View style={[styles.letter,paperStyle]}><Text style={styles.letterText}>{S[lang].letter}</Text>{record&&<Animated.View style={[styles.record,stampStyle]}><Text style={styles.recordText}>{S[lang].openedAt}{'\n'}{new Date().toLocaleString(lang==='zh'?'zh-TW':'en-US',{hour:'2-digit',minute:'2-digit'})}{'\n'}{S[lang].place}</Text></Animated.View>}<Text style={styles.pullTab}>⌃  {S[lang].dragLetter}</Text></Animated.View></GestureDetector>}
 </View>;
}

function Seal({lang,kind,setKind,reduced}: {lang:Lang;kind:VesselKind;setKind:(k:VesselKind)=>void;reduced:boolean}) {
 const [line,setLine]=useState('');const [phase,setPhase]=useState<'write'|'sealing'|'sent'>('write');const waxX=useSharedValue(0),waxY=useSharedValue(0),squash=useSharedValue(1),fold=useSharedValue(1),fly=useSharedValue(0),lid=useSharedValue(1);
 const done=()=>{impact(Haptics.ImpactFeedbackStyle.Heavy);setTimeout(()=>setPhase('sealing'),650);waxX.value=withSpring(0,spring);waxY.value=withSpring(-175,spring);squash.value=withSequence(withTiming(.55,{duration:100}),withSpring(1.15,{damping:7}));fold.value=reduced?0:withDelay(420,withTiming(0,{duration:450}));lid.value=withDelay(800,withSpring(0,spring));fly.value=withDelay(1200,withTiming(-260,{duration:950},()=>{fly.value=0;runOnJS(setPhase)('sent')}))};
 const wax=Gesture.Pan().onUpdate(e=>{waxX.value=e.translationX;waxY.value=e.translationY}).onEnd(e=>{if(e.translationY < -45)runOnJS(done)();else{waxX.value=withSpring(0,spring);waxY.value=withSpring(0,spring)}});
 const waxStyle=useAnimatedStyle(()=>({transform:[{translateX:waxX.value},{translateY:waxY.value},{scaleY:squash.value}]}));
 const foldStyle=useAnimatedStyle(()=>({transform:[{scaleY:fold.value}],opacity:fold.value}));
 const flyStyle=useAnimatedStyle(()=>({transform:[{translateY:fly.value}],opacity:interpolate(fly.value,[-260,-100,0],[0,1,1],Extrapolation.CLAMP)}));
 return <KeyboardAvoidingView style={styles.scene} behavior={Platform.OS==='ios'?'padding':undefined}><Text style={styles.eyebrow}>04 / 06  ·  {S[lang].seal}</Text><Title>{phase==='sent'?S[lang].sentAway:S[lang].write}</Title>
  {phase==='write'?<><TextInput multiline value={line} onChangeText={setLine} placeholder={S[lang].write} placeholderTextColor={C.muted} style={styles.input}/><Pressable onPress={()=>{setLine(S[lang].sampleText);tick()}}><Text style={styles.textLink}>{S[lang].sample}  ↗</Text></Pressable><Text style={[styles.eyebrow,{marginTop:22,marginBottom:8}]}>{S[lang].choose}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight:84}} contentContainerStyle={{gap:8,paddingRight:20}}>{KINDS.map(k=><Pressable key={k} onPress={()=>{setKind(k);tick()}} style={[styles.vesselChoice,k===kind&&{borderColor:C.blue,backgroundColor:'#E9F0F6'}]}><Vessel kind={k} size={45}/></Pressable>)}</ScrollView>
   <Animated.View style={[styles.sealLetter,foldStyle]}><Text style={styles.sealLetterText}>{line||S[lang].sampleText}</Text><Text style={styles.signature}>Roy · 2026</Text></Animated.View>
   <View style={{marginTop:'auto',alignItems:'center'}}><Body style={{fontSize:13,marginBottom:10}}>{S[lang].dragSeal} ↑</Body><GestureDetector gesture={wax}><Animated.View style={[styles.wax,waxStyle]}><Text style={styles.waxText}>時</Text></Animated.View></GestureDetector></View></>:<Animated.View style={[{alignItems:'center',justifyContent:'center',flex:1},flyStyle]}><Halo size={280}/><Vessel kind={kind} size={225} lidLift={lid}/></Animated.View>}
  {phase==='sent'&&<Button onPress={()=>{setPhase('write');setLine('');fold.value=1;fly.value=0;lid.value=1}}>{S[lang].again}</Button>}
 </KeyboardAvoidingView>;
}

function AsiaMap({selected,lang,collected}: {selected:number;lang:Lang;collected:Set<number>}) {
 return <Svg width="100%" height="100%" viewBox="0 0 430 330" accessibilityLabel={S[lang].mapTitle}>
  <Rect width="430" height="330" fill="#E9F2F5"/><Path d="M4 13 Q71 2 122 29 L153 49 L192 36 L222 22 L271 37 L309 29 L350 50 L425 35 L430 153 L398 149 L382 123 L352 141 L339 158 L310 171 L281 166 L266 202 L237 201 L222 219 L204 210 L194 241 L178 239 L160 210 L141 201 L125 170 L105 157 L95 135 L68 130 L51 111 L19 103 Z" fill="#E5D8BC" stroke="#C2AC85" strokeWidth="2"/>
  <Path d="M170 177 L199 211 L193 244 L207 278 L197 297 L181 275 L183 244 L164 222 Z" fill="#DBC6A5" stroke="#C2AC85"/><Path d="M300 183 l16 11 -4 20 -12 -6 Z M337 118 l19 -23 12 18 -12 31 -18 10 Z M374 132 l14 -17 12 17 -9 29 -12 10 Z" fill="#DBC6A5" stroke="#C2AC85"/>
  <Path d="M11 245 Q92 228 153 261 M10 286 Q84 267 138 294 M306 255 Q357 234 419 255" stroke="#C7DDE6" strokeWidth="1" fill="none"/>
  {PLACES.map((p,i)=><G key={i}><Circle cx={p.x} cy={p.y} r={selected===i?10:collected.has(i)?6:4} fill={selected===i?C.wax:collected.has(i)?C.brass:C.blue} opacity={selected===i?.18:1}/><Circle cx={p.x} cy={p.y} r={selected===i?5:collected.has(i)?3:2} fill={selected===i?C.wax:C.white}/></G>)}
  <SvgText x="16" y="313" fill="#6F8292" fontSize="11">TIME CAPSULE · ASIA</SvgText>
 </Svg>;
}
function Journey({lang,reduced}: {lang:Lang;reduced:boolean}) {
 const [place,setPlace]=useState(0);const [collected,setCollected]=useState(new Set<number>());const [passport,setPassport]=useState(false);const [ink,setInk]=useState(false);
 const tx=useSharedValue(0),ty=useSharedValue(0),panX=useSharedValue(0),panY=useSharedValue(0),scale=useSharedValue(1),passportY=useSharedValue(520),stamp=useSharedValue(0),pinPulse=useSharedValue(0);
 const pan=Gesture.Pan().onBegin(()=>{panX.value=tx.value;panY.value=ty.value}).onUpdate(e=>{tx.value=panX.value+e.translationX;ty.value=panY.value+e.translationY});
 const pinch=Gesture.Pinch().onUpdate(e=>{scale.value=Math.max(1,Math.min(2.8,e.scale))}).onEnd(()=>{scale.value=withSpring(Math.max(1,Math.min(2.8,scale.value)),spring)});
 const mapStyle=useAnimatedStyle(()=>({transform:[{translateX:tx.value},{translateY:ty.value},{scale:scale.value}]}));
 const passportStyle=useAnimatedStyle(()=>({transform:[{translateY:passportY.value}]}));
 const stampStyle=useAnimatedStyle(()=>({opacity:stamp.value,transform:[{scale:interpolate(stamp.value,[0,1],[2.2,1])},{rotate:'-13deg'}]}));
 const pulseStyle=useAnimatedStyle(()=>({opacity:1-pinPulse.value,transform:[{scale:1+pinPulse.value*2}]}));
 const showPassport=()=>{setPassport(true);setInk(true);setCollected(old=>new Set([...old,place]));impact(Haptics.ImpactFeedbackStyle.Heavy)};
 const arrive=()=>{impact(Haptics.ImpactFeedbackStyle.Light);pinPulse.value=0;pinPulse.value=withRepeat(withTiming(1,{duration:600}),2,false,()=>{passportY.value=reduced?0:withSpring(0,spring);stamp.value=withDelay(450,withSpring(1,{damping:8,stiffness:240}));runOnJS(showPassport)()})};
 return <View style={styles.scene}><Text style={styles.eyebrow}>05 / 06  ·  {S[lang].journey}</Text><Title>{S[lang].mapTitle}</Title><Body style={{textAlign:'center'}}>{S[lang].mapSub}</Body>
  <View style={styles.mapFrame}><GestureDetector gesture={Gesture.Simultaneous(pan,pinch)}><Animated.View style={[{width:'100%',height:'100%'},mapStyle]}><AsiaMap selected={place} lang={lang} collected={collected}/></Animated.View></GestureDetector><Animated.View pointerEvents="none" style={[styles.mapPulse,{left:PLACES[place].x/430*Dimensions.get('window').width*.83-11,top:PLACES[place].y/330*280-11},pulseStyle]}/></View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight:52,marginTop:14}} contentContainerStyle={{gap:8,paddingRight:22}}>{PLACES.map((p,i)=><Pressable key={i} onPress={()=>{setPlace(i);tick();pinPulse.value=0}} style={[styles.placeChip,i===place&&styles.placeChipActive]}><Text style={{color:i===place?C.white:C.blue,fontSize:12}}>{collected.has(i)?'✦  ':''}{p[lang]}</Text></Pressable>)}</ScrollView>
  <Text style={[styles.eyebrow,{marginTop:20}]}>{collected.size} {S[lang].collected}</Text><View style={{marginTop:'auto'}}><Button onPress={arrive}>{S[lang].simulate}  ·  {PLACES[place][lang]}</Button></View>
  {passport&&<View style={styles.scrim}><Animated.View style={[styles.passport,passportStyle]}><Text style={styles.passportHead}>{S[lang].passport}</Text><Text style={styles.passportName}>{PLACES[place][lang]}</Text><Text style={styles.passportDate}>{new Date().toLocaleDateString(lang==='zh'?'zh-TW':'en-US')}</Text><Animated.View style={[styles.stamp,stampStyle]}><Text style={styles.stampText}>✦{ '\n' }{S[lang].stamp}{'\n'}TIME CAPSULE</Text></Animated.View><View style={styles.inkDots}>{ink&&Array.from({length:9},(_,i)=><View key={i} style={{width:2+i%3,height:2+i%3,borderRadius:5,backgroundColor:C.blue,position:'absolute',left:35+(i*37)%220,top:22+(i*47)%110,opacity:.3}}/>)}</View><Button secondary onPress={()=>{passportY.value=withTiming(520,{duration:250},()=>runOnJS(setPassport)(false));stamp.value=0;setInk(false)}}>{S[lang].close}</Button></Animated.View></View>}
 </View>;
}

function Cabinet({lang,reduced}: {lang:Lang;reduced:boolean}) {
 const [picked,setPicked]=useState<VesselKind|null>(null);const tilt=useSharedValue(0),spin=useSharedValue(0),lift=useSharedValue(0);
 useEffect(()=>{if(reduced)return;Accelerometer.setUpdateInterval(50);let sub:ReturnType<typeof Accelerometer.addListener>|undefined;try{sub=Accelerometer.addListener(v=>{tilt.value=withTiming(Math.max(-1,Math.min(1,v.x)),{duration:100})})}catch{}return()=>sub?.remove()},[reduced]);
 const shelfStyle=useAnimatedStyle(()=>({transform:[{perspective:900},{rotateY:`${tilt.value*4}deg`},{translateX:tilt.value*8}]}));
 const sheen=useAnimatedStyle(()=>({transform:[{translateX:tilt.value*70}]}));
 const itemStyle=useAnimatedStyle(()=>({transform:[{translateY:lift.value},{perspective:600},{rotateY:`${spin.value}deg`}]}));
 const spinGesture=Gesture.Pan().onUpdate(e=>{spin.value=e.translationX*.55}).onEnd(()=>{spin.value=withSpring(spin.value,spring)});
 return <View style={styles.scene}><Text style={styles.eyebrow}>06 / 06  ·  {S[lang].cabinet}</Text><Title>{S[lang].cabinetTitle}</Title><Body style={{textAlign:'center'}}>{S[lang].cabinetSub}</Body>
  <Animated.View style={[styles.cabinet,shelfStyle]}><Animated.View style={[styles.sheen,sheen]}/>{[KINDS.slice(0,4),KINDS.slice(4)].map((row,ri)=><View key={ri} style={styles.shelfRow}>{row.map(k=><Pressable key={k} onPress={()=>{setPicked(k);lift.value=withSpring(-25,spring);spin.value=0;impact(Haptics.ImpactFeedbackStyle.Light)}} style={styles.shelfItem}><Vessel kind={k} size={74}/><Text style={styles.shelfLabel}>{label(k,lang)}</Text></Pressable>)}<View style={styles.shelf}/></View>)}</Animated.View>
  <Body style={{textAlign:'center',fontSize:12,marginTop:20}}>{S[lang].tap}</Body>
  {picked&&<View style={styles.scrim}><View style={styles.picked}><Text style={styles.eyebrow}>{picked==='maison'?'No.017 / 300':S[lang].edition}</Text><Title small>{label(picked,lang)}</Title><GestureDetector gesture={spinGesture}><Animated.View style={[{alignSelf:'center',marginVertical:20},itemStyle]}><Halo size={260}/><Vessel kind={picked} size={240}/></Animated.View></GestureDetector><Body style={{textAlign:'center',marginBottom:20}}>{S[lang].spin}</Body><Button secondary onPress={()=>{lift.value=0;setPicked(null)}}>{S[lang].close}</Button></View></View>}
 </View>;
}

export default function App() {
 const [fontsLoaded]=useFonts({NotoSerifTC:NotoSerifTC_400Regular,NotoSerifTCBold:NotoSerifTC_700Bold,NotoSansTC:NotoSansTC_400Regular});
 const insets=useSafeAreaInsets();const [lang,setLang]=useState<Lang>('zh');const [scene,setScene]=useState<Scene>('home');const [kind,setKind]=useState<VesselKind>('dome');const [reduced,setReduced]=useState(false);const [resetKey,setResetKey]=useState(0);
 useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduced);const l=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>l.remove()},[]);
 const navigate=(s:Scene)=>{tick();setScene(s)};const reset=()=>{setScene('home');setKind('dome');setResetKey(k=>k+1);impact(Haptics.ImpactFeedbackStyle.Medium)};
 if(!fontsLoaded)return <View style={{flex:1,backgroundColor:C.paper}}/>;
 return <View style={[styles.root,{paddingTop:insets.top,paddingBottom:Math.max(insets.bottom,8)}]} key={resetKey}>
  <View style={styles.content}>{scene==='home'?<Home lang={lang} setLang={setLang} navigate={navigate} setKind={setKind} reduced={reduced}/>:scene==='waiting'?<Waiting lang={lang} kind={kind} navigate={navigate} reduced={reduced}/>:scene==='opening'?<Opening lang={lang} kind={kind} reduced={reduced} onOpened={()=>{}}/>:scene==='seal'?<Seal lang={lang} kind={kind} setKind={setKind} reduced={reduced}/>:scene==='journey'?<Journey lang={lang} reduced={reduced}/>:<Cabinet lang={lang} reduced={reduced}/>}</View>
  <View style={styles.nav}>{SCENES.map((s,i)=><Pressable key={s} onPress={()=>navigate(s)} style={[styles.navItem,scene===s&&styles.navItemOn]} accessibilityRole="tab" accessibilityState={{selected:scene===s}}><Text style={[styles.navIcon,scene===s&&{color:C.blue}]}>{['⌂','◷','✦','✉','⌖','▤'][i]}</Text><Text numberOfLines={1} style={[styles.navLabel,scene===s&&{color:C.blue,fontWeight:'700'}]}>{S[lang][s]}</Text></Pressable>)}</View>
  <Pressable onPress={reset} style={styles.reset}><Text style={styles.resetText}>↺  {S[lang].reset}</Text></Pressable>
 </View>;
}

const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:C.paper},content:{flex:1,overflow:'hidden'},scene:{flex:1,paddingHorizontal:24,paddingTop:16,paddingBottom:18},title:{fontFamily:serif,fontSize:29,color:C.ink,textAlign:'center',lineHeight:41,marginTop:7,marginBottom:5},body:{fontFamily:sans,fontSize:14,color:C.muted,lineHeight:23},eyebrow:{fontFamily:serif,fontSize:11,color:C.brass,textAlign:'center',letterSpacing:2},button:{minHeight:50,backgroundColor:C.blue,borderRadius:28,alignItems:'center',justifyContent:'center',paddingHorizontal:20},buttonSecondary:{backgroundColor:C.white,borderWidth:1.4,borderColor:C.blue},buttonText:{fontFamily:sans,fontSize:15,color:C.white,fontWeight:'700',textAlign:'center'},
 homeHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:24,paddingTop:20},brand:{fontFamily:serif,fontSize:24,color:C.ink,fontWeight:'700'},kicker:{fontFamily:sans,fontSize:11,color:C.muted,marginTop:2},lang:{borderWidth:1,borderColor:C.line,borderRadius:16,paddingHorizontal:12,paddingVertical:6,backgroundColor:C.white},segment:{flexDirection:'row',alignSelf:'center',marginTop:18,borderWidth:1,borderColor:C.blue,borderRadius:28,padding:3},segmentActive:{backgroundColor:C.blue,paddingHorizontal:24,paddingVertical:7,borderRadius:24},segmentOther:{paddingHorizontal:24,paddingVertical:7},segmentActiveText:{fontFamily:serif,color:C.white,fontSize:15},segmentText:{fontFamily:serif,color:C.blue,fontSize:15},rail:{flex:1,position:'relative',overflow:'hidden',marginTop:12},parallax:{position:'absolute',width:'140%',height:'100%',left:-40},parallaxCircle:{position:'absolute',left:10,top:35,width:220,height:220,borderRadius:150,backgroundColor:'#E4EEF6',opacity:.65},homeCard:{position:'absolute',top:'4%',height:'90%',maxHeight:440,minHeight:345,backgroundColor:C.white,borderWidth:1.2,borderColor:'#728197',borderRadius:18,paddingTop:18,paddingHorizontal:16,shadowColor:C.ink,shadowOpacity:.1,shadowRadius:14,shadowOffset:{width:0,height:10},elevation:5},cardTop:{fontFamily:serif,color:C.brass,fontSize:10,letterSpacing:1.5,alignSelf:'flex-end'},cardName:{fontFamily:serif,fontSize:17,color:C.ink,textAlign:'center'},cardRule:{flexDirection:'row',justifyContent:'center',alignItems:'baseline',gap:8,marginTop:10},cardNumber:{fontFamily:'NotoSerifTCBold',fontSize:38,color:C.blue},cardRuleText:{fontFamily:serif,fontSize:16,color:C.blue},cardPlace:{fontFamily:sans,fontSize:12,color:C.muted,marginTop:8},cardFoot:{width:'100%',borderTopWidth:1,borderColor:C.line,marginTop:'auto',paddingVertical:12,flexDirection:'row',justifyContent:'space-between'},cardFootText:{fontFamily:sans,fontSize:10,color:C.muted},dots:{flexDirection:'row',alignSelf:'center',gap:6,marginVertical:10},dot:{width:6,height:6,borderRadius:4,backgroundColor:C.line},dotOn:{width:20,backgroundColor:C.blue},
 waitStage:{flex:1,minHeight:250,maxHeight:330,alignItems:'center',justifyContent:'center'},counter:{alignItems:'center',marginTop:4},counterLabel:{fontFamily:sans,fontSize:13,color:C.muted},counterNumber:{fontFamily:'NotoSerifTCBold',fontSize:47,color:C.blue,marginVertical:-2},progressTrack:{height:5,width:190,borderRadius:5,backgroundColor:C.line,marginTop:12,overflow:'hidden'},progressFill:{width:'72%',height:'100%',backgroundColor:C.brass,borderRadius:5},hint:{minHeight:82,alignItems:'center',justifyContent:'center'},hand:{fontFamily:serif,fontSize:16,color:C.plum,textAlign:'center',lineHeight:27},
 openStage:{height:290,alignItems:'center',justifyContent:'center',marginTop:10},burst:{position:'absolute',width:300,height:300,alignSelf:'center'},hold:{width:100,height:100,borderRadius:50,backgroundColor:C.blue,alignItems:'center',justifyContent:'center',marginBottom:3,shadowColor:C.blue,shadowOpacity:.4,shadowRadius:20,elevation:6},holdRing:{position:'absolute',width:120,height:120,borderRadius:60,borderWidth:8,borderColor:C.brass},holdText:{fontFamily:serif,color:C.white,fontSize:14},letter:{backgroundColor:'#FFFDF7',borderWidth:1,borderColor:'#D7C5A2',borderRadius:6,padding:24,marginTop:5,minHeight:220,flex:1,maxHeight:360,shadowColor:C.ink,shadowOpacity:.1,shadowRadius:16,elevation:3},letterText:{fontFamily:serif,fontSize:15,color:C.ink,lineHeight:29},pullTab:{fontFamily:sans,color:C.blue,fontSize:12,textAlign:'center',marginTop:'auto'},record:{alignSelf:'flex-end',width:135,minHeight:83,borderWidth:2,borderColor:C.wax,borderRadius:4,padding:8,marginTop:10,justifyContent:'center'},recordText:{fontFamily:serif,color:C.wax,fontSize:12,lineHeight:20,textAlign:'center'},
 input:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:12,padding:14,minHeight:80,marginTop:16,fontFamily:serif,color:C.ink,fontSize:15,textAlignVertical:'top'},textLink:{fontFamily:sans,color:C.blue,fontSize:13,textAlign:'right',marginTop:8},vesselChoice:{width:72,height:72,borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},sealLetter:{backgroundColor:'#FFFDF7',minHeight:126,borderWidth:1,borderColor:'#D9C9A9',borderRadius:5,padding:20,marginTop:20},sealLetterText:{fontFamily:serif,color:C.ink,fontSize:17,lineHeight:28},signature:{fontFamily:serif,color:C.muted,textAlign:'right',marginTop:18,fontSize:11},wax:{width:72,height:72,borderRadius:36,backgroundColor:C.wax,borderWidth:4,borderColor:'#7B2438',alignItems:'center',justifyContent:'center',shadowColor:C.wax,shadowOpacity:.4,shadowRadius:10,elevation:5},waxText:{fontFamily:serif,color:'#F6D9D8',fontSize:29},
 mapFrame:{height:290,borderRadius:16,borderWidth:1,borderColor:C.line,overflow:'hidden',backgroundColor:'#E9F2F5',marginTop:20},mapPulse:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:C.wax,position:'absolute'},placeChip:{height:36,borderRadius:18,paddingHorizontal:13,justifyContent:'center',backgroundColor:C.white,borderWidth:1,borderColor:C.line},placeChipActive:{backgroundColor:C.blue,borderColor:C.blue},scrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#16263F99',justifyContent:'flex-end',zIndex:50},passport:{backgroundColor:'#FFFDF7',borderTopLeftRadius:26,borderTopRightRadius:26,padding:26,minHeight:425,borderTopWidth:5,borderColor:C.brass},passportHead:{fontFamily:serif,color:C.blue,fontSize:24,textAlign:'center',letterSpacing:3},passportName:{fontFamily:serif,color:C.ink,fontSize:20,marginTop:22},passportDate:{fontFamily:sans,color:C.muted,fontSize:12,marginTop:8},stamp:{width:125,height:125,borderWidth:4,borderColor:C.blue,borderRadius:65,alignItems:'center',justifyContent:'center',alignSelf:'center',marginVertical:20},stampText:{fontFamily:serif,color:C.blue,textAlign:'center',fontSize:15,lineHeight:25},inkDots:{height:16},
 cabinet:{flex:1,marginTop:25,backgroundColor:'#EDE6DD',borderRadius:14,borderWidth:5,borderColor:'#A87954',paddingHorizontal:8,justifyContent:'space-around',overflow:'hidden'},sheen:{position:'absolute',left:'30%',width:90,height:'100%',backgroundColor:'#FFFFFF33',transform:[{skewX:'-10deg'}]},shelfRow:{height:160,flexDirection:'row',justifyContent:'space-around',alignItems:'flex-end',paddingBottom:18},shelfItem:{width:'24%',alignItems:'center',justifyContent:'flex-end'},shelfLabel:{fontFamily:serif,color:C.plum,fontSize:10,textAlign:'center',height:25},shelf:{position:'absolute',bottom:0,left:-8,right:-8,height:16,backgroundColor:C.wood,borderBottomWidth:4,borderColor:'#714B37'},picked:{backgroundColor:C.paper,borderTopLeftRadius:25,borderTopRightRadius:25,padding:25,minHeight:460},
 nav:{height:65,flexDirection:'row',backgroundColor:C.white,borderTopWidth:1,borderColor:C.line,paddingHorizontal:4},navItem:{flex:1,alignItems:'center',justifyContent:'center',paddingTop:3},navItemOn:{backgroundColor:'#EFF5F9',borderRadius:12},navIcon:{fontSize:22,color:C.muted,height:29},navLabel:{fontFamily:sans,fontSize:10,color:C.muted},reset:{alignSelf:'center',paddingVertical:3},resetText:{fontFamily:sans,fontSize:10,color:C.muted}
});
