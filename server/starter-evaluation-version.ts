import {readFileSync} from 'node:fs';
import path from 'node:path';
import {evidenceHash,textHash} from './operating-evidence';
export const STARTER_RUNNER_FILES=['scripts/evaluate-starter.ts','lib/starter-workflow.ts','lib/starter-evaluation.ts','lib/operating-contract.ts','server/production-adapter.ts','server/starter-evaluation-version.ts'] as const;
export const starterRunnerHashes=(root:string)=>Object.fromEntries(STARTER_RUNNER_FILES.map(file=>[file,textHash(readFileSync(path.join(root,file)))]));
export const starterRunnerHash=(root:string)=>evidenceHash(starterRunnerHashes(root));
