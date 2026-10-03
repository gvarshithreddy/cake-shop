import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {io} from 'socket.io-client';
import {apply,newDoc} from '../shared/apply.js';
import {sound} from './sound.js';
const $=(s:string)=>document.querySelector(s) as HTMLElement;
const V3=THREE.Vector3,COL=['#2fa86a','#ff6fa5'],GUIDES=['Round','Oval','Heart','Flower','Star','Freehand'],DECO=['🌸','🍓','🍒','🫐','🍫','💕','✨','🎀'];
const sock=io();
let doc:any=newDoc(),me=0,users:any[]=[],name='',room='',phase='lobby',ready=false,shown=-1,sel='🌸',guide='Heart',gopen=false,lastHtml='';
function beep(f=520,d=.08,v=.04,ty:any='sine'){sound.click()}
$('#mute').onclick=()=>{const m=sound.toggleMute();$('#mute').textContent=m?'🔇':'🔊'};

const STG:any[]=[
{i:'🍰',t:"LET'S MAKE\nTHE CAKE!",s:'Use your hands to draw the cake shape.',how:['Press and drag to draw the outline.','Circle back to where you started.','You can both draw!'],fin:'the outline closes into a shape.',ok:'✨ Shape complete!',cam:[0,9,.01,0,0,0]},
{i:'📏',t:'GIVE IT\nSOME BODY.',s:'One of you makes it taller.\nThe other makes it wider.',how:['Press on the canvas and drag.','Taller: drag up/down. Wider: drag left/right.','Squish it until it feels right.'],fin:'you each changed your part.',ok:'✨ Looks cakey!',cam:[5,4.5,6.5,0,.7,0]},
{i:'🎂',t:'TIME FOR\nSOME LAYERS!',s:"Build it a little crooked. That's the charm.",how:['Grab the cake and pull up (or tap it).','A new layer pops out.'],fin:'there is one extra layer.',ok:'✨ Tall cake!',cam:[5.5,3,7,0,1.2,0]},
{i:'🍓',t:'MAKE IT\nEXTRA YUMMY!',s:'Squeeze some filling between the layers.',how:['Grab the piping bag.','Press and drag along the cake.','Too much? Overflow is cute.'],fin:'you piped one line of filling.',ok:'✨ Yum!',cam:[5,3,7,0,1.2,0]},
{i:'🍦',t:'COVER THE\nWHOLE THING!',s:'Spread the frosting with your hands.',how:['Grab the frosting tool.','Drag around the cake.','Make it deliciously messy.'],fin:"you've made a frosting stroke.",ok:'✨ So fluffy!',cam:[3.5,7,5.5,0,1,0]},
{i:'🌸',t:'MAKE IT\nYOURS!',s:'Put things wherever you want.',how:['Pick a decoration below.','Tap the cake to place it.'],fin:'you placed one decoration.',ok:'✨ Pretty!',cam:[4.5,5,6.5,0,1,0]},
{i:'✍️',t:'WRITE SOMETHING\nSWEET. 💕',s:'Use your frosting like a pen.',how:['Press and write on the top.','No typing - your own handwriting!','Undo removes a whole stroke.'],fin:'you wrote one stroke.',ok:'✨ So sweet!',cam:[0,7.5,3,0,1,0]},
{i:'🕯️',t:'ONE LAST\nTHING...',s:'Put the candles wherever you want.',how:['Tap the top of the cake.','Crooked is okay.'],fin:'you placed one candle.',ok:'✨ Perfect!',cam:[4,4.5,7,0,1,0]},
{i:'✨',t:'READY?\nMAKE A WISH.',s:'',how:[],fin:'',cam:[3,2.8,6.5,0,1,0]},
{i:'💨',t:'BLOW THEM OUT\nTOGETHER!',s:'👋 SHAKE YOUR POINTER FAST\nto make the candles blow!',how:['Shake your pointer back and forth, fast.','Push the meter past the line.','Both of you together is strongest!'],fin:'every candle is out.',cam:[0,2.8,7.5,0,1,0]},
{i:'✨',t:'YOU MADE THIS\nTOGETHER.',s:'',how:[],fin:'',cam:[0,3,7,0,1,0]}];
const DONE=[()=>!!doc.drawing,()=>doc.base.hs&&doc.base.ws,()=>doc.layers.length>0,()=>doc.fill.length>0,()=>doc.frost.length>0,()=>doc.deco.length>0,()=>doc.write.length>0,()=>doc.candles.length>0,()=>doc.lit,()=>doc.candles.every((_:any,i:number)=>doc.out.includes(i)),()=>true];

// ---------- three ----------
const cv=$('#c') as HTMLCanvasElement,R=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('#fff4e6');
const cam=new THREE.PerspectiveCamera(40,1,.1,100);cam.position.set(0,9,.01);const look=new V3();
const hemi=new THREE.HemisphereLight('#fff','#f3c9b8',1.1),sun=new THREE.DirectionalLight('#fff',1.4);sun.position.set(4,8,5);
const glow=new THREE.PointLight('#ffb55a',0,12);scene.add(hemi,sun,glow);
const G=new THREE.Group();scene.add(G);

const guideG=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#4a2740',size:.07}));scene.add(guideG);
const outline=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#4a2740'}));outline.visible=false;scene.add(outline);
const mkLine=(c:string)=>{const l=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:c}));l.frustumCulled=false;scene.add(l);return l};
const trailL=[mkLine(COL[0]),mkLine(COL[1])],trails:number[][][]=[[],[]],prev=mkLine('#e0345a');
const setLine=(l:any,p:number[][],y=.03)=>l.geometry.setFromPoints(p.map(q=>new V3(q[0],q.length>2?q[1]:y,q[q.length-1])));
function resize(){
 R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();
}addEventListener('resize',resize);resize();

