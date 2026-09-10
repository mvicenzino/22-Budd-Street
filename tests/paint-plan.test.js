import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWall, HOUSE_PALETTE} from '../paint-plan.js';
import {migrateDesign, DEFAULT_DESIGN} from '../design.js';

test('the chosen Benjamin Moore colors cover all specified spaces', () => {
  for (const id of ['living','dining','hall','hall2','bedBack','bedFrontL','bedFrontR','loft','walkin','hallCloset','landing']) assert.equal(defaultWall(id), 'paleoak');
  for (const id of ['kitchen','rear','sunroom','basement']) assert.equal(defaultWall(id), 'seapearl');
  for (const id of ['bath','powder']) assert.equal(defaultWall(id), 'classicgray');
  assert.deepEqual(HOUSE_PALETTE.map(c => [c.code, c.color]), [['OC-20','#DDD9CE'],['OC-19','#E7E4D9'],['OC-23','#E3E0D7']]);
});
test('old wall experiments migrate to the agreed palette without losing furnishings', () => {
  const before = {version:4, flooring:'white', style:'coastal', rooms:{living:{wall:'navy',rug:'cream',layout:'side'},bath:{wall:'mist'}}, kitchen:{counter:'marble',peninsula:{length:48}}};
  const after = migrateDesign(before);
  assert.equal(after.version,5);
  assert.equal(after.rooms.living.wall,undefined);
  assert.equal(after.rooms.living.rug,'cream');
  assert.equal(after.rooms.living.layout,'side');
  assert.equal(after.flooring,'white');
  assert.equal(after.kitchen.counter,'marble');
  assert.equal(after.kitchen.peninsula.length,48);
  assert.equal(before.rooms.living.wall,'navy');
});
test('new wall edits persist and default design objects are independent', () => {
  assert.equal(migrateDesign({version:5,rooms:{living:{wall:'classicgray'}}}).rooms.living.wall,'classicgray');
  const first = migrateDesign(null), second = migrateDesign(null);
  first.kitchen.peninsula.stools = 0;
  assert.equal(second.kitchen.peninsula.stools,2);
  assert.equal(DEFAULT_DESIGN.kitchen.peninsula.stools,2);
});
