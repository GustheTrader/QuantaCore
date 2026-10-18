import test from 'node:test';
import assert from 'node:assert/strict';
import { composeInterview, type CompositionInterview } from './composability-copilot';
import { defaultSystemSetup, setupInstructions } from './system-setup';
const basic: CompositionInterview = {goal:'Help me plan the week',preset:'everyday',jobs:['plan','draft'],sources:'paste',workingStyle:'draft',qsReadOnly:false,evidenceDashboard:false};
test('copilot prepares a small proposal without mutating the saved plan or inventing a model',()=>{
  const base=defaultSystemSetup(),before=JSON.stringify(base),{plan}=composeInterview(base,basic);
  assert.equal(JSON.stringify(base),before);assert.equal(plan.level,'starter');assert.equal(plan.mode,'chat');assert.deepEqual(plan.moduleIds,[]);assert.equal(plan.jobIds.length,2);assert.equal(plan.provider,undefined);assert.equal(plan.model,undefined);
});
test('advanced source and tool choices select only explicit modules and retain the chosen route',()=>{
  const base={...defaultSystemSetup(),provider:'local' as const,model:'unit-fixture'};
  const {plan,reasons}=composeInterview(base,{...basic,sources:'memory',workingStyle:'tools',evidenceDashboard:true});
  assert.equal(plan.level,'custom');assert.deepEqual(new Set(plan.moduleIds),new Set(['sources','memory','hermes','operating-evidence']));assert.equal(plan.model,'unit-fixture');assert.ok(reasons.some(r=>r.includes('permissions')||r.includes('approved')));
});
test('QS selection is research-only, explicit and limited to the trading purpose',()=>{
  assert.ok(!composeInterview(defaultSystemSetup(),{...basic,qsReadOnly:true}).plan.moduleIds.includes('qs-bridge'));
  const {plan}=composeInterview(defaultSystemSetup(),{...basic,preset:'markets',qsReadOnly:true});assert.ok(plan.moduleIds.includes('qs-bridge'));assert.match(setupInstructions(plan),/paper|research/i);
});