function guidePts(k:string){const o:number[][]=[],N=90;
 if(k==='Star'){const v=[];for(let i=0;i<10;i++){const a=i/10*6.283-1.57,r=i%2?1.1:2.5;v.push([Math.cos(a)*r,Math.sin(a)*r])}
  for(let i=0;i<10;i++)for(let j=0;j<9;j++){const a=v[i],b=v[(i+1)%10];o.push([a[0]+(b[0]-a[0])*j/9,a[1]+(b[1]-a[1])*j/9])}return o}
 for(let i=0;i<N;i++){const t=i/N*6.283;
  if(k==='Round')o.push([2.2*Math.cos(t),2.2*Math.sin(t)]);
  if(k==='Oval')o.push([2.7*Math.cos(t),1.8*Math.sin(t)]);
  if(k==='Flower'){const r=1.7+.6*Math.cos(5*t);o.push([r*Math.cos(t),r*Math.sin(t)])}
  if(k==='Heart')o.push([2.3*Math.pow(Math.sin(t),3),-2.3*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16+.1]);}
 return o}
function setGuide(){guideG.geometry.setFromPoints(guidePts(guide).map(p=>new V3(p[0],.02,p[1])));guideG.visible=doc.stage===0&&!doc.drawing&&guide!=='Freehand'}

// ---------- user drawing -> mesh ----------
const chaikin=(p:number[][],n=2)=>{for(let k=0;k<n;k++){const q:number[][]=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}p=q}return p};
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const plen=(p:number[][])=>p.reduce((s,q,i)=>i?s+dist(p[i-1],q):0,0);
function looksClosed(p:number[][]){if(p.length<12)return false;const L=plen(p),xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
 return L>4&&Math.max(...xs)-Math.min(...xs)>1.2&&Math.max(...zs)-Math.min(...zs)>1.2&&dist(p[0],p[p.length-1])<Math.max(.45,L*.08)}
function finishDrawing(raw:number[][]){const p=chaikin(raw,2),xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,s=2.3/Math.max((Math.max(...xs)-Math.min(...xs))/2,(Math.max(...zs)-Math.min(...zs))/2);
 act({t:'drawing',v:p.map(q=>[+((q[0]-cx)*s).toFixed(3),+((q[1]-cz)*s).toFixed(3)])});sound.shapeComplete()}
let baseGeo:any=null,src:any=null;
function makeGeo(pts:number[][]){let g:any=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1]))),{depth:1,bevelEnabled:true,bevelThickness:.07,bevelSize:.07,bevelSegments:4,curveSegments:1});
 g.rotateX(-Math.PI/2);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g,1e-4);g.computeVertexNormals();return g}

// ---------- render document ----------
let topY=1,riseStart=0,flames:any[]=[];const emoTex:any={},mats:any={};
const ease=(x:number)=>1-Math.pow(1-x,3);
const blobG=new THREE.SphereGeometry(1,10,7),frostMat=new THREE.MeshPhysicalMaterial({color:'#fff6f0',roughness:.3,clearcoat:1,clearcoatRoughness:.25});
function frostMesh(list:number[][][],ns?:any[]){const N=list.reduce((a,p)=>a+p.length,0),im=new THREE.InstancedMesh(blobG,frostMat,Math.max(1,N)),M=new THREE.Matrix4(),q=new THREE.Quaternion(),UP=new V3(0,1,0);let n=0;
 for(const pts of list)pts.forEach((p,j)=>{const nv=new V3(p[3],p[4],p[5]),r=.26+.07*Math.sin(j*1.7+p[0]*9);q.setFromUnitVectors(UP,nv);M.compose(new V3(p[0],p[1],p[2]).addScaledVector(nv,r*.1),q,new V3(r,r*.32,r*(1+.2*Math.sin(j*2.3))));im.setMatrixAt(n++,M);if(ns)ns.push(nv)});
 im.count=n;im.frustumCulled=false;return im}
const frostNs:any[]=[];let pvm:any=null;
const rise=()=>Math.min(1,(performance.now()-riseStart)/2400);
function emoSprite(e:string){if(!emoTex[e]){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;x.font='100px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,64,70);emoTex[e]=new THREE.CanvasTexture(c)}return new THREE.Sprite(new THREE.SpriteMaterial({map:emoTex[e]}))}
function tube(s:any,top=false){const c=new THREE.CatmullRomCurve3(s.pts.map((p:number[])=>new V3(p[0],p[1],p[2])));
 const key=s.c+top;mats[key]=mats[key]||new THREE.MeshPhysicalMaterial({color:s.c,roughness:.35,clearcoat:1,clearcoatRoughness:.2,transparent:top});
 const m=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(8,s.pts.length*2),s.r,8,false),mats[key]);if(top)m.renderOrder=10;return m}
function rebuild(){
 while(G.children.length){const o:any=G.children.pop();o.traverse((c:any)=>{if(c.geometry&&!c.userData.keep)c.geometry.dispose()})}
 flames=[];outline.visible=!!doc.drawing;setGuide();
 if(!doc.drawing)return;
 if(src!==doc.drawing){src=doc.drawing;baseGeo=makeGeo(doc.drawing);setLine(outline,doc.drawing.map((p:number[])=>[p[0],.03,p[1]]),0);riseStart=doc.stage>0?-1e9:performance.now()}
 const {h,w}=doc.base,SP=['#f3d9a8','#f7c6d0','#e9d3f5'];
 const mk=(c:string,sy:number,sx:number,x:number,y:number,z:number,ry=0,rz=0)=>{const m=new THREE.Mesh(baseGeo,new THREE.MeshStandardMaterial({color:c,roughness:.9}));m.scale.set(sx,sy,sx);m.position.set(x,y,z);m.rotation.set(0,ry,rz);m.userData={hit:1,keep:1};G.add(m);return m};
 let y=h*ease(rise());mk(SP[0],y,w,0,0,0);
 doc.layers.forEach((L:any,i:number)=>{const lh=h*.6;mk(SP[(i+1)%3],lh,w*L.s,L.dx,y,L.dz,L.rot,L.tilt);y+=lh});topY=y;
 for(const s of doc.fill)G.add(tube(s));
 frostNs.length=0;if(doc.frost.length){const im=frostMesh(doc.frost.map((s:any)=>s.pts),frostNs);im.userData={hit:1,keep:1};G.add(im)}
 for(const s of doc.write)G.add(tube(s,true));
 G.updateMatrixWorld(true);const tops=G.children.filter((o:any)=>o.userData.hit),dn=new THREE.Raycaster(),topAt=(x:number,z:number,y:number)=>{dn.set(new V3(x,30,z),new V3(0,-1,0));const h=dn.intersectObjects(tops,false)[0];return h?h.point.y:y};
 for(const d of doc.deco){const s=emoSprite(d.e),n=d.n||[0,1,0],top=n[1]>.5;s.material.depthWrite=false;s.renderOrder=5;s.position.set(d.p[0]+(top?0:n[0]*.25*d.s),(top?topAt(d.p[0],d.p[2],d.p[1]):d.p[1])+.2*d.s,d.p[2]+(top?0:n[2]*.25*d.s));s.scale.setScalar(.45*d.s);s.material.rotation=d.rot;G.add(s)}
 doc.candles.forEach((c:any,i:number)=>{const g=new THREE.Group();g.position.set(c.p[0],topAt(c.p[0],c.p[2],c.p[1]),c.p[2]);g.rotation.set(c.tilt[0],0,c.tilt[1]);
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.5,12),new THREE.MeshStandardMaterial({color:i%2?'#fff':'#ff9fc0'}));b.position.y=.25;g.add(b);
  const fg=new THREE.ConeGeometry(.065,.24,10);fg.translate(0,.12,0);const f=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({color:'#ffb12e'}));f.position.y=.5;g.add(f);G.add(g);flames.push({m:f,i})})}

