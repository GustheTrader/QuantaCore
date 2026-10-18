import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wrapper = fileURLToPath(new URL('./gemini-sign-in.mjs', import.meta.url));
async function runFixture(authMethods, requestFiles = false, advertiseUrl = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'quanta-gemini-sign-in-test-'));
  const entry = path.join(root, 'fixture.mjs'), record = path.join(root, 'requests.json'), link = path.join(root, 'authorize.json');
  const authorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A12345%2Foauth2callback&response_type=code&state=public-test-state';
  writeFileSync(entry, `import {createInterface} from 'node:readline';
import {writeFileSync,readFileSync} from 'node:fs';
const messages=[]; const record=${JSON.stringify(record)};
const reply=(message)=>console.log(JSON.stringify({jsonrpc:'2.0',...message}));
createInterface({input:process.stdin}).on('line',line=>{
 const message=JSON.parse(line); messages.push(message); writeFileSync(record,JSON.stringify(messages));
 if(message.method==='initialize')reply({id:message.id,result:{protocolVersion:1,authMethods:${JSON.stringify(authMethods)}}});
 if(message.method==='authenticate'){
  if(${requestFiles})reply({id:99,method:'fs/read_text_file',params:{path:'private-file'}});
  if(${advertiseUrl}){console.error(${JSON.stringify(authorizeUrl)});setTimeout(()=>{const saved=JSON.parse(readFileSync(${JSON.stringify(link)},'utf8'));writeFileSync(${JSON.stringify(path.join(root,'observed-link.json'))},JSON.stringify(saved));reply({id:message.id,result:{}});},250);}
  else if(!${requestFiles})reply({id:message.id,result:{}});
 }
 if(message.id===99&&message.error)reply({id:2,result:{}});
});`);
  const child = spawn(process.execPath, [wrapper, entry, link], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const timeout = setTimeout(() => child.kill(), 30000);
  try {
    const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
    return { code, output, messages: JSON.parse(readFileSync(record,'utf8')), remainingLink: existsSync(link), observedLink: existsSync(path.join(root,'observed-link.json')) ? JSON.parse(readFileSync(path.join(root,'observed-link.json'),'utf8')) : undefined };
  } finally {
    clearTimeout(timeout); child.kill();
    const absolute = path.resolve(root), temp = path.resolve(os.tmpdir());
    if (path.dirname(absolute) === temp && path.basename(absolute).startsWith('quanta-gemini-sign-in-test-')) rmSync(absolute, { recursive: true, force: true });
  }
}

test('Google sign-in negotiates the advertised OAuth method and never creates a session or prompt', async () => {
  const result = await runFixture([{id:'oauth-personal',name:'Google'}], false, true);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(result.messages.map(m => m.method), ['initialize','authenticate']);
  assert.deepEqual(result.messages[1].params, {methodId:'oauth-personal'});
  assert.equal(new URL(result.observedLink.authorizeUrl).hostname, 'accounts.google.com');
  assert.equal(result.remainingLink, false);
});

test('The authentication client denies file access rather than approving tools', async () => {
  const result = await runFixture([{id:'oauth-personal',name:'Google'}], true);
  assert.equal(result.code, 0);
  assert.equal(result.messages.find(m => m.id === 99).error.code, -32601);
  assert.doesNotMatch(result.output, /private-file/);
});

test('Missing or terminal-only Google methods stop without requesting authentication', async () => {
  for (const methods of [[], [{id:'oauth-personal',type:'terminal',name:'Google'}]]) {
    const result = await runFixture(methods);
    assert.equal(result.code, 1, result.output);
    assert.deepEqual(result.messages.map(m => m.method), ['initialize']);
  }
});
