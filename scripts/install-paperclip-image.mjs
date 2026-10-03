import { mkdirSync, writeFileSync, existsSync, statSync, createWriteStream, createReadStream, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve('.quanta/paperclip-image');mkdirSync(path.join(root,'blobs/sha256'),{recursive:true});
const repo='https://ghcr.io/v2/paperclipai/paperclip';
const tokenResponse=await fetch('https://ghcr.io/token?service=ghcr.io&scope=repository:paperclipai/paperclip:pull',{signal:AbortSignal.timeout(30000)});
const {token}=await tokenResponse.json();const headers={Authorization:'Bearer '+token};
const accept='application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';
async function manifest(ref){const response=await fetch(repo+'/manifests/'+ref,{headers:{...headers,Accept:accept},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Registry manifest returned '+response.status);const buffer=Buffer.from(await response.arrayBuffer());const digest='sha256:'+createHash('sha256').update(buffer).digest('hex');return {buffer,digest,value:JSON.parse(buffer)};}
let selected=await manifest('latest');if(selected.value.manifests){const child=selected.value.manifests.find(m=>m.platform?.architecture==='amd64'&&m.platform?.os==='linux');if(!child)throw new Error('No Linux AMD64 image.');selected=await manifest(child.digest);if(selected.digest!==child.digest)throw new Error('Manifest digest mismatch.');}
writeFileSync(path.join(root,'blobs/sha256',selected.digest.slice(7)),selected.buffer);
const descriptors=[selected.value.config,...selected.value.layers];
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
let complete=0;
async function blob(descriptor){const digest=descriptor.digest.slice(7),file=path.join(root,'blobs/sha256',digest);if(existsSync(file)&&statSync(file).size===descriptor.size&&await hashFile(file)===digest){complete++;console.log(`Verified cached blob ${complete}/${descriptors.length}`);return;}
for(let attempt=1;attempt<=3;attempt++){
 try {
  let offset=existsSync(file+'.part')?statSync(file+'.part').size:0;
  if(offset>descriptor.size)throw new Error('Blob partial exceeds expected size.');
  while(offset<descriptor.size){
   const last=Math.min(offset+32*1024*1024-1,descriptor.size-1);
   const response=await fetch(repo+'/blobs/'+descriptor.digest,{headers:{...headers,Range:'bytes='+offset+'-'+last,'Accept-Encoding':'identity'},signal:AbortSignal.timeout(180000)});
   if(!response.ok||!response.body)throw new Error('Blob status '+response.status);
   if(response.status!==206&&offset!==0){await response.body.cancel();throw new Error('Blob server did not honor resume range.');}
   const range=response.headers.get('content-range');
   if(response.status===206&&range!=='bytes '+offset+'-'+last+'/'+descriptor.size){await response.body.cancel();throw new Error('Blob range mismatch.');}
   await pipeline(Readable.fromWeb(response.body),createWriteStream(file+'.part',{flags:offset?'a':'w'}));
   offset=statSync(file+'.part').size;
   if(response.status===206&&offset!==last+1)throw new Error('Blob range size mismatch.');
   console.log('Blob progress '+Math.round(offset/1024/1024)+' / '+Math.round(descriptor.size/1024/1024)+' MB');
  }
  if(await hashFile(file+'.part')!==digest)throw new Error('Blob digest mismatch.');
  renameSync(file+'.part',file);complete++;console.log('Verified blob '+complete+'/'+descriptors.length);return;
 }catch(error){console.log('Blob attempt failed: '+JSON.stringify({blob:digest.slice(0,12),name:error.name,code:error.cause?.code,reason:/^Blob /.test(error.message)?error.message:undefined}));if(attempt===3)throw new Error('Official image transfer failed after three attempts. No image imported.');}
}
}
let cursor=0;await Promise.all([0,1].map(async()=>{while(cursor<descriptors.length){const d=descriptors[cursor++];await blob(d);}}));
writeFileSync(path.join(root,'oci-layout'),JSON.stringify({imageLayoutVersion:'1.0.0'}));
writeFileSync(path.join(root,'index.json'),JSON.stringify({schemaVersion:2,manifests:[{mediaType:selected.value.mediaType,digest:selected.digest,size:selected.buffer.length,annotations:{'org.opencontainers.image.ref.name':'ghcr.io/paperclipai/paperclip:latest'}}]}));
console.log('Creating verified OCI archive.');
execFileSync('tar.exe',['-cf',path.resolve('.quanta/paperclip-image.tar'),'-C',root,'oci-layout','index.json','blobs'],{stdio:'inherit'});
console.log('Importing into Docker.');execFileSync('docker',['load','-i',path.resolve('.quanta/paperclip-image.tar')],{stdio:'inherit'});
writeFileSync(path.resolve('.quanta/paperclip-image-digest.txt'),selected.digest);
console.log('Paperclip image imported: '+selected.digest);
