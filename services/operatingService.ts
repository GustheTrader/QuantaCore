import type { OperatingSnapshot } from '../lib/operating-contract';
export type { OperatingSnapshot } from '../lib/operating-contract';
export async function operatingRequest<T=any>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api/evidence${path}`,{method:body===undefined?'GET':'POST',headers:{'X-Quanta-Client':'local-ui',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:signal||AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>null);if(!response.ok||!data)throw Error(data?.error?.message||'The local evidence API is unavailable. Open the updated QuantaCore server.');return data;
}
export const loadOperatingSnapshot=(signal?:AbortSignal)=>operatingRequest<OperatingSnapshot>('/snapshot',undefined,signal);
export const correlationHeaders=(correlationId=crypto.randomUUID())=>({'X-Quanta-Correlation-ID':correlationId});