// ---------- state / net ----------
const T:any={};const at=(k:string,ms:number,f:()=>void)=>{if(!T[k])T[k]=setTimeout(f,ms)};
const authIdx=()=>users.findIndex(u=>u.on),isAuth=()=>authIdx()===me;
function handle(m:any){apply(doc,m);if(m.t==='reset'){for(const k in T)delete T[k];src=null;blow.length=0;smoked.clear();doneShown.clear();shown=-1}onDoc()}
function act(m:any){handle(m);sock.emit('act',m)}
const doneShown=new Set();
function onDoc(){rebuild();if(doc.stage!==shown)showStage(doc.stage);updateTools()}
sock.on('act',handle);
sock.on('state',(d:any)=>{doc=d;src=null;onDoc()});
sock.on('users',(u:any[])=>{users=u;lobbyCheck();banner()});
sock.on('cur',(m:any)=>{if(phase!=='game')return;const c=rc(m.s);const nx=m.x*innerWidth,ny=m.y*innerHeight,now=performance.now();
 const v=Math.hypot(nx-c.tx,ny-c.ty)/Math.max(8,now-c.t)*1000;tg[m.s]=Math.max(tg[m.s],Math.min(1,v/1800));c.t=now;c.tx=nx;c.ty=ny;
 c.el.className='cur'+(m.d?' down':'');c.el.firstElementChild!.textContent=curE(doc.stage,m.s,m.d);
 if(doc.stage===0&&!doc.drawing){if(m.d&&m.g){trails[m.s].push(m.g);setLine(trailL[m.s],trails[m.s].map(p=>[p[0],.03,p[1]]),0)}else{trails[m.s]=[];setLine(trailL[m.s],[])}}});
sock.on('connect',()=>{if(room&&name)sock.emit('join',{room,name,create:false},(r:any)=>{if(r.slot!==undefined){me=r.slot;users=r.users;if(phase==='game'){doc=r.doc;src=null;onDoc()}showChatToggle();initChatHistory(r.chat);banner()}})});
sock.on('disconnect',()=>banner());
function banner(){const b=$('#banner');const bad=phase==='game'&&(users.length<2||users.some(u=>!u.on));
 b.style.display=bad||(phase==='game'&&!sock.connected)?'block':'none';b.textContent=sock.connected?'💕 Your baking buddy wandered off... reconnecting!':'🌸 Lost connection... reconnecting!'}

// ---------- lobby ----------
const rp=new URLSearchParams(location.search).get('r');
$('#lb').innerHTML=rp?'<button id="join">Join Room</button>':'<button id="create">Create Room</button><div style="margin:8px">or</div><input id="code" placeholder="Room code"><br><br><button id="join">Join Room</button>';
function go(create:boolean){name=($('#nm') as HTMLInputElement).value.trim()||'Baker';room=rp||(create?Math.random().toString(36).slice(2,8):($('#code') as HTMLInputElement).value.trim());
 sock.emit('join',{room,name,create},(r:any)=>{if(r.error){$('#lm').textContent=r.error;room='';return}
  me=r.slot;users=r.users;doc=r.doc;phase='wait';showChatToggle();initChatHistory(r.chat);
   if(create){const link=`${location.origin}/?r=${room}`;$('#lb').innerHTML='';$('#lm').innerHTML=`💕 Your cake room is ready!<br>Share this link with your person.<br><br><button id="cp">Copy Invite Link</button><br><br>🌸 Waiting for your baking buddy...`;
    $('#cp').onclick=()=>{navigator.clipboard?.writeText(link);$('#cp').textContent='Copied! 💕';sound.click()}}
   else{$('#lb').innerHTML='';$('#lm').textContent='🌸 Joining...'}lobbyCheck()})}
$('#lb').onclick=(e:any)=>{if(e.target.id==='create')go(true);if(e.target.id==='join')go(false)};
function lobbyCheck(){if(phase!=='wait'||users.length<2||!users.every(u=>u.on))return;phase='intro';document.body.classList.add('game');sound.join();sound.setBgmMode('baking');
 $('#lb').innerHTML='';$('#lm').innerHTML='<div style="font-size:30px">💕 You\'re both here.</div>';
 setTimeout(()=>{$('#lm').innerHTML='<div style="font-size:30px">🍰 Let\'s make a cake!</div>';$('#lobby').style.opacity='0'},1700);
 setTimeout(()=>{$('#lobby').style.display='none';phase='game';mineEl.style.display='block';rebuild();showStage(doc.stage);updateTools();banner()},2800)}

