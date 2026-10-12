import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings} from '../src/settings';
test('missing, primitive and malformed settings recover to safe desktop defaults',()=>{
 for(const raw of [null,undefined,'broken',42,[],{casualVersion:1,difficulty:'unexpected-value',mode:'bad',quality:'bad'}]){
  const s=normalizeSettings(raw);assert.equal(s.difficulty,'easy');assert.equal(s.quality,'auto');assert.equal(s.mode,'pose');assert.equal(s.sensitivity,1);
 }
 assert.equal(normalizeSettings(null,true).mode,'touch');
});
test('valid accepted settings and zero volumes survive normalization',()=>{
 const raw={casualVersion:1,mode:'pose',difficulty:'hard',quality:'low',music:0,effects:0,sensitivity:1.15,cameraId:'iPhone',trackId:'lakeside'};
 assert.deepEqual(normalizeSettings(raw),raw);
 assert.equal(normalizeSettings({...raw,mode:'keyboard'}).mode,'keyboard');
});
test('settings ranges reject invalid types and clamp finite numbers',()=>{
 const s=normalizeSettings({music:9,effects:-2,sensitivity:Infinity,cameraId:{},trackId:'unknown'});
 assert.equal(s.music,1);assert.equal(s.effects,0);assert.equal(s.sensitivity,1);assert.equal(s.cameraId,'');assert.equal(s.trackId,'meadow');
 assert.equal(normalizeSettings({sensitivity:.1}).sensitivity,.6);assert.equal(normalizeSettings({sensitivity:99}).sensitivity,1.8);
 assert.equal(normalizeSettings({music:'0.7',effects:NaN}).music,.2);
});
test('migration retains camera and sensitivity while moving the previous competitive default to relaxed',()=>{
 const s=normalizeSettings({difficulty:'hard',sensitivity:1.1,cameraId:'camera-2',music:.4});
 assert.equal(s.difficulty,'easy');assert.equal(s.sensitivity,1.1);assert.equal(s.cameraId,'camera-2');assert.equal(s.music,.4);
});
