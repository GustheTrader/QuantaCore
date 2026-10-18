import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({name:'gnoesis-local-intelligence',version:'1.0.0'});
const descriptions = {
  intelligence_overview:'Read local Hermes runtime health and mission summaries for the selected Gnoesis space.',
  space_memory:'Read the selected space Hermes memory. Only call when the user wants this context shared with this agent provider.',
  space_files:'List files in the selected Gnoesis space root.',
  conversation_titles:'List recent conversation titles and running states in the selected space, without transcripts.',
  intelligence_services:'Read availability of the local Hindsight and Honcho intelligence services, without querying stored memories.',
};
for(const [name,description] of Object.entries(descriptions)) server.registerTool(name,{description,annotations:{readOnlyHint:true,destructiveHint:false}},async()=>{
  const base=process.env.GNOESIS_BACKEND || 'http://127.0.0.1:3000';
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Local backend required.');
  const response=await fetch(`${base}/api/hermes/${encodeURIComponent(process.env.GNOESIS_SPACE || '')}/coding/intelligence/${name}`,{headers:{'X-Quanta-Client':'local-ui','X-Gnoesis-Capability':process.env.GNOESIS_BRIDGE_CAPABILITY || ''},signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok)return {isError:true,content:[{type:'text',text:result.error?.message || 'Intelligence connection unavailable.'}]};
  return {content:[{type:'text',text:JSON.stringify(result)}]};
});
await server.connect(new StdioServerTransport());