// ---------- stage UI ----------
const hero=$('#hero'),how=$('#how'),tools=$('#tools');
function showStage(n:number){shown=n;ready=false;$('#camc').style.display=n===0?'none':'grid';const S=STG[n];how.classList.remove('show');
 if(n===8)sound.setBgmMode('wish');else if(n===10)sound.gameEnd();else sound.setBgmMode('baking');
 const sub=n===1?`${users[0]?.name} → ↕️ HEIGHT\n${users[1]?.name} → ↔️ WIDTH\n${me===0?'Your job: HEIGHT':'Your job: WIDTH'}`:S.s;
 hero.className='';hero.innerHTML=`<div class="i">${S.i}</div><h1>${S.t}</h1><p>${sub}</p>`;
 const begin=()=>{if(ready||shown!==n)return;ready=true;hero.className='min';sound.click();setCur(false);
  if(S.how.length){how.innerHTML=`<b>HOW TO DO THIS 💕</b><ol>${S.how.map((h:string)=>`<li>${h}</li>`).join('')}</ol><i>Finish when: ${S.fin}</i><br><small>🎥 Look around (just you): right-drag, scroll, or the buttons.</small>`;how.classList.add('show')}else how.classList.remove('show');updateTools()};
 hero.onclick=begin;if(n===8||n===10)setTimeout(begin,n===8?3000:4000);
 if(n===10){$('#how').innerHTML='';at('names',4200,()=>{const t=$('#toast');t.innerHTML=`${users[0].name} &amp; ${users[1].name} 💕`;t.classList.add('show')})}
 setCur(false)}
function updateTools(){const s=doc.stage;let h='';
 if(!ready&&s!==10){tools.style.visibility='hidden'}else tools.style.visibility='visible';
 if(s===0&&!doc.drawing)h=`<button class="chip" id="gb">Drawing guide: ${guide} ▾</button>`+(gopen?GUIDES.map(g=>`<button class="chip ${g===guide?'on':''}" data-g="${g}">${g}</button>`).join(''):'');
 if(s===5)h=DECO.map(e=>`<button class="chip e ${e===sel?'on':''}" data-e="${e}">${e}</button>`).join('');
 if([3,4,6].includes(s))h+='<button class="chip" id="undo">↶ Undo</button>';
 if(s>=1&&s<=7&&DONE[s]()){h+='<button class="chip go" id="next">Continue →</button>';if(!doneShown.has(s)){doneShown.add(s);toast(STG[s].ok);sound.stepSuccess()}}
 if(s===0&&doc.drawing&&!doneShown.has(0)){doneShown.add(0);toast(STG[0].ok);sound.stepSuccess()}
 if(s===10)h='<button class="chip go" id="save">💕 Save Our Cake</button><button class="chip" id="again">Bake Again</button>';
 if(h!==lastHtml){lastHtml=h;tools.innerHTML=h}}
tools.onclick=(e:any)=>{const t=e.target as HTMLElement;sound.click();
 if(t.id==='gb'){gopen=!gopen;lastHtml='';updateTools()}
 if(t.dataset.g){guide=t.dataset.g;gopen=false;lastHtml='';setGuide();updateTools()}
 if(t.dataset.e){sel=t.dataset.e;lastHtml='';updateTools()}
 if(t.id==='undo'){const k=['','','','fill','frost','','write'][doc.stage];if(doc[k].length){act({t:'undo',k});sound.undo()}}
 if(t.id==='next'){act({t:'stage',v:doc.stage+1});sound.stepSuccess()}
 if(t.id==='again'){$('#toast').classList.remove('show');act({t:'reset'});sound.setBgmMode('baking')}
 if(t.id==='save'){sound.stepSuccess();R.render(scene,cam);cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b!);a.download='our-cake.png';a.click()})}};
function toast(t:string){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>{if(doc.stage<10)e.classList.remove('show')},1800)}
setInterval(()=>{if(phase!=='game')return;const s=doc.stage;
 if(s===0&&doc.drawing)at('a0',3200,()=>act({t:'stage',v:1}));
 if(s===8){if(!doc.lit&&isAuth())at('lit',3500,()=>{act({t:'lit'});sound.candleLit()});if(doc.lit)at('a8',3200,()=>act({t:'stage',v:9}))}
 if(s===9&&DONE[9]())at('a9',1800,()=>act({t:'stage',v:10}))},300);
setInterval(()=>{if(doc.stage!==10&&Math.random()<.4)return;const e=document.createElement('span');e.className='fl';e.textContent=['🌸','💕','✨'][Math.random()*3|0];e.style.left=Math.random()*100+'vw';document.body.appendChild(e);setTimeout(()=>e.remove(),9000)},600);

// ---------- cursors ----------
const mineEl=$('#mine'),rcs=$('#rcs');let mx=0,my=0,tx=0,ty=0,down=false;
const curE=(s:number,slot:number,d:boolean)=>s===1?(slot?'↔️':'↕️'):[0,2,5,7].includes(s)?(d?'🤏':'🖐️'):({3:'🧁',4:'🍦',6:'✍️',9:'💨'} as any)[s]||'🖐️';
function setCur(d:boolean){mineEl.className='cur'+(d?' down':'');mineEl.firstElementChild!.textContent=curE(doc.stage,me,d)}
const rcm:any={};function rc(s:number){if(!rcm[s]){const el=document.createElement('div');el.className='cur';el.innerHTML=`<span>🖐️</span><i style="background:${COL[s]}">${users[s]?.name||''}</i>`;rcs.appendChild(el);rcm[s]={el,x:0,y:0,tx:0,ty:0,t:0}}return rcm[s]}

