import {useEffect,useRef,useState} from 'react';
export function ProviderWebTabs({workspace}:{workspace:string}){
 const [provider,setProvider]=useState('chatgpt');const region=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
 const bridge=(window as unknown as {hermesBrowser?:{request:(request:unknown)=>Promise<void>}}).hermesBrowser;
 const bounds=()=>{const rect=region.current?.getBoundingClientRect();return rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:undefined;};
 useEffect(()=>{
  if(!bridge||!region.current)return;
  void bridge.request({action:'open',provider,space:workspace,bounds:bounds()}).catch(cause=>setError(cause.message));
  const update=()=>void bridge.request({action:'bounds',provider,space:workspace,bounds:bounds()}).catch(()=>{});
  const observer=new ResizeObserver(update);observer.observe(region.current);window.addEventListener('resize',update);document.addEventListener('scroll',update,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);document.removeEventListener('scroll',update,true);void bridge.request({action:'hide'});};
 },[provider,workspace]);
 return <section className="h-provider-web"><div className="h-tabs">{[['chatgpt','ChatGPT / Work'],['claude','Claude'],['gemini','Gemini'],['grok','Grok']].map(([id,label])=><button key={id} aria-pressed={provider===id} onClick={()=>setProvider(id)}>{label}</button>)}{bridge&&<><button onClick={()=>void bridge.request({action:'back',provider,space:workspace})}>← Back</button><button onClick={()=>void bridge.request({action:'reload',provider,space:workspace})}>Reload</button></>}</div>{error&&<p role="alert">{error}</p>}<div ref={region} style={{height:650,minHeight:400,marginTop:12,borderRadius:12,background:'#081125'}}>{!bridge&&<div className="h-empty"><h3>Open Hermes Desktop for embedded websites</h3><p>The native desktop window hosts the full provider websites with separate persistent sign-in for each space. This browser version cannot host those native views.</p><p>Launch: C:\QuantaCore\scripts\start-hermes-desktop.ps1</p></div>}</div><p>Provider web sign-in is separate from CLI sign-in. Websites do not gain access to local intelligence simply by being embedded. Downloads and device permissions are disabled in this initial browser surface.</p></section>;
}
