import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Track } from './track';
import { CONFIG,clamp,wrapAngle,type Quality } from './config';
import type { Race } from './race';
import {KartEffects} from './effects';
import {RenderBudget} from './render-budget';
const mat=(color:T.ColorRepresentation,roughness=.8)=>new T.MeshStandardMaterial({color,roughness,metalness:0});
const box=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,12,8);
type TailLight={direction:number;lens:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;glow:T.Sprite};
type VisualCar={root:T.Group;body:T.Group;wheels:T.Object3D[];front:T.Object3D[];driver:T.Object3D;helmet:T.Object3D;flames:T.Mesh[];tailLights:TailLight[];mixer:T.AnimationMixer};
export class World {
 renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(60,1,.15,500);sun=new T.DirectionalLight('#fff4db',3.1);
 visuals:VisualCar[]=[];assets=new Map<string,GLTF>();quality:Quality='auto';low=false;ready=false;
 clock=0;effects:KartEffects;performance=new RenderBudget(matchMedia('(pointer:coarse)').matches);
 private tailGlowMap:T.CanvasTexture|null=null;
 dummy=new T.Object3D();look=new T.Vector3();camGoal=new T.Vector3();lookGoal=new T.Vector3();fps=60;frameTimes:number[]=[];
 constructor(public track:Track,public canvas:HTMLCanvasElement,public base:string){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.13;
  // Keep moving light, shadow and car updates on the same rendered frame.
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.shadowMap.autoUpdate=true;
  this.scene.background=new T.Color('#b8def0');this.scene.fog=new T.Fog('#b8def0',130,340);
  this.scene.add(new T.HemisphereLight('#d9f1ff','#b1b97f',2.3));
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:160});this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.035;
  this.scene.add(this.sun,this.sun.target);
  const ground=new T.Mesh(new T.PlaneGeometry(900,900),mat('#a4c99a'));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;this.scene.add(ground);
  this.makeRoad();
  this.effects=new KartEffects(this.scene);
  this.setQuality('auto');this.resize();
 }
 setQuality(q:Quality){this.quality=q;this.performance.setQuality(q);this.resize();}
 setPoseActive(active:boolean){if(this.performance.setPose(active))this.resize();}
 observeFrame(ms:number,active:boolean){if(this.performance.observe(ms,active))this.resize();}
 resize(){
  const w=innerWidth,h=innerHeight,budget=this.performance.settings(w,h,devicePixelRatio);this.low=budget.low;
  if(Math.abs(this.renderer.getPixelRatio()-budget.ratio)>.001)this.renderer.setPixelRatio(budget.ratio);
  if(this.sun.shadow.mapSize.x!==budget.shadowSize){this.sun.shadow.mapSize.setScalar(budget.shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  this.renderer.shadowMap.needsUpdate=true;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
 }
 mesh(geometry:T.BufferGeometry,material:T.Material,parent:T.Object3D=this.scene,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 ribbon(extra:number,y:number,color:string){const points=this.track.points,positions:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<=points.length;i++){const p=points[i%points.length];for(const sign of [-1,1]){positions.push(p.x+p.nx*(p.width/2+extra)*sign,y,p.z+p.nz*(p.width/2+extra)*sign);uv.push(sign===1?1:0,i*.05);}if(i<points.length){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide}));m.receiveShadow=true;this.scene.add(m);return m;
 }
 makeRoad(){
  this.ribbon(2.3,-.015,'#d6cfb9');this.ribbon(.7,.002,'#e9e2d1');this.ribbon(0,.01,'#606d77');
  this.makeRouteLanes();
  const n=Math.ceil(this.track.length/2.5),red=mat('#ed635a'),white=mat('#fff8e9');
  const barriers=[new T.InstancedMesh(box,red,n),new T.InstancedMesh(box,white,n)];let idx=[0,0];
  for(let i=0;i<n;i++){const p=this.track.at(i*2.5);for(const sign of [-1,1]){const k=i%2;this.dummy.position.set(p.x+p.nx*sign*(p.width/2+1.3),.43,p.z+p.nz*sign*(p.width/2+1.3));this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(.38,.78,2.45);this.dummy.updateMatrix();barriers[k].setMatrixAt(idx[k]++,this.dummy.matrix);}}
  for(const b of barriers){b.castShadow=true;b.receiveShadow=true;this.scene.add(b);}
  const markings=this.track.wideRoad?[-this.track.definition.laneRange/2,this.track.definition.laneRange/2]:[0],dashCount=Math.ceil(this.track.length/9);
  const dashes=new T.InstancedMesh(new T.PlaneGeometry(.15,2.8),new T.MeshBasicMaterial({color:'#ebe8d8'}),dashCount*markings.length);
  for(let i=0;i<dashes.count;i++){const p=this.track.at(Math.floor(i/markings.length)*9),offset=markings[i%markings.length];this.dummy.position.set(p.x+p.nx*offset,.025,p.z+p.nz*offset);this.dummy.rotation.set(-Math.PI/2,0,p.yaw);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();dashes.setMatrixAt(i,this.dummy.matrix);}this.scene.add(dashes);
  const start=this.track.at(0);const checks=new T.InstancedMesh(new T.PlaneGeometry(this.track.at(0).width/12,.8),new T.MeshBasicMaterial({color:'#f6f6e9'}),18);let c=0;
  for(let row=0;row<3;row++)for(let col=0;col<12;col++){if((row+col)%2)continue;const p=this.track.at(row*.8);this.dummy.position.set(p.x+p.nx*(col-5.5)*start.width/12,.035,p.z+p.nz*(col-5.5)*start.width/12);this.dummy.rotation.set(-Math.PI/2,0,p.yaw);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();checks.setMatrixAt(c++,this.dummy.matrix);}this.scene.add(checks);
  const arch=new T.Group();arch.position.set(start.x,0,start.z);arch.rotation.y=start.yaw;this.scene.add(arch);
  const dark=mat('#163f47'),cream=mat('#fffbeb'),lime=mat('#d2ee75');
  for(const sign of [-1,1]){this.mesh(box,cream,arch,sign*(start.width/2+1.5),2.9,0,.65,5.8,.75);this.mesh(box,lime,arch,sign*(start.width/2+1.5),.3,0,1.35,.6,1.35);}
  this.mesh(box,dark,arch,0,5.7,0,start.width+3.6,1.6,.6);
  const banner=this.textPlane('SUNNY KART',`${this.track.definition.english.toUpperCase()}  /  ${this.track.definition.number}`,'#173e45','#ecf3de',14,1.35);banner.position.set(0,5.7,-.32);banner.rotation.y=Math.PI;arch.add(banner);
  for(let j=0;j<3;j++){const light=this.mesh(sphere,mat(j===0?'#ff7662':j===1?'#ffcc53':'#bef18a'),arch,(j-1)*.65,4.55,0,.2,.2,.2);light.castShadow=false;}
 }
 makeRouteLanes(){
  const positions:number[]=[],indices:number[]=[];
  for(const section of this.track.sections){
   if(section.action!=='lane-left'&&section.action!=='lane-right')continue;
   const start=section.action==='lane-left'?0:-this.track.definition.laneRange,target=(section.lane??0)*this.track.definition.laneRange;
   const count=Math.ceil((section.end-section.start)/3);
   for(let i=0;i<=count;i++){
    const s=section.start+(section.end-section.start)*i/count,p=this.track.at(s),t=clamp((s-section.start)/22,0,1),offset=start+(target-start)*t*t*(3-2*t),index=positions.length/3;
    for(const side of [-1,1])positions.push(p.x+p.nx*(offset+side*1.4),.045,p.z+p.nz*(offset+side*1.4));
    if(i<count)indices.push(index,index+1,index+2,index+1,index+3,index+2);
   }
  }
  if(!positions.length)return;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const paint=new T.MeshBasicMaterial({color:'#91aaa0',side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const guide=new T.Mesh(g,paint);guide.name='Ordered passing lanes';this.scene.add(guide);
  const accelerations=this.track.sections.filter(s=>s.action==='accelerate'),stripes=new T.InstancedMesh(new T.PlaneGeometry(3,.55),new T.MeshBasicMaterial({color:'#e1c981',polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),accelerations.length*3);
  stripes.name='Acceleration strips';stripes.castShadow=false;
  accelerations.forEach((section,i)=>{for(let j=0;j<3;j++){
   const p=this.track.at(section.start+18+j*8);this.dummy.position.set(p.x,.048,p.z);this.dummy.rotation.set(-Math.PI/2,0,p.yaw);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();stripes.setMatrixAt(i*3+j,this.dummy.matrix);
  }});stripes.computeBoundingSphere();this.scene.add(stripes);
 }
 textPlane(title:string,sub:string,bg:string,fg:string,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='900 104px Arial';ctx.fillText(title,512,135);ctx.font='600 31px Arial';ctx.fillText(sub,512,205);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
 }
 async load(onProgress:(p:number)=>void){
  const names=['kart','driver','house-a','house-b','house-c','house-e','house-f','house-h','tree_default','tree_oak','tree_fat'];const loader=new GLTFLoader();let done=0;
  await Promise.all(names.map(async n=>{const g=await loader.loadAsync(`${this.base}assets/${n}.glb`);g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(m instanceof T.MeshStandardMaterial){m.metalness=0;m.roughness=.83;if(m.map)m.map.anisotropy=4;}}}});this.assets.set(n,g);onProgress(++done/names.length);}));
  for(const [i,n] of ['house-a','house-b','house-c','house-e','house-f','house-h'].entries()){
   const roof=new T.Color(['#c76b50','#dfb866','#5b9396','#ca8066','#779b7b','#8a91ad'][i]),wall=new T.Color(['#f4d9aa','#e8c8b5','#e6e9cc','#d4e5de','#edcbbb','#e7ddc0'][i]);
   this.assets.get(n)!.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const m=(o.material as T.MeshStandardMaterial).clone();m.onBeforeCompile=shader=>{shader.uniforms.cityRoof={value:roof};shader.uniforms.cityWall={value:wall};shader.fragmentShader='uniform vec3 cityRoof;\nuniform vec3 cityWall;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n if(diffuseColor.g>diffuseColor.r*1.18 && diffuseColor.g>diffuseColor.b*1.08){diffuseColor.rgb=cityRoof*(0.7+diffuseColor.g*0.3);}else if(min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b)>.45){diffuseColor.rgb*=cityWall;}');};m.customProgramCacheKey=()=>`sunny-house-${i}`;o.material=m;});
  }
  this.makeCity();
  // Scenery never moves: calculate its transforms once, retaining frustum culling.
  // Effects, cars and the following sun still update normally.
  const dynamic=new Set<T.Object3D>([this.sun,this.sun.target,this.effects.skids,...this.effects.particles.map(p=>p.sprite)]);
  for(const child of this.scene.children)if(!dynamic.has(child)){
   child.updateMatrixWorld(true);child.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
  }
  for(let i=0;i<6;i++)this.visuals.push(this.makeCar(i));
  this.ready=true;
 }
 instances(name:string,placements:{x:number;z:number;scale:number;yaw:number}[]){
  const model=this.assets.get(name)!.scene;model.updateMatrixWorld(true);
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;const batch=new T.InstancedMesh(o.geometry,o.material,placements.length);batch.castShadow=true;batch.receiveShadow=true;
   placements.forEach((p,i)=>{this.dummy.position.set(p.x,0,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.setScalar(p.scale);this.dummy.updateMatrix();batch.setMatrixAt(i,new T.Matrix4().multiplyMatrices(this.dummy.matrix,o.matrixWorld));});batch.computeBoundingSphere();this.scene.add(batch);
  });
 }
 makeCity(){
  const houses=['house-a','house-b','house-c','house-e','house-f','house-h'],groups=new Map<string,{x:number;z:number;scale:number;yaw:number}[]>();for(const n of [...houses,'tree_default','tree_oak','tree_fat'])groups.set(n,[]);
  for(let s=15,i=0;s<this.track.length;s+=19,i++){
   const p=this.track.at(s);
   for(const sign of [-1,1]){
    const park=this.track.wideRoad?(this.track.id==='lakeside'||s>120&&s<this.track.length-130):s>360&&s<650;
    const distance=(park?17:21+(i%3)*2)+(this.track.wideRoad?5:0);
    const x=p.x+p.nx*sign*distance,z=p.z+p.nz*sign*distance;
    if(this.track.nearest(x,z).distance<14)continue;
    const name=park?['tree_default','tree_oak','tree_fat'][i%3]:houses[(i+(sign>0?2:0))%houses.length];
    groups.get(name)!.push({x,z,scale:park?4.2+(i%4)*.4:10+(i%3)*1.3,yaw:p.yaw+(sign>0?Math.PI/2:-Math.PI/2)});
    const q=this.track.at(s+8),tx=q.x+q.nx*sign*(q.width/2+5),tz=q.z+q.nz*sign*(q.width/2+5);
    if(this.track.nearest(tx,tz).distance>9)groups.get('tree_oak')!.push({x:tx,z:tz,scale:2.6+i%3*.3,yaw:i});
   }
  }
  for(const [name,places] of groups)this.instances(name,places);
  const trunk=mat('#725b45'),lamp=mat('#e8eddf'),dark=mat('#355058');
  for(let s=28;s<this.track.length;s+=45){const p=this.track.at(s),side=(Math.floor(s/45)%2)*2-1,x=p.x+p.nx*side*(p.width/2+3),z=p.z+p.nz*side*(p.width/2+3);
   if(this.track.nearest(x,z).distance<8)continue;this.mesh(box,dark,this.scene,x,2.1,z,.11,4.2,.11);this.mesh(box,lamp,this.scene,x,4.25,z,.7,.16,.4);
  }
  const signs:[number,string,string,string][]=this.track.id==='meadow'?[[100,'DAISY LANE','OPEN SKIES  /  OPEN ROAD','#408b72'],[360,'CLOVER GROVE','A LITTLE GREEN GETAWAY','#eab84d'],[720,'SUNFLOWER WAY','TAKE THE SCENIC ROUTE','#5288ac'],[1060,'MEADOW HOME','ONE MORE SUNNY STRETCH','#df6955']]:this.track.id==='lakeside'?[[120,'WILLOW BAY','FOLLOW THE WATER','#5288ac'],[410,'LILY COVE','A GENTLE LITTLE CURVE','#408b72'],[720,'BLUEWATER','BREATHE IN THE VIEW','#eab84d'],[1020,'SUNSET PIER','THE SCENIC WAY HOME','#df6955']]:[[120,'OLD TOWN','TAKE THE SCENIC ROUTE','#df6955'],[340,'DRIFT!','SLOW IN  /  FAST OUT','#eab84d'],[580,'THE PARK','FIND YOUR FLOW','#408b72'],[850,'FULL SEND','SEE YOU AT THE FINISH','#5288ac']];
  for(const [s,title,sub,bg] of signs){
   const p=this.track.at(s);const group=new T.Group();group.position.set(p.x+p.nx*(p.width/2+4.5),0,p.z+p.nz*(p.width/2+4.5));group.rotation.y=p.yaw+Math.PI;this.scene.add(group);this.mesh(box,trunk,group,0,2.6,0,.2,5.2,.2);const board=this.textPlane(title,sub,bg,'#fffbed',6,2);board.position.y=4.4;group.add(board);
  }
  // Distant soft hills and compact skyline provide depth without blocking the circuit.
  if(this.track.id==='lakeside')this.makeLake();
  if(this.track.id==='meadow')this.makeMeadow();
  const hillX=this.track.wideRoad?this.track.bounds.maxX+100:260,hillZ=this.track.wideRoad?this.track.bounds.maxZ+140:260;
  const hillmat=mat('#85b5aa');for(let i=0;i<14;i++){const a=i/14*Math.PI*2;const hill=this.mesh(sphere,hillmat,this.scene,Math.cos(a)*hillX,-12,Math.sin(a)*hillZ,50,30+(i%4)*9,45);hill.castShadow=false;}
  this.makeClouds();
 }
 makeMeadow(){
  // Small roadside flower clusters are batched, without adding moving effects.
  const places:{x:number;z:number;color:number}[]=[];
  for(let s=20,i=0;s<this.track.length;s+=28,i++){
   const p=this.track.at(s);if(Math.abs(this.track.curvature(s))>.001)continue;
   for(const side of [-1,1])for(let j=0;j<7;j++){
    const distance=p.width/2+5.5+(j%3)*.65,along=(j-3)*.8;
    const x=p.x+p.nx*side*distance+p.tx*along,z=p.z+p.nz*side*distance+p.tz*along;
    if(this.track.nearest(x,z).distance>p.width/2+3)places.push({x,z,color:i%3});
   }
  }
  for(const [color,paint] of ['#fff0a6','#edb6c5','#d2c3ef'].entries()){
   const group=places.filter(p=>p.color===color),flowers=new T.InstancedMesh(sphere,mat(paint),group.length);
   flowers.name=`Meadow flowers ${color}`;flowers.castShadow=false;
   group.forEach((p,i)=>{this.dummy.position.set(p.x,.48,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(.34,.28,.34);this.dummy.updateMatrix();flowers.setMatrixAt(i,this.dummy.matrix);});
   flowers.computeBoundingSphere();this.scene.add(flowers);
  }
  const stems=new T.InstancedMesh(box,mat('#689e64'),places.length);stems.name='Meadow flower stems';stems.castShadow=false;
  places.forEach((p,i)=>{this.dummy.position.set(p.x,.2,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(.045,.45,.045);this.dummy.updateMatrix();stems.setMatrixAt(i,this.dummy.matrix);});
  stems.computeBoundingSphere();this.scene.add(stems);
 }
 makeLake(){
  // Follow the inner shoreline so water remains visible around every lobe.
  const shore=(offset:number,y:number,color:string)=>{
   const samples=this.track.points.filter((_,i)=>i%8===0),shape=new T.Shape();
   samples.forEach((p,i)=>{const x=p.x-p.nx*offset,z=p.z-p.nz*offset;i?shape.lineTo(x,-z):shape.moveTo(x,-z);});shape.closePath();
   const mesh=new T.Mesh(new T.ShapeGeometry(shape),mat(color));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
  };
  shore(23,-.015,'#d6d7b5');const lake=shore(26,.035,'#80c9d8');lake.name='Lakeside water';
  const island=this.mesh(new T.CircleGeometry(13,32),mat('#d6d7b5'),this.scene,20,.065,-12);island.rotation.x=-Math.PI/2;island.castShadow=false;
  this.instances('tree_oak',[{x:18,z:-12,scale:5,yaw:.4},{x:25,z:-15,scale:3.4,yaw:1.6}]);
  const timber=mat('#cda87f'),cream=mat('#f5e6c9');
  for(const s of [70,380,690,1000]){
   const p=this.track.at(s),dock=new T.Group();dock.name='Lakeside overlook';dock.position.set(p.x-p.nx*21,0,p.z-p.nz*21);dock.rotation.y=p.yaw;this.scene.add(dock);
   this.mesh(box,timber,dock,0,.13,0,5,.2,7);
   for(const side of [-1,1]){this.mesh(box,cream,dock,side*2.3,1.05,0,.1,.1,7);for(const z of [-3,0,3])this.mesh(box,cream,dock,side*2.3,.55,z,.12,1.1,.12);}
   this.mesh(box,timber,dock,0,.7,2.4,2.6,.18,.8);this.mesh(box,timber,dock,0,1.1,2.75,2.6,.65,.14);
  }
 }
 makeClouds(){
  // One opaque, unlit batch: soft colors without moving shadows or transparency flicker.
  const geometry=new T.SphereGeometry(1,16,12),positions=geometry.getAttribute('position'),colors=[];
  const shade=new T.Color('#dbe9ec'),cream=new T.Color('#fffdf2'),color=new T.Color();
  for(let i=0;i<positions.count;i++){color.copy(shade).lerp(cream,clamp((positions.getY(i)+.7)/1.2,0,1));colors.push(color.r,color.g,color.b);}
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const puffs=[[-11,-1,0,6,3.8,5],[-4,1,0,7,5,6],[4,3,-1,7.5,6,6],[11,0,0,6,4,5],[-6,-2,-3,8,3,5],[4,-2,3,9,3.5,5],[0,0,-5,6,4,5]];
  const clusters=18,clouds=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,fog:false}),clusters*puffs.length);
  clouds.name='Sunny cloud bank';clouds.castShadow=clouds.receiveShadow=false;clouds.userData.clusters=clusters;
  for(let i=0;i<clusters;i++){
   const p=this.track.at((i+.35)*this.track.length/clusters),side=i%2?1:-1,offset=74+i%3*18,scale=.85+i%4*.1,angle=i*2.39;
   for(let j=0;j<puffs.length;j++){
    const [x,y,z,sx,sy,sz]=puffs[j],cos=Math.cos(angle),sin=Math.sin(angle);
    this.dummy.position.set(p.x+p.nx*side*offset+(x*cos-z*sin)*scale,34+i%3*4+y*scale,p.z+p.nz*side*offset+(x*sin+z*cos)*scale);
    this.dummy.rotation.set(0,angle,0);this.dummy.scale.set(sx*scale,sy*scale,sz*scale);this.dummy.updateMatrix();clouds.setMatrixAt(i*puffs.length+j,this.dummy.matrix);
   }
  }
  clouds.computeBoundingSphere();this.scene.add(clouds);
 }
 makeCar(id:number):VisualCar {
  const root=new T.Group(),body=new T.Group();root.add(body);this.scene.add(root);
  const kart=this.assets.get('kart')!.scene.clone(true);kart.scale.setScalar(3.2);body.add(kart);
  const wheels:T.Object3D[]=[],front:T.Object3D[]=[];
  kart.traverse(o=>{if(o.name.startsWith('wheel-')){wheels.push(o);if(o.name.includes('-f'))front.push(o);}if(o instanceof T.Mesh&&!o.name.startsWith('wheel-')){
   const paint=(o.material as T.MeshStandardMaterial).clone();paint.roughness=.5;
   paint.onBeforeCompile=shader=>{shader.uniforms.kartPaint={value:new T.Color(CONFIG.colors[id])};shader.fragmentShader='uniform vec3 kartPaint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n if(diffuseColor.g>diffuseColor.r*1.2 && diffuseColor.g>diffuseColor.b*1.15){diffuseColor.rgb=kartPaint*(.72+diffuseColor.g*.45);}');};paint.customProgramCacheKey=()=>`kart-paint-${id}`;o.material=paint;
  }});
  // Small white nose panel and racing number remain readable from the chase camera.
  const badge=this.textPlane(String(id+1).padStart(2,'0'),'SUNNY','#fff9e8','#23424a',.48,.42);badge.position.set(0,.42,-1.04);badge.rotation.x=-Math.PI/2;body.add(badge);
  const driver=this.assets.get('driver')!.scene.clone(true);driver.scale.setScalar(.83);driver.position.set(0,.37,.05);body.add(driver);
  driver.traverse(o=>{if(o instanceof T.Mesh){if(o.name==='head')o.visible=false;else o.material=mat(o.name.startsWith('leg')?'#25364d':id===0?'#3e86c5':CONFIG.colors[id]);
   if(o.name==='torso')o.geometry=new RoundedBoxGeometry(.74,.82,.55,3,.1).translate(0,.75,0);
   if(o.name.startsWith('arm-')){const side=o.name==='arm-left'?1:-1;o.geometry=new T.CapsuleGeometry(.14,.48,4,8).translate(side*.12,-.3,0);this.mesh(sphere,mat('#f2cf9e'),o,side*.12,-.66,0,.135,.135,.135);}
  }});
  const mixer=new T.AnimationMixer(driver),clip=this.assets.get('driver')!.animations.find(c=>c.name==='drive');if(clip)mixer.clipAction(clip).play();mixer.update(.1);
  const head=driver.getObjectByName('head');
  const helmet=new T.Group();helmet.position.set(0,2.1,-.02);body.add(helmet);
  const blue=mat(id===0?'#358cca':CONFIG.colors[id],.36);this.mesh(sphere,blue,helmet,0,0,0,.39,.39,.37);
  this.mesh(sphere,mat('#213c4c',.23),helmet,0,-.035,-.245,.325,.15,.19);
  this.mesh(sphere,mat('#b0e2ed',.24),helmet,-.09,.015,-.385,.16,.07,.015);
  this.mesh(sphere,mat('#f8f2dc'),helmet,0,.06,0,.06,.385,.375);
  if(head)head.visible=false;
  if(!this.tailGlowMap){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!,g=ctx.createRadialGradient(32,32,0,32,32,32);
   g.addColorStop(0,'#fff5ce');g.addColorStop(.28,'#ffd478aa');g.addColorStop(1,'#ffb94600');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);this.tailGlowMap=new T.CanvasTexture(canvas);this.tailGlowMap.colorSpace=T.SRGBColorSpace;
  }
  const tailLights:TailLight[]=[];
  for(const direction of [-1,1]){
   // Kart models face local -Z: driver's left is local -X.
   const x=direction*.63;
   const housing=this.mesh(new RoundedBoxGeometry(.44,.25,.12,3,.045),mat('#fff2d8',.45),body,x,.52,1.24);housing.castShadow=false;
   const lens=this.mesh(new RoundedBoxGeometry(.33,.15,.06,3,.035),new T.MeshBasicMaterial({color:'#a8483e',toneMapped:false}),body,x,.52,1.32) as TailLight['lens'];lens.castShadow=lens.receiveShadow=false;
   const glint=this.mesh(new RoundedBoxGeometry(.21,.025,.012,2,.01),new T.MeshBasicMaterial({color:'#fff2d8',transparent:true,opacity:.55,toneMapped:false}),body,x,.555,1.357);glint.castShadow=glint.receiveShadow=false;
   const glow=new T.Sprite(new T.SpriteMaterial({map:this.tailGlowMap,color:'#ffd17b',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.position.set(x,.52,1.39);glow.scale.set(.69,.44,1);glow.visible=false;body.add(glow);
   tailLights.push({direction,lens,glow});
  }
  const flames:T.Mesh[]=[];for(const x of [-.42,.42]){
   this.mesh(new T.CylinderGeometry(.12,.12,.32,8),mat('#47525c',.25),body,x,.31,1.08,1,1,1).rotation.x=Math.PI/2;
   for(const [radius,length,color,opacity] of [[.28,1.8,'#2eaeff',.35],[.19,1.3,'#69e9ff',.85],[.095,.9,'#fffbe5',.95]] as const){
    const flame=this.mesh(new T.ConeGeometry(radius,length,8),new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),body,x,.31,1.08+length/2);
    flame.rotation.x=Math.PI/2;flame.visible=false;flame.castShadow=flame.receiveShadow=false;flame.userData.length=length;flames.push(flame);
   }
  }
  // Soft contact shadow keeps the kart grounded on devices with reduced shadow detail.
  const shadow=this.mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial({color:'#253b40',transparent:true,opacity:.15,depthWrite:false}),root,0,.035,0,1.05,1.65,1);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  return {root,body,wheels,front,driver,helmet,flames,tailLights,mixer};
 }
 render(race:Race,dt:number,alpha=1){
  this.clock+=dt;if(!this.ready){this.renderer.render(this.scene,this.camera);return;}
  const player=race.cars[0],active=race.phase==='racing',menu=race.phase==='menu';
  const signal=this.effects.turnSignal;
  for(const c of race.cars){const v=this.visuals[c.id];v.root.position.set(c.prevX+(c.x-c.prevX)*alpha,0,c.prevZ+(c.z-c.prevZ)*alpha);v.root.rotation.y=c.prevYaw+wrapAngle(c.yaw-c.prevYaw)*alpha+Math.PI;
   const roll=clamp(c.yawRate*c.speed*.0016,-.09,.09),pitch=c.nitro>0?-.045:0;
   v.body.rotation.z+=(-roll-v.body.rotation.z)*.2;v.body.rotation.x+=(pitch-v.body.rotation.x)*.15;
   for(const wheel of v.wheels)wheel.rotation.x-=c.speed*(active?dt:0)/.4;for(const wheel of v.front)wheel.rotation.y=-c.steer*.28;
   v.helmet.rotation.y+=(-c.steer*.23-v.helmet.rotation.y)*.15;v.helmet.rotation.x+=((c.nitro>0?.14:0)-v.helmet.rotation.x)*.1;
   v.mixer.update(active?dt:0);
   for(const flame of v.flames){flame.visible=active&&(c.nitro>0||c.mini>0);flame.scale.y=(c.nitro>0?1.12:.65)*(1+Math.sin(this.effects.time*65+c.id)*.12);flame.position.z=1.08+flame.userData.length*flame.scale.y/2;}
   for(const lamp of v.tailLights){const lit=c.id===0&&signal.lit&&lamp.direction===signal.direction;lamp.lens.material.color.set(lit?'#ffd16a':'#a8483e');lamp.glow.visible=lit;lamp.glow.material.opacity=lit?.65:0;}
  }
  const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw),right=new T.Vector3(-fz,0,fx);
  if(menu){const p=this.track.at(-9);this.camGoal.set(player.x-fx*5.3+right.x*6.2,3.7,player.z-fz*5.3+right.z*6.2);this.lookGoal.set(player.x-right.x*2.8,1.1,player.z-right.z*2.8);}
  else{const speed=clamp(player.speed/40,0,1.5),pulse=this.effects.reducedMotion?0:this.effects.boostPulse/CONFIG.effects.boostPulseSeconds,distance=CONFIG.camera.followDistance+speed*.9+(player.nitro>0?.8:0)+pulse*.35,heading=player.yaw-player.slip*.4,cfx=Math.sin(heading),cfz=Math.cos(heading),ahead=this.track.at(player.s+12+speed*6);this.camGoal.set(player.x-cfx*distance,CONFIG.camera.followHeight+speed*.35,player.z-cfz*distance);this.lookGoal.set((player.x+cfx*5)*(1-CONFIG.camera.anticipation)+ahead.x*CONFIG.camera.anticipation,1,(player.z+cfz*5)*(1-CONFIG.camera.anticipation)+ahead.z*CONFIG.camera.anticipation);}
  const smooth=1-Math.exp(-dt*(menu?3:CONFIG.camera.smoothing));if(this.clock<.5){this.camera.position.copy(this.camGoal);this.look.copy(this.lookGoal);}else{this.camera.position.lerp(this.camGoal,smooth);this.look.lerp(this.lookGoal,smooth);}
  if(player.collision>0&&active)this.camera.position.x+=Math.sin(this.clock*85)*player.collision*.08;
  this.camera.lookAt(this.look);const fov=menu?48:this.effects.reducedMotion?CONFIG.camera.normalFov:player.nitro>0?CONFIG.camera.nitroFov:player.mini>0?CONFIG.camera.miniFov:CONFIG.camera.normalFov;this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*5);this.camera.updateProjectionMatrix();
  this.sun.position.set(player.x-38,65,player.z-30);this.sun.target.position.set(player.x,0,player.z);this.sun.target.updateMatrixWorld();
  this.renderer.render(this.scene,this.camera);
 }
 resetEffects(){this.effects.reset();this.clock=0;}
}