// ---------- chat ----------
const chatToggle=$('#chat-toggle'),chatPanel=$('#chat-panel'),chatMsgs=$('#chat-msgs'),chatBadge=$('#chat-badge');
const chatIn=$('#chat-in') as HTMLInputElement,chatForm=$('#chat-form') as HTMLFormElement;
let chatOpen=false,unread=0;
function showChatToggle(){if(room)chatToggle.style.display='block'}
function openChat(open:boolean){
 chatOpen=open;
 if(chatOpen){
  chatPanel.classList.remove('hidden');unread=0;chatBadge.style.display='none';chatBadge.textContent='0';
  setTimeout(()=>chatIn.focus(),50);
 }else chatPanel.classList.add('hidden');
}
chatToggle.onclick=()=>{sound.click();openChat(!chatOpen)};
$('#chat-close').onclick=()=>{sound.click();openChat(false)};
function sendChat(text:string){const clean=text.trim();if(!clean||!room)return;sock.emit('chat',clean);sound.click()}
chatForm.onsubmit=(e)=>{e.preventDefault();sendChat(chatIn.value);chatIn.value=''};
$('#chat-quick').onclick=(e:any)=>{const t=e.target.closest('.chip-sm');if(t?.dataset.m){sendChat(t.dataset.m);sound.click()}};
['pointerdown','pointerup','pointermove','wheel','touchstart','touchend','touchmove','click'].forEach(evt=>{
 chatPanel.addEventListener(evt,(e)=>e.stopPropagation(),{passive:true});
});
function showCursorBubble(s:number,text:string){
 const target=s===me?mineEl:rc(s)?.el;if(!target)return;
 const old=target.querySelector('.chat-cur-bubble');if(old)old.remove();
 const b=document.createElement('div');b.className='chat-cur-bubble';b.textContent=text;target.appendChild(b);
 setTimeout(()=>b.remove(),3500);
}
function escapeHtml(s:string){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function addChatMsg(m:{sender:number,name:string,text:string,time:number},isHist=false){
 const isMe=m.sender===me;const div=document.createElement('div');div.className=`msg ${isMe?'me':'peer'}`;
 div.innerHTML=`<span class="msg-author" style="color:${COL[m.sender]||'var(--ink)'}">${m.name}</span><div class="msg-bubble">${escapeHtml(m.text)}</div>`;
 chatMsgs.appendChild(div);chatMsgs.scrollTop=chatMsgs.scrollHeight;
 if(!isHist){
  showCursorBubble(m.sender,m.text);
  if(!chatOpen){unread++;chatBadge.textContent=String(unread);chatBadge.style.display='block';sound.chatChime()}
 }
}
function initChatHistory(list:any[]){if(list&&list.length){chatMsgs.innerHTML='';list.forEach((m:any)=>addChatMsg(m,true))}}
sock.on('chat',(m:any)=>addChatMsg(m));

// ---------- Hand Cream Interaction & Lock ----------
const creamFx=$('#cream-fx')!;
const CREAM_TARGET=20, CREAM_PROXIMITY=48, CREAM_TIMEOUT=1800, CREAM_FINALE=3600;
let creamClicks=0,creamLock=false,isPartnerLocked=false,creamLockX=0,creamLockY=0,creamTimeoutTimer:any=null;
let creamFinishing=false;

function spawnWaterDrop(cx:number,cy:number,count:number,burst=false){
 const drop=document.createElement('div');drop.className=burst?'cream-drop burst':'cream-drop';
 const p=Math.min(1,count/CREAM_TARGET);
 const size=(burst?8:5)+(burst?Math.random()*9:p*7+Math.random()*5);
 drop.style.width=`${size}px`;drop.style.height=`${size*1.45}px`;

 // Start just below the hand and fall all the way to the bottom of the viewport.
 const startY=cy+30;
 const angle=Math.random()*Math.PI*2;
 const spread=burst?12+p*34:4+p*20;
 drop.style.left=`${cx+Math.cos(angle)*spread}px`;
 drop.style.top=`${startY+Math.sin(angle)*Math.min(spread*.25,8)}px`;
 drop.style.setProperty('--dx',`${(Math.random()-.5)*(burst?150:55)}px`);
 drop.style.setProperty('--fall',`${Math.max(80,innerHeight-startY+18)}px`);
 drop.style.setProperty('--dur',`${burst?.9+Math.random()*.35:1.5+Math.random()*.7}s`);
 drop.style.setProperty('--rot',`${(Math.random()-.5)*70}deg`);
 creamFx.appendChild(drop);
 setTimeout(()=>drop.remove(),burst?1800:2800);
}

function spawnWaterDropBurst(cx:number,cy:number){
 // Clear the ordinary falling drops, then launch a true radial projectile burst.
 // Every burst drop gets an initial velocity in its own direction, while gravity
 // continuously accelerates it downward. So upward/sideways drops arc through
 // the air and eventually fall, while downward drops accelerate immediately.
 creamFx.querySelectorAll('.cream-drop:not(.burst)').forEach(el=>el.remove());
 const originY=cy+30;
 const particles:{el:HTMLElement,vx:number,vy:number,x:number,y:number,rot:number,spin:number,t0:number}[]=[];
 const start=performance.now();
 for(let i=0;i<40;i++){
  const drop=document.createElement('div');
  drop.className='cream-drop burst';
  drop.style.animation='none';
  const size=6+Math.random()*8;
  drop.style.width=`${size}px`;
  drop.style.height=`${size*1.45}px`;
  drop.style.left=`${cx}px`;
  drop.style.top=`${originY}px`;
  drop.style.opacity='1';
  const angle=Math.random()*Math.PI*2;
  const speed=230+Math.random()*260;
  const gravity=760+Math.random()*260;
  const spin=(Math.random()-.5)*520;
  creamFx.appendChild(drop);
  particles.push({
   el:drop,
   vx:Math.cos(angle)*speed,
   vy:Math.sin(angle)*speed,
   x:0,y:0,
   rot:Math.random()*360,
   spin,
   t0:start
  });
  // Store gravity per particle without changing the shared CSS animation.
  (particles[particles.length-1] as any).gravity=gravity;
 }
 sound.playBurst();

 const animateBurst=(now:number)=>{
  const t=Math.min(1.8,(now-start)/1000);
  for(const p of particles){
   if(!p.el.isConnected)continue;
   const g=(p as any).gravity;
   p.x=p.vx*t;
   p.y=p.vy*t+0.5*g*t*t;
   p.rot+=p.spin/60;
   const fade=t>1.35?Math.max(0,(1.8-t)/.45):1;
   p.el.style.transform=`translate(-50%,-50%) translate(${p.x}px,${p.y}px) rotate(${p.rot}deg) scale(.72,1.05)`;
   p.el.style.opacity=String(fade);
  }
  if(t<1.8){
   requestAnimationFrame(animateBurst);
  }else{
   for(const p of particles)p.el.remove();
  }
 };
 requestAnimationFrame(animateBurst);
}

function beginCreamLock(x:number,y:number,partner:boolean){
 creamLock=true;isPartnerLocked=partner;creamLockX=x;creamLockY=y;creamClicks=0;creamFinishing=false;
 if(creamTimeoutTimer)clearTimeout(creamTimeoutTimer);
 mineEl.classList.toggle('locked',partner);
 const peerSlot=me===0?1:0;rcm[peerSlot]?.el?.classList.add('locked');
}

function scheduleCreamTimeout(isInitiator:boolean){
 if(creamTimeoutTimer)clearTimeout(creamTimeoutTimer);
 creamTimeoutTimer=setTimeout(()=>{
  resetCreamLock();
  if(isInitiator)sock.emit('cream_event',{type:'cancel'});
 },CREAM_TIMEOUT);
}

function handleCreamClickLocal(midX:number,midY:number){
 if(creamFinishing)return;
 if(!creamLock){
  beginCreamLock(midX,midY,false);
  sock.emit('cream_event',{type:'start',x:midX,y:midY});
 }
 creamClicks=Math.min(CREAM_TARGET,creamClicks+1);
 const progress=creamClicks/CREAM_TARGET;
 sock.emit('cream_event',{type:'click',x:creamLockX,y:creamLockY,count:creamClicks,progress});
 applyCreamClick(true,creamLockX,creamLockY,creamClicks);
 if(creamClicks>=CREAM_TARGET){
  finishCreamInteraction(creamLockX,creamLockY,true);
 }
}

function applyCreamClick(isInitiator:boolean,x:number,y:number,count:number){
 if(!creamLock)beginCreamLock(x,y,!isInitiator);
 creamClicks=Math.max(creamClicks,Math.min(CREAM_TARGET,count));
 scheduleCreamTimeout(isInitiator);
 const progress=creamClicks/CREAM_TARGET;
 const numBlobs=creamClicks<=5?1:creamClicks<=12?2:3;
 for(let i=0;i<numBlobs+1;i++)spawnWaterDrop(creamLockX,creamLockY,creamClicks);
 if(creamClicks>=13){
  for(let i=0;i<Math.ceil(progress*2);i++)spawnWaterDrop(creamLockX,creamLockY+8,creamClicks);
 }
 sound.playCreamOoze(progress);sound.playClap();
}

function finishCreamInteraction(x:number,y:number,emit:boolean){
 if(creamFinishing)return;
 creamFinishing=true;
 if(creamTimeoutTimer){clearTimeout(creamTimeoutTimer);creamTimeoutTimer=null}
 spawnWaterDropBurst(x,y);
 showCursorBubble(emit?me:(me===0?1:0),'❤️');
 if(emit)sock.emit('cream_event',{type:'finish',x,y});
 setTimeout(()=>resetCreamLock(),CREAM_FINALE);
}

function resetCreamLock(){
 creamLock=false;isPartnerLocked=false;creamFinishing=false;creamClicks=0;
 if(creamTimeoutTimer){clearTimeout(creamTimeoutTimer);creamTimeoutTimer=null}
 mineEl.classList.remove('locked');
 for(const s in rcm)rcm[s].el?.classList.remove('locked');
}

sock.on('cream_event',(d:any)=>{
 if(d.type==='start'&&d.sender!==me){
  beginCreamLock(Number(d.x)||0,Number(d.y)||0,true);
  scheduleCreamTimeout(false);
 }else if(d.type==='click'&&d.sender!==me){
  applyCreamClick(false,Number(d.x)||creamLockX,Number(d.y)||creamLockY,Number(d.count)||Math.min(CREAM_TARGET,creamClicks+1));
 }else if(d.type==='finish'){
  finishCreamInteraction(Number(d.x)||creamLockX,Number(d.y)||creamLockY,false);
 }else if(d.type==='cancel'){
  resetCreamLock();
 }
});

// ---------- interaction ----------
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new V3(0,1,0),0);
const setRay=(e:any)=>{ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,cam)};
const ground=(e:any)=>{setRay(e);const p=new V3();return ray.ray.intersectPlane(plane,p)?[p.x,p.z]:null};
const hitCake=(e:any)=>{setRay(e);return ray.intersectObjects(G.children,false).find(x=>x.object.userData.hit)};
const rnd=()=>Math.random()-.5;
const nrm=(h:any):any=>h.instanceId!==undefined&&frostNs[h.instanceId]?frostNs[h.instanceId].clone():h.face.normal.clone().transformDirection(h.object.matrixWorld);
const surf=(h:any,r:number)=>h.point.clone().addScaledVector(nrm(h),r*.6);
let tyaw=0,tpitch=0,tzoom=1,cyaw=0,cpitch=0,czoom=1,orb=false,pm=[0,0],pd=0;const tp=new Map<number,number[]>(),clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
let mine:number[][]=[],pts:number[][]=[],last=[0,0],lastT=0,y0=0,startHit:any=null,wd=0,wdT=0;const tg=[0,0],w=[0,0],blow:number[]=[],smoked=new Set();
const strokeCfg:any={3:{k:'fill',c:'#e0345a',r:.1},4:{k:'frost',c:'#fff6f0',r:.16},6:{k:'write',c:'#8a4a3a',r:.055}};
cv.addEventListener('pointerdown',(e:any)=>{tx=mx=e.clientX;ty=my=e.clientY;
 if(e.pointerType==='touch'){tp.set(e.pointerId,[e.clientX,e.clientY]);if(tp.size>1){down=false;pts=[];mine=[];return}}
 if(e.button>0&&phase==='game'&&doc.stage>0){orb=true;cv.setPointerCapture(e.pointerId);last=[e.clientX,e.clientY];return}
 if(phase!=='game'||!ready)return;
 const peerSlot=me===0?1:0,peerCur=rcm[peerSlot];
 if(peerCur){
  const dHands=Math.hypot(e.clientX-peerCur.x,e.clientY-peerCur.y);
  if(dHands<CREAM_PROXIMITY||creamLock){
   const midX=creamLock?creamLockX:(e.clientX+peerCur.x)/2;
   const midY=creamLock?creamLockY:(e.clientY+peerCur.y)/2;
   handleCreamClickLocal(midX,midY);
   return;
  }
 }
 down=true;cv.setPointerCapture(e.pointerId);setCur(true);sound.click();last=[e.clientX,e.clientY];const s=doc.stage;
 if(s===0&&!doc.drawing){mine=[];const g=ground(e);if(g)mine.push(g)}
 if(s===2){y0=e.clientY;startHit=hitCake(e)}
 if([3,4,6].includes(s))pts=[];
 if(s===5){const h=hitCake(e);if(h){act({t:'add',k:'deco',v:{e:sel,p:[h.point.x,h.point.y,h.point.z],n:nrm(h).toArray(),rot:rnd()*1.2,s:.8+Math.random()*.6}});sound.topping(sel)}}
 if(s===7){const h=hitCake(e);if(h&&nrm(h).y>.5){act({t:'add',k:'candles',v:{p:[h.point.x,h.point.y,h.point.z],tilt:[rnd()*.12,rnd()*.12]}});sound.candlePlace()}}});
