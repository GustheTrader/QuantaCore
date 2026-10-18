import {LostAssetsStore} from '../server/lost-assets-store';
import path from 'node:path';
const options:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2)options[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
const store=new LostAssetsStore(path.resolve(options.root||process.cwd()));
await store.configure({duckdbPath:options.duckdb||store.config().duckdbPath,csvPath:options.csv||'',archivePath:options.archive||'',workbooks:{'051_250':options.workbook051||'','251_500':options.workbook251||''}});
if(options.csv){await store.connectCsv();console.log(JSON.stringify({connected:'master-csv',mode:'read-only-file-view'}));}
if(options.archive){await store.connectArchive();console.log(JSON.stringify({connected:'priority-archive',parts:store.sources().find(source=>source.id==='priority-archive')?.files?.length}));}
for(const slot of ['051_250','251_500'] as const)if(store.config().workbooks[slot]){await store.importWorkbook(slot);console.log(JSON.stringify({connected:'workbook-'+slot,counts:store.sources().find(source=>source.id==='workbook-'+slot)?.rowCounts}));}
console.log(JSON.stringify({complete:true,tables:store.status().tables,sourceCount:store.sources().length}));
