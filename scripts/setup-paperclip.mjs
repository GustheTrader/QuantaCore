import { getLocalSecrets, saveLocalSecrets } from './protected-secrets.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base='http://127.0.0.1:3210';
const dir=new URL('../.quanta/',import.meta.url);
mkdirSync(dir,{recursive:true});
const secrets=await getLocalSecrets();
const credentials=secrets.paperclipAuth || {email:'quanta-local-operator@localhost.test',password:randomBytes(32).toString('base64url')};
secrets.paperclipAuth=credentials; secrets.paperclipServerSecret ||= randomBytes(48).toString('hex');
await saveLocalSecrets(secrets);
if(process.argv.includes('--prepare')){console.log('Paperclip server credentials prepared in the protected credential store; values withheld.');process.exit(0);}
let cookie='';
async function request(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}); const cookies=response.headers.getSetCookie();if(cookies.length)cookie=cookies.map(c=>c.split(';')[0]).join('; ');const result=await response.json();if(!response.ok)throw new Error(`Paperclip setup returned ${response.status} at ${path.split('/').slice(0,4).join('/')}.`);return result;}
const configure = `import fs from 'node:fs'; import {paperclipConfigSchema} from './packages/shared/src/config-schema.ts'; const file='/paperclip/instances/default/config.json'; if(!fs.existsSync(file)){ const config=paperclipConfigSchema.parse({ $meta:{version:1,updatedAt:new Date().toISOString(),source:'configure'},database:{mode:'embedded-postgres',embeddedPostgresDataDir:'/paperclip/instances/default/db',embeddedPostgresPort:54329,backup:{dir:'/paperclip/instances/default/data/backups'}},logging:{mode:'file',logDir:'/paperclip/instances/default/logs'},server:{deploymentMode:'authenticated',exposure:'private',bind:'lan',host:'0.0.0.0',port:3210,allowedHostnames:['127.0.0.1','localhost'],serveUi:true},auth:{baseUrlMode:'explicit',publicBaseUrl:'http://127.0.0.1:3210',disableSignUp:false},telemetry:{enabled:false},updates:{checkEnabled:false},storage:{provider:'local_disk',localDisk:{baseDir:'/paperclip/instances/default/data/storage'}},secrets:{provider:'local_encrypted',localEncrypted:{keyFilePath:'/paperclip/instances/default/secrets/master.key'}}}); fs.mkdirSync('/paperclip/instances/default',{recursive:true});fs.writeFileSync(file,JSON.stringify(config,null,2)); }`;
try { execFileSync('docker',['exec','-u','node','quanta-paperclip','node','--import','./server/node_modules/tsx/dist/loader.mjs','--input-type=module','-e',configure],{encoding:'utf8',timeout:300000,maxBuffer:1024*1024}); } catch { throw new Error('Paperclip configuration initialization failed; private output withheld.'); }
let health;
const startupKeepAlive=setInterval(()=>{},1000);
const startupDeadline=Date.now()+300000;
while(!health){
 try{health=await request('/api/health');}catch{
  if(Date.now()>startupDeadline)throw new Error('Paperclip is not ready on port 3210. Inspect its local startup logs.');
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
}
clearInterval(startupKeepAlive);
try{await request('/api/auth/sign-in/email',credentials);}catch{await request('/api/auth/sign-up/email',{...credentials,name:'Quanta Local Operator'});}
if(health.bootstrapStatus!=='ready'){
 let output=''; try { output=execFileSync('docker',['exec','-u','node','quanta-paperclip','node','--import','./cli/node_modules/tsx/dist/loader.mjs','cli/src/index.ts','auth','bootstrap-ceo','--data-dir','/paperclip','--base-url',base],{encoding:'utf8',timeout:300000,maxBuffer:1024*1024}); } catch(error) { output=typeof error.stdout==='string'?error.stdout:''; if(!output.includes('/invite/pcp_bootstrap_')) throw new Error('Paperclip bootstrap CLI failed. Its private output was withheld.'); }
 const token=output.match(/\/invite\/(pcp_bootstrap_[a-zA-Z0-9]+)/)?.[1];if(!token)throw new Error('Paperclip CLI did not return a bootstrap invite.');
 await request(`/api/invites/${token}/accept`,{requestType:'human'});
}
await request('/api/companies');
console.log('Authenticated Paperclip local operator is ready. Credentials and session withheld.');


