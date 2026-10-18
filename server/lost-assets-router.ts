import express, { type Response } from 'express';
import { LostAssetsStore, type WorkbookSlot } from './lost-assets-store';
const localHosts=new Set(['127.0.0.1','localhost','[::1]','::1']);
const fail=(res:Response,error:unknown,status=400)=>res.status(status).json({error:{message:error instanceof Error?error.message:'Local data operation failed.'}});

export function createLostAssetsRouter(root=process.cwd()){
  const router=express.Router(),store=new LostAssetsStore(root);
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    const origin=req.get('origin');
    if(!localHosts.has(req.hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||(origin&&origin!==req.protocol+'://'+req.get('host'))||req.get('Sec-Fetch-Site')==='cross-site')return fail(res,new Error('Local application access required.'),403);
    next();
  });
  router.use('/app',(_req,res,next)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    next();
  },express.static(store.appDirectory,{index:'index.html',fallthrough:false}));
  router.use((req,res,next)=>req.get('X-Quanta-Client')==='local-ui'?next():fail(res,new Error('Local UI client header required.'),403));
  router.get('/status',(_req,res)=>res.json(store.status()));
  router.get('/config',(_req,res)=>res.json(store.config()));
  router.put('/config',async(req,res)=>{try{res.json({saved:true,config:await store.configure(req.body)});}catch(error){fail(res,error);}});
  const start=(kind:'csv'|'archive'|'workbook')=>(req:express.Request,res:Response)=>{
    if(store.status().searchPaused)return fail(res,new Error('Wait for the current connection to finish.'),409);
    const slot=(req.params.slot||req.body?.slot) as WorkbookSlot;
    const operation=kind==='csv'?store.connectCsv():kind==='archive'?store.connectArchive():store.importWorkbook(slot);
    void operation.catch(()=>{});res.status(202).json({started:true,kind});
  };
  router.post(['/connect/csv','/import/csv'],start('csv'));
  router.post('/connect/archive',start('archive'));
  router.post(['/import/workbook','/import/workbook/:slot'],start('workbook'));
  router.post('/search',async(req,res)=>{try{const query=typeof req.body?.query==='string'?req.body.query:'';res.json({query,results:await store.search(query,req.body?.scope||'priority')});}catch(error){fail(res,error,503);}});
  router.get('/prepared',async(_req,res)=>{try{res.json({groups:await store.prepared()});}catch(error){fail(res,error,503);}});
  router.post('/la-plus/search',async(req,res)=>{
    try{
      const input=req.body||{};
      const records=await store.records({search:[input.firstName,input.lastName].filter(Boolean).join(' '),state:input.targetState,highValue:input.generalHighValue,limit:input.resultLimit,scope:input.scope});
      const assets=records.map(row=>({id:'duckdb-'+row.state_id,name:row.first_name,address:row.location,state:row.state,type:row.property_type,holderCompany:row.company,amount:row.amount,stateId:row.state_id,categoryTitle:row.category_title,subType:row.sub_type,source:row.source}));
      res.json({assets,source:'local-duckdb',synthetic:false});
    }catch(error){fail(res,error,503);}
  });
  router.post('/la-plus/relatives',(_req,res)=>res.json({relatives:[],source:'local-workbook-evidence',message:'No verified person-to-property relationship has been selected. Use the imported Person Records, Asset Person Links and Evidence Log in Quanta.',synthetic:false}));
  router.get(['/la-plus/records','/la-plus/duckdb/records'],async(req,res)=>{
    try{res.json(await store.records({search:String(req.query.search||''),state:String(req.query.state||''),scope:String(req.query.scope||'priority'),limit:Number(req.query.limit)||100}));}catch(error){fail(res,error,503);}
  });
  router.get('/la-plus/status',(_req,res)=>res.json(store.status()));
  router.use('/la-plus',(_req,res)=>fail(res,new Error('This local LA Plus integration supports DuckDB records, local case drafts and workbook evidence. External scraping, cloud reasoning and agent execution require separate configuration.'),501));
  return router;
}
