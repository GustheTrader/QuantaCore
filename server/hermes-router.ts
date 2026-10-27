import { isLocalHost, isLoopbackSocket, sameOrigin, publicOrigin } from './local-access';
import express from 'express';
import { HermesManager } from './hermes-manager';
import { hermesSpace } from './hermes-space';
import { CodingAgents } from './coding-agents';
import { createClippingRouter } from './clipping-router';

export function createHermesRouter(manager: HermesManager, root: string) {
  const router = express.Router();
  const coding = new CodingAgents(root);
  router.use('/:workspace/clipping', createClippingRouter(root));
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!isLocalHost(req.hostname)
      || req.get('X-Quanta-Client') !== 'local-ui'
      || !isLoopbackSocket(req)
      || (origin && !sameOrigin(req))) {
      res.status(403).json({ error: { message: 'Use the local Gnoesis Hermes workspace.' } }); return;
    }
    next();
  });
  const route = (handler: (req: express.Request, res: express.Response) => Promise<void>) => async (req: express.Request, res: express.Response) => {
    try { await handler(req, res); } catch (error) { res.status(400).json({ error: { message: (error as Error).message } }); }
  };
  router.get('/:workspace/coding', route(async (req,res) => {
    hermesSpace(root,String(req.params.workspace));
    res.json({agents:coding.catalog(),sessions:coding.list(String(req.params.workspace))});
  }));
  router.post('/:workspace/coding', route(async (req,res) => { res.json(coding.start(String(req.params.workspace),req.body)); }));
  router.get('/:workspace/coding/auth-status', route(async (req,res) => {
    hermesSpace(root,String(req.params.workspace));
    res.json({agents:await coding.authentication()});
  }));
  router.get('/:workspace/coding/subscription-models', route(async (req,res) => {
    hermesSpace(root,String(req.params.workspace));
    res.json(await coding.subscriptionModels());
  }));
  router.post('/:workspace/coding/chat', route(async (req,res) => {
    hermesSpace(root,String(req.params.workspace));
    if (typeof req.body.prompt !== 'string' || !req.body.prompt.trim()) throw new Error('A chat prompt is required.');
    res.json(await coding.testSubscription(req.body.agent, req.body.model, req.body.prompt));
  }));
  router.post('/:workspace/coding/test-inference', route(async (req,res) => {
    hermesSpace(root,String(req.params.workspace));
    res.json(await coding.testSubscription(req.body.agent, req.body.model));
  }));
  router.get('/:workspace/coding/:id/output', route(async (req,res) => { res.json(coding.output(String(req.params.workspace),String(req.params.id),Number(req.query.after)||0)); }));
  router.post('/:workspace/coding/:id/input', route(async (req,res) => { coding.input(String(req.params.workspace),String(req.params.id),req.body.data);res.json({accepted:true}); }));
  router.post('/:workspace/coding/:id/resize', route(async (req,res) => {
    if(!Number.isFinite(req.body.cols)||!Number.isFinite(req.body.rows))throw new Error('Invalid terminal dimensions.');
    coding.resize(String(req.params.workspace),String(req.params.id),req.body.cols,req.body.rows);res.json({resized:true});
  }));
  router.post('/:workspace/coding/:id/stop', route(async (req,res) => { coding.stop(String(req.params.workspace),String(req.params.id));res.json({stopping:true}); }));
  router.get('/:workspace/coding/intelligence/:tool', route(async (req,res) => {
    const space=String(req.params.workspace);
    if(!coding.authorize(req.get('X-Gnoesis-Capability') || '',space)){res.status(403).json({error:{message:'Attach intelligence to an active coding session first.'}});return;}
    const store=hermesSpace(root,space);
    switch(req.params.tool){
      case 'intelligence_overview':res.json({runtime:await manager.status(),missions:store.missions().map((m:any)=>({id:m.id,title:m.title,status:m.status})),space});break;
      case 'space_memory':res.json({files:store.memory(),space});break;
      case 'space_files':res.json(store.files());break;
      case 'conversation_titles':res.json({conversations:manager.list(space).map(s=>({id:s.id,title:s.title,running:s.running})),space});break;
      case 'intelligence_services':{
        const response=await fetch(`http://127.0.0.1:${process.env.QUANTA_PORT || 3000}/api/memory/status`,{headers:{'X-Quanta-Client':'local-ui'},signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Local intelligence service status unavailable.');res.json(await response.json());break;
      }
      default:throw new Error('Unsupported intelligence capability.');
    }
  }));
  router.get('/status', route(async (_req, res) => { res.json(await manager.status()); }));
  router.get('/:workspace/missions', route(async (req, res) => { res.json({ missions: hermesSpace(root, String(req.params.workspace)).missions() }); }));
  router.post('/:workspace/missions', route(async (req, res) => { res.json({ missions: hermesSpace(root, String(req.params.workspace)).saveMission(req.body) }); }));
  router.get('/:workspace/memory', route(async (req, res) => { res.json({ files: hermesSpace(root, String(req.params.workspace)).memory() }); }));
  router.get('/:workspace/files', route(async (req, res) => { res.json(hermesSpace(root, String(req.params.workspace)).files(String(req.query.path || ''))); }));
  router.get('/:workspace/automations', route(async (req, res) => { res.json(await manager.workspaceRpc(req.params.workspace, 'cron.manage', { action: 'list', include_disabled: true })); }));
  router.post('/:workspace/automations', route(async (req, res) => {
    const { action, name, prompt, schedule } = req.body;
    if (!['add', 'pause', 'resume'].includes(action)) throw new Error('Unsupported automation action.');
    res.json(await manager.workspaceRpc(req.params.workspace, 'cron.manage', { action, name, prompt, schedule, deliver: 'local' }));
  }));
  router.get('/:workspace/connections', route(async (req, res) => { res.json(await manager.workspaceRpc(req.params.workspace, 'mcp.servers.status')); }));
  router.post('/start', route(async (_req, res) => { void manager.start().catch(error => console.error('Hermes startup:', error.message)); res.status(202).json({ starting: true }); }));
  router.get('/:workspace/sessions', route(async (req, res) => { res.json({ sessions: manager.list(req.params.workspace) }); }));
  router.post('/:workspace/sessions', route(async (req, res) => { res.json(await manager.create(req.params.workspace)); }));
  router.post('/:workspace/sessions/:id/messages', route(async (req, res) => { res.json(await manager.send(req.params.workspace, String(req.params.id), req.body.text)); }));
  router.post('/:workspace/sessions/:id/stop', route(async (req, res) => { res.json(await manager.stop(req.params.workspace, String(req.params.id))); }));
  router.post('/:workspace/sessions/:id/answer', route(async (req, res) => { await manager.answer(req.params.workspace, String(req.params.id), req.body.requestId, req.body.result); res.json({ answered: true }); }));
  router.post('/:workspace/sessions/:id/files', route(async (req, res) => { res.json(await manager.attach(req.params.workspace, String(req.params.id), req.body.name, req.body.data)); }));
  router.delete('/:workspace/sessions/:id', route(async (req, res) => { await manager.remove(req.params.workspace, String(req.params.id)); res.json({ removed: true }); }));
  return router;
}
