/**
 * P1 change-event.v1 -> existing RaksHex TypeScript call-site engine.
 * Offline, no new scanner runtime, no API calls, no automatic fixes.
 * Output is an allowlisted privacy-safe impact-report.v1.
 */
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { analyzeApiImpact } from "./apiImpact.js";

const METHODS = new Set(["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]);
const PATH = /^\/[a-zA-Z0-9._~{}/-]{1,250}$/;
type Obj = Record<string, unknown>;
function object(x:unknown): x is Obj { return !!x && typeof x === "object" && !Array.isArray(x); }
function safePath(x:unknown): x is string {
  return typeof x === "string" && PATH.test(x) && !x.includes("..") && !x.includes("//") && !x.includes("\\");
}
/**
 * Read only a stable regular-file descriptor, never a symlink target.
 * A pre-read size check alone is insufficient: another process can swap or
 * extend a file between lstat and readFile, bypassing the cap.
 */
function bytes(file:string, cap:number):Buffer {
  const initial=lstatSync(file);
  if(!initial.isFile() || initial.size>cap)
    throw new Error("Invalid local input file");
  // O_NOFOLLOW prevents replacing a regular file with a final-component
  // symlink on POSIX. The inode/device check also catches a regular-file swap
  // and protects platforms without O_NOFOLLOW.
  const fd=openSync(file,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const actual=fstatSync(fd);
    if(!actual.isFile() || actual.size>cap ||
       actual.dev!==initial.dev || actual.ino!==initial.ino)
      throw new Error("Invalid local input file");
    const chunks:Buffer[]=[];
    let total=0;
    while(true) {
      // Read one extra byte to detect files that grow after the fstat check.
      const chunk=Buffer.allocUnsafe(Math.min(64*1024,cap-total+1));
      const count=readSync(fd,chunk,0,chunk.length,null);
      if(count===0) break;
      total+=count;
      if(total>cap) throw new Error("Invalid local input file");
      chunks.push(chunk.subarray(0,count));
    }
    return Buffer.concat(chunks,total);
  } finally {
    closeSync(fd);
  }
}
function spec(file:string):{data:Obj,raw:Buffer}{
  const raw=bytes(file,32*1024*1024);
  let data:unknown;
  try {
    const ext=extname(file).toLowerCase();
    if(ext===".json") data=JSON.parse(raw.toString("utf8"));
    else if(ext===".yaml"||ext===".yml") data=parseYaml(raw.toString("utf8"),{uniqueKeys:true});
    else throw new Error("extension");
  } catch {throw new Error("Unable to parse local OpenAPI file");}
  if(!object(data)||typeof data.openapi!=="string"||!/^3\.[01](?:\.|$)/.test(data.openapi)||!object(data.paths))
    throw new Error("Invalid OpenAPI 3.0/3.1 document");
  return {data,raw};
}
function hasOperation(doc:Obj,path:string,method:string):boolean {
  const entry=(doc.paths as Obj)[path];
  return object(entry)&&object(entry[method.toLowerCase()]);
}
export interface PrivacyImpactFinding {
  classification:"UNCERTAIN"|"UNKNOWN";
  rule_id:"api-change-candidate"|"dynamic-call";
}
export interface PrivacyImpactReport {
  schema:"impact-report.v1";
  privacy_mode:true;
  spec_hashes_verified:true;
  scanner:{tool:"rakshex-ts-ast",evidence:"candidate-only"};
  findings:PrivacyImpactFinding[];
  metrics:{files_scanned:number,calls_inspected:number,dynamic_calls:number,parse_errors:number,candidate_matches:number,changes_without_matches:number};
  repair_allowed:false;
  limitations:string[];
}
export function createP1P2Report(eventFile:string,oldFile:string,newFile:string,sourceDirectory:string):PrivacyImpactReport{
  let e:unknown;
  try {e=JSON.parse(bytes(eventFile,256*1024).toString("utf8"));}
  catch {throw new Error("Invalid change event JSON");}
  if(!object(e)||e.schema_version!=="change-event.v1"||
     typeof e.id!=="string"|| !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(e.id)||
     !["synthetic","provider"].includes(String(e.source_type))||
     typeof e.method!=="string"||!METHODS.has(e.method)||
     !safePath(e.old_path)||(e.new_path!==undefined&&!safePath(e.new_path)))
    throw new Error("Invalid P1 change-event.v1");
  const hashes=e.hashes;
  if(!object(hashes)||hashes.algorithm!=="SHA-256"||
     !["old_spec","new_spec"].every(k=>typeof hashes[k]==="string"&&/^[0-9a-f]{64}$/.test(hashes[k] as string)))
    throw new Error("Invalid specification hashes");
  const oldSpec=spec(oldFile),newSpec=spec(newFile);
  const sha=(x:Buffer)=>createHash("sha256").update(x).digest("hex");
  if(sha(oldSpec.raw)!==hashes.old_spec||sha(newSpec.raw)!==hashes.new_spec)
    throw new Error("SHA-256 mismatch");
  if(!hasOperation(oldSpec.data,e.old_path,e.method))
    throw new Error("Old API operation not present in verified spec");
  if(hasOperation(newSpec.data,e.old_path,e.method))
    throw new Error("Old API operation still present in new spec");
  const impact=analyzeApiImpact(sourceDirectory,[{id:e.id,kind:"operation_removed",method:e.method,path:e.old_path}]);
  const findings:PrivacyImpactFinding[]=impact.matches.slice(0,2000).map(()=>({classification:"UNCERTAIN",rule_id:"api-change-candidate"}));
  for(let i=0;i<Math.min(impact.dynamicCalls,2000-findings.length);i++)
    findings.push({classification:"UNKNOWN",rule_id:"dynamic-call"});
  return {
    schema:"impact-report.v1",privacy_mode:true,spec_hashes_verified:true,
    scanner:{tool:"rakshex-ts-ast",evidence:"candidate-only"},
    findings,
    metrics:{
      files_scanned:impact.filesScanned,calls_inspected:impact.callsInspected,
      dynamic_calls:impact.dynamicCalls,parse_errors:impact.parseErrors,
      candidate_matches:impact.matches.length,changes_without_matches:impact.changesWithoutMatches
    },
    repair_allowed:false,
    limitations:[
      "Candidate call sites are not proof of breakage.",
      "Dynamic calls, wrappers and unknown usage can be missed; zero matches is not a safety approval.",
      "Hashes verify the provided local specs, not the authenticity of an API provider.",
      "No repair, repository write, upload or production rollout is authorised."
    ]
  };
}
export function cmdApiEventImpact(positional:string[], flags:Record<string,string|boolean>):number {
  if(positional.length!==3||positional[0]!=="event-impact"||
     typeof flags["old-spec"]!=="string"||typeof flags["new-spec"]!=="string"||
     (flags.format!==undefined&&flags.format!=="json")||
     Object.keys(flags).some(k=>!["old-spec","new-spec","format"].includes(k))) {
    console.error("Usage: rakshex api event-impact <event.json> <source-dir> --old-spec <old.yaml> --new-spec <new.yaml> [--format json]");
    return 2;
  }
  try {
    const result=createP1P2Report(positional[1]!,flags["old-spec"],flags["new-spec"],positional[2]!);
    console.log(JSON.stringify(result,null,2));
    return 0; // Success means a candidate report was generated; NEVER approval to deploy.
  } catch {
    console.error("event-impact: local validation or analysis failed; no report generated");
    return 2;
  }
}
