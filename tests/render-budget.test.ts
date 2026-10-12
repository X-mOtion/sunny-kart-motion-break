import test from 'node:test';import assert from 'node:assert/strict';import {RenderBudget} from '../src/render-budget';
test('automatic body-mode rendering bounds high-DPI pixels and reduces shadow work',()=>{
 const b=new RenderBudget(),keyboard=b.settings(1920,1080,2);assert.ok(keyboard.ratio**2*1920*1080<=2_600_001);
 b.setPose(true);const pose=b.settings(1920,1080,2);assert.ok(pose.ratio<keyboard.ratio);assert.ok(pose.ratio**2*1920*1080<=1_800_001);assert.equal(pose.shadowSize,1024);
 b.setQuality('high');assert.equal(b.settings(1920,1080,2).shadowSize,2048);b.setQuality('low');assert.equal(b.settings(1920,1080,2).shadowSize,1024);
});
test('sustained frame stalls reduce rendering load without repeated quality oscillation',()=>{
 const b=new RenderBudget();for(let i=0;i<180;i++)b.observe(1000/60,true);assert.equal(b.stage,0);
 const start=b.settings(1920,1080,2).ratio;for(let i=0;i<85;i++)b.observe(33,true);assert.equal(b.stage,1);assert.ok(b.settings(1920,1080,2).ratio<start);
 for(let i=0;i<100;i++)b.observe(33,true);assert.equal(b.stage,1);
 for(let i=0;i<900;i++)b.observe(33,true);assert.equal(b.stage,3);const low=b.settings(1920,1080,2).ratio;
 for(let i=0;i<1800;i++)b.observe(1000/60,true);assert.equal(b.settings(1920,1080,2).ratio,low);
});
test('pause, background gaps and manual high quality cannot cause spurious adaptation',()=>{
 const b=new RenderBudget();for(let i=0;i<500;i++){b.observe(40,false);b.observe(1000,true);}assert.equal(b.stage,0);
 b.setQuality('high');for(let i=0;i<1000;i++)b.observe(50,true);assert.equal(b.stage,0);b.setQuality('auto');b.setPose(true);assert.equal(b.stage,0);
});