addEventListener('pointermove',(e:any)=>{tx=e.clientX;ty=e.clientY;if(phase!=='game')return;const now=performance.now();
 const dx=e.clientX-last[0],dy=e.clientY-last[1],v=Math.hypot(dx,dy)/Math.max(8,now-lastT)*1000;lastT=now;tg[me]=Math.max(tg[me],Math.min(1,v/1800));wdT=Math.max(-1,Math.min(1,dx/20));
 let g=null;const s=doc.stage;
 if(orb){tyaw-=dx*.008;tpitch-=dy*.006;last=[e.clientX,e.clientY];return}
 if(tp.has(e.pointerId)){tp.set(e.pointerId,[e.clientX,e.clientY]);if(tp.size===2){const a=[...tp.values()],mxm=(a[0][0]+a[1][0])/2,mym=(a[0][1]+a[1][1])/2,d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pd&&doc.stage>0){tyaw-=(mxm-pm[0])*.008;tpitch-=(mym-pm[1])*.006;tzoom=clamp(tzoom*pd/d,.5,2)}pm=[mxm,mym];pd=d;last=[e.clientX,e.clientY];return}}
 if(down&&ready){
  if(s===0&&!doc.drawing){g=ground(e);if(g&&(!mine.length||dist(g,mine[mine.length-1])>.05)){mine.push(g);trails[me]=mine;setLine(trailL[me],mine.map(p=>[p[0],.03,p[1]]),0);if(looksClosed(mine)){down=false;finishDrawing(mine);mine=[];trails[me]=[];setLine(trailL[me],[])}}}
  if(s===1&&dx|dy){if(me===0)act({t:'base',v:{h:Math.max(.4,Math.min(2.6,doc.base.h-dy*.01)),hs:1}});else act({t:'base',v:{w:Math.max(.5,Math.min(1.8,doc.base.w+dx*.006)),ws:1}});sound.stretch(Math.hypot(dx,dy))}
  if(strokeCfg[s]){const h=hitCake(e);if(h){const fr=strokeCfg[s].k==='frost',nv=nrm(h),p=fr?h.point.clone():surf(h,strokeCfg[s].r),gap=fr?.09:.06;if(!pts.length||dist([p.x,p.z],[pts[pts.length-1][0],pts[pts.length-1][2]])>gap||Math.abs(p.y-(pts[pts.length-1]?.[1]??0))>gap){pts.push(fr?[p.x,p.y,p.z,nv.x,nv.y,nv.z]:[p.x,p.y,p.z]);if(fr){if(pvm)scene.remove(pvm);pvm=frostMesh([pts]);scene.add(pvm)}else if(pts.length>1)setLine(prev,pts,0);if(Math.random()<.25){if(s===6)sound.writing();else if(s===4)sound.frosting();else sound.filling()}}}}
 }
 last=[e.clientX,e.clientY];
 sock.volatile.emit('cur',{x:e.clientX/innerWidth,y:e.clientY/innerHeight,d:down,g:doc.stage===0?(g||ground(e)):null})});
