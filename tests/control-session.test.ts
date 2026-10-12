import test from 'node:test';import assert from 'node:assert/strict';import {ControlSession} from '../src/control-session';
test('switching controls and switching back keeps the entire ride classified as mixed',()=>{
 const s=new ControlSession();s.begin('pose');s.note('keyboard');s.note('pose');assert.equal(s.category,'mixed');assert.deepEqual(s.snapshot().used,['pose','keyboard']);
});
test('unchanged controls remain pure and a new ride resets the classification',()=>{
 const s=new ControlSession();s.begin('keyboard');s.note('keyboard');assert.equal(s.category,'keyboard');s.note('touch');s.begin('touch');assert.equal(s.category,'touch');assert.deepEqual(s.snapshot().used,['touch']);
});
