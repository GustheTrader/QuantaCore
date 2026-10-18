import {readFileSync} from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const config=JSON.parse(readFileSync('C:/QuantaCore/.quanta/coding-agents/ideas/claude-mcp.json','utf8')).mcpServers.gnoesis;
const transport=new StdioClientTransport({...config,stderr:'ignore'});
const client=new Client({name:'gnoesis-connection-inspection',version:'1.0.0'});
try{
 await client.connect(transport);
 console.log('TOOLS', (await client.listTools()).tools.map(tool=>tool.name));
 const result=await client.callTool({name:'intelligence_overview',arguments:{}});
 const text=result.content.find(item=>item.type==='text')?.text;
 const overview=JSON.parse(text || '{}');
 console.log('LOCAL_CONNECTION',{isError:result.isError || false,space:overview.space,hermesConnected:overview.runtime?.connected,missionCount:overview.missions?.length});
}finally{await client.close();await transport.close();}
