
// Compatibility API backed by local metadata events. No Langfuse SDK or outbound collector.
import {operatingRequest} from './operatingService';
export interface LangfuseTrace {id:string;name:string;status:'active'|'success'|'error';latency:number;model:string;custody:'local-only';persisted:boolean}
const traces=new Map<string,LangfuseTrace>();
function record(trace:LangfuseTrace,event:string,extra:Record<string,unknown>={}){
  if(typeof location==='undefined'||!['127.0.0.1','localhost','[::1]'].includes(location.hostname))return;
  void operatingRequest('/telemetry',{id:crypto.randomUUID(),correlationId:trace.id,event,name:'context-optimization',...extra}).then(()=>{trace.persisted=true;}).catch(()=>{trace.persisted=false;});
}
export const createTrace=(_name:string,_tags:string[]=[]):LangfuseTrace=>{
  const trace:LangfuseTrace={id:crypto.randomUUID(),name:'context-optimization',status:'active',latency:0,model:'unreported',custody:'local-only',persisted:false};
  if(traces.size>=100)traces.delete(traces.keys().next().value!);traces.set(trace.id,trace);record(trace,'trace.started');return trace;
};
export const updateTrace=(id:string,updates:Partial<LangfuseTrace>)=>{const trace=traces.get(id);if(!trace)return;trace.status=updates.status||trace.status;trace.latency=typeof updates.latency==='number'?updates.latency:trace.latency;record(trace,trace.status==='error'?'trace.error':'trace.completed',{latencyMs:trace.latency});};
export const scoreTrace=(id:string,name:string,value:number,_comment?:string)=>{const trace=traces.get(id);if(trace&&name==='structured-output-present')record(trace,'rule-score',{name,value});};
export const getPromptTemplate=(_name:string,_version?:number)=>{throw Error('No local versioned prompt registry is configured. Supply an explicitly reviewed instruction.');};
