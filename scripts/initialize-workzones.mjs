// Initialize the requested local organizations with paused workers and real setup briefs.
// This does not start model runs, record evaluation passes or submit trades.
const base='http://127.0.0.1:3000/api/work-zone';
async function request(zone,action,body){const r=await fetch(`${base}/${zone}/${action}`,{method:body===undefined?'GET':'POST',headers:{'X-Quanta-Client':'local-ui','Content-Type':'application/json'},signal:AbortSignal.timeout(60000),...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();if(!r.ok)throw new Error(value.error||`Workspace returned ${r.status}.`);return value;}
const build=[
 ['Work Lead','Coordinate the operator backlog, scope deliverables and require human review.','http',null],
 ['Builder','Implement scoped software changes from first principles, preserve user data and supply reviewable artifacts. Ask before major changes.','codex_local','Work Lead'],
 ['Quality Reviewer','Give deliverables a second look. Check correctness, security, evidence and acceptance criteria before operator approval.','http','Work Lead']
];
const trade=[
 ['QuantaTrade Desk Lead','Coordinate the SME trading-research desk. Preserve source provenance, assumptions and dissent. Financial execution remains with the operator.','http',null],
 ['Research Manager','Coordinate evidence analysis and bull/bear debate. Distinguish observations, assumptions and hypotheses.','http','QuantaTrade Desk Lead'],
 ['Portfolio Manager','Synthesize reviewed research and portfolio context. Record uncertainty and operator review. No broker execution.','http','QuantaTrade Desk Lead'],
 ['Market Analyst','Analyze observed market evidence with its source, date and limitations.','http','Research Manager'],
 ['News Analyst','Assess source-backed news and availability timestamps; avoid hindsight leakage.','http','Research Manager'],
 ['Fundamentals Analyst','Analyze company fundamentals and financial statements with provenance and explicit assumptions.','http','Research Manager'],
 ['Social Analyst','Assess sentiment evidence, its sample limitations and possible manipulation.','http','Research Manager'],
 ['Bull Researcher','Develop the strongest evidence-backed positive thesis and its falsification conditions.','http','Research Manager'],
 ['Bear Researcher','Challenge the thesis with an independent downside case and missing-evidence review.','http','Research Manager'],
 ['Trader · Research Plan','Draft a paper research plan with entry assumptions, invalidation conditions and execution-cost questions. No trade submission.','http','QuantaTrade Desk Lead'],
 ['Aggressive Risk Analyst','Challenge conservative assumptions while preserving downside constraints and uncertainty.','http','Portfolio Manager'],
 ['Conservative Risk Analyst','Assess concentration, loss scenarios, data gaps and execution costs.','http','Portfolio Manager'],
 ['Neutral Risk Analyst','Adjudicate risk disagreements without treating SME opinion as ground truth.','http','Portfolio Manager']
];
for(const [zone,workers] of [['build',build],['trade',trade]]){
 await request(zone,'provision',{});let state=await request(zone,'state');
 for(const [name,role,adapterType,parent] of workers){if(state.agents.some(a=>a.name===name))continue;const reportsTo=parent?state.agents.find(a=>a.name===parent)?.id:null;if(parent&&!reportsTo)throw new Error('Parent worker is missing.');await request(zone,'workers',{name,role,adapterType,reportsTo,budgetMonthlyCents:0});state=await request(zone,'state');console.log(`${zone}: onboarded ${name}`);}
 const title=zone==='build'?'Define digital worker acceptance and tool scopes':'Establish SME desk research acceptance and risk review';
 if(!state.tasks.some(t=>t.title===title))await request(zone,'tasks',{title,description:zone==='build'?'Review the new worker roles and reporting lines. Choose model and tool configurations in Paperclip; define acceptance cases, skill versions and evidence requirements. Keep workers paused until the operator approves their setup.':'Review stock-research evidence requirements, analyst responsibilities, bull/bear disagreement handling and risk review criteria. Preserve timestamped sources and assumptions. Define paper evaluation and operator decision gates; no broker execution.',agentId:state.agents.find(a=>a.name===workers[0][0]).id});
 if(!state.knowledge.some(n=>n.agentId==='master'&&n.title==='Operator work rules'))await request(zone,'knowledge',{agentId:'master',title:'Operator work rules',text:'Use first principles and source-backed evidence. Preserve timestamps, assumptions and disagreement. Give consequential conclusions a second look. Ask before major changes. Private worker KBs are separate from deliberately shared master knowledge. Harness setup and permissions require human review; no financial execution is granted.',source:'Quanta operator instructions and docs/OperatorWorkZone_QuantaTrade.md'});
 state=await request(zone,'state');console.log(`${zone}: ${state.agents.length} workers, ${state.tasks.length} planning tasks, ${state.reviews.length} evaluation reviews. ${state.agents.filter(a=>a.status==='paused').length} paused.`);
}
