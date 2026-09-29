import fs from 'node:fs';
const schema=JSON.parse(fs.readFileSync(new URL('../contracts/research.schema.json',import.meta.url),'utf8'));
const typescript=(s)=>{
 if(s.$ref)return s.$ref.split("/").at(-1);
 if(s.anyOf)return s.anyOf.map(typescript).join(" | ");
 if(s.const!==undefined)return JSON.stringify(s.const);
 if(s.enum)return s.enum.map(x=>JSON.stringify(x)).join(" | ");
 if(Array.isArray(s.type))return s.type.map(type=>typescript({...s,type})).join(" | ");
 if(s.type==="string")return"string";
 if(s.type==="number"||s.type==="integer")return"number";
 if(s.type==="boolean")return"boolean";
 if(s.type==="null")return"null";
 if(s.type==="array")return`Array<${typescript(s.items)}>`;
 if(s.type==="object"){if(!s.properties)return s.additionalProperties===true?"Record<string, unknown>":`Record<string, ${typescript(s.additionalProperties)}>`;
 return "{\n"+Object.entries(s.properties).map(([k,v])=>`  ${k}${s.required?.includes(k)?"":"?"}: ${typescript(v)};`).join("\n")+"\n}";}
 throw Error("Unsupported schema");
};
const output="// Generated from contracts/research.schema.json. Run npm run research:types; do not edit.\n"+Object.entries(schema.$defs).map(([name,definition])=>`export type ${name} = ${typescript(definition)};\n`).join('\n');
fs.writeFileSync(new URL('../lib/research-contract.ts',import.meta.url),output);