function up(e:any){tp.delete(e.pointerId);if(tp.size<2)pd=0;if(orb){orb=false;return}if(!down)return;down=false;setCur(false);const s=doc.stage;
 if(s===0&&!doc.drawing){if(looksClosed(mine))finishDrawing(mine);else if(mine.length>3)toast('Circle back to where you started 💕');mine=[];trails[me]=[];setLine(trailL[me],[]);sock.volatile.emit('cur',{x:e.clientX/innerWidth,y:e.clientY/innerHeight,d:false,g:null})}
 if(s===2&&startHit&&(y0-e.clientY>30||dist([e.clientX,e.clientY],last)<8)){act({t:'add',k:'layers',v:{s:.72+Math.random()*.2,rot:rnd()*.8,dx:rnd()*.3,dz:rnd()*.3,tilt:rnd()*.1}});sound.layerPop()}
 if(strokeCfg[s]&&pts.length>=(strokeCfg[s].k==='frost'?1:2)){const c=strokeCfg[s];act({t:'add',k:c.k,v:{id:Math.random().toString(36).slice(2),author:me,pts,c:c.c,r:c.r}});if(s===6)sound.writing();else if(s===4)sound.frosting();else sound.filling()}
 pts=[];setLine(prev,[]);if(pvm){scene.remove(pvm);pvm=null}}
cv.addEventListener('contextmenu',e=>e.preventDefault());cv.addEventListener('wheel',(e:any)=>{e.preventDefault();if(doc.stage>0)tzoom=clamp(tzoom*Math.exp(e.deltaY*.001),.5,2)},{passive:false});
$('#camc').onclick=(e:any)=>{const c=e.target.dataset.c;if(!c)return;if(c==='l')tyaw-=.4;if(c==='r')tyaw+=.4;if(c==='u')tpitch-=.2;if(c==='d')tpitch+=.2;if(c==='in')tzoom=clamp(tzoom/1.2,.5,2);if(c==='out')tzoom=clamp(tzoom*1.2,.5,2);if(c==='0'){tyaw=tpitch=0;tzoom=1}sound.click()};
addEventListener('pointerup',up);addEventListener('pointercancel',up);

// ---------- frame ----------
const meterEl=$('#meter');let lt=performance.now(),ang=0;const dim=new THREE.Color('#2a1530'),bright=new THREE.Color('#fff4e6');
function frame(now:number){const dt=Math.min(.05,(now-lt)/1000),t=now/1000;lt=now;
 const k=1-Math.exp(-dt*28);mx+=(tx-mx)*k;my+=(ty-my)*k;mineEl.style.transform=`translate(${mx}px,${my}px)`;
 for(const s in rcm){const c=rcm[s];c.x+=(c.tx-c.x)*k*.7;c.y+=(c.ty-c.y)*k*.7;c.el.style.transform=`translate(${c.x}px,${c.y}px)`}
 if(creamLock){
  const peerSlot=me===0?1:0,peerCur=rcm[peerSlot];
  if(peerCur){
   peerCur.x+=(creamLockX-peerCur.x)*.45;peerCur.y+=(creamLockY-peerCur.y)*.45;
   peerCur.el.style.transform=`translate(${peerCur.x}px,${peerCur.y}px)`;
   peerCur.el.classList.add('locked');
  }
  if(isPartnerLocked){
   mx+=(creamLockX-mx)*.45;my+=(creamLockY-my)*.45;tx=mx;ty=my;
   mineEl.style.transform=`translate(${mx}px,${my}px)`;
   mineEl.classList.add('locked');
  }
 }
 for(let i=0;i<2;i++){w[i]+=(tg[i]-w[i])*Math.min(1,dt*10);tg[i]*=Math.exp(-dt*4)}wd+=(wdT-wd)*.1;
 const air=Math.min(1,(w[0]+w[1])*.7),s=doc.stage;
 sound.setWind(s===9?air:0);
 meterEl.style.display=s===9?'block':'none';if(s===9){const mw=$('#mw');mw.style.width=air*100+'%';mw.style.background=air>.4?'#4cc27a':'#ffb12e';for(let i=0;i<2;i++)$('#p'+i).style.background=`linear-gradient(90deg,${COL[i]} ${w[i]*100}%,#eadbe4 ${w[i]*100}%)`;$('#mt').textContent=air>.4?'💨 Yes! Keep going!':'👋 Shake your pointer fast to make the candles blow!'}
 // camera
 const c=STG[s].cam,f=1/Math.min(1,cam.aspect*.9),ty2=s>=2&&s<10?topY*.5:0;
 const L=new V3(c[3],c[4]+ty2,c[5]),P=new V3(c[0],c[1]+ty2,c[2]);P.sub(L).multiplyScalar(f).add(L);
 if(s===10){ang+=dt*.3;P.set(Math.sin(ang)*7*f,3.5+topY*.6,Math.cos(ang)*7*f);L.set(0,topY*.5,0)}
 const k2=1-Math.exp(-dt*10);cyaw+=(tyaw-cyaw)*k2;cpitch+=(tpitch-cpitch)*k2;czoom+=(tzoom-czoom)*k2;
 if(s>0){const sp=new THREE.Spherical().setFromVector3(P.clone().sub(L));sp.phi=clamp(sp.phi+cpitch,.12,1.5);sp.theta+=cyaw;sp.radius*=czoom;P.copy(L).add(new V3().setFromSpherical(sp))}
 const kk=1-Math.exp(-dt*2.2);cam.position.lerp(P,kk);look.lerp(L,kk);cam.lookAt(look);
 // rise
 if(doc.drawing&&rise()<1){const m:any=G.children[0];if(m)m.scale.y=doc.base.h*ease(rise())}
 // light / flames
 const dimT=s>=8&&s<10?1:0;hemi.intensity+=((dimT?.25:1.1)-hemi.intensity)*.05;sun.intensity+=((dimT?.2:1.4)-sun.intensity)*.05;(scene.background as any).lerp(dimT?dim:bright,.04);
 let lit=0;
 for(const fl of flames){const out=doc.out.includes(fl.i),on=doc.lit&&!out;fl.m.visible=on;
  if(on){lit++;if(s===9){const r=.8+(fl.i%3)*.2;blow[fl.i]=air>.4?(blow[fl.i]||0)+(air-.4)*dt*r:(blow[fl.i]||0)*Math.exp(-dt*.8);if(blow[fl.i]>=1&&isAuth()){act({t:'out',v:fl.i});sound.candleOut()}}
   const b=Math.min(1,blow[fl.i]||0);fl.m.scale.set(1-b*.4,(1+air*.5-b*.5)*(1+.1*Math.sin(t*18+fl.i*3)+.05*Math.sin(t*31)),1-b*.4);fl.m.rotation.z=-wd*air*1.1+.08*Math.sin(t*13+fl.i)}
  else if(out&&!smoked.has(fl.i)){smoked.add(fl.i);sound.candleOut();const p=new V3();fl.m.getWorldPosition(p);const sm=new THREE.Mesh(new THREE.SphereGeometry(.08,8,8),new THREE.MeshBasicMaterial({color:'#bbb',transparent:true,opacity:.6}));sm.position.copy(p);(sm as any).t0=now;scene.add(sm);setTimeout(()=>{scene.remove(sm)},2500)}}
 scene.children.forEach((o:any)=>{if(o.t0){const a=(now-o.t0)/2500;o.position.y+=dt*.5;o.scale.setScalar(1+a*3);o.material.opacity=.6*(1-a)}});
 glow.position.set(0,topY+1,0);glow.intensity=lit*.5*(1+.1*Math.sin(t*20));
 R.render(scene,cam);requestAnimationFrame(frame)}
requestAnimationFrame(frame);
