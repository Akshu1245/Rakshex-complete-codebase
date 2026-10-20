import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createP1P2Report, cmdApiEventImpact } from "./p1p2Bridge.js";

let dir:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),"rakshex-p1p2-"));});
afterEach(()=>{rmSync(dir,{force:true,recursive:true});});
function fixture(overrides:Record<string,unknown>={}){
  const before=JSON.stringify({openapi:"3.0.3",paths:{"/v1/widgets":{get:{responses:{200:{description:"ok"}}}}}});
  const after=JSON.stringify({openapi:"3.0.3",paths:{"/v2/widgets":{get:{responses:{200:{description:"ok"}}}}}});
  const old=join(dir,"old.json"),fresh=join(dir,"new.json"),eventFile=join(dir,"event.json"),src=join(dir,"source");
  mkdirSync(src,{recursive:true});writeFileSync(old,before);writeFileSync(fresh,after);
  writeFileSync(join(src,"confidential.ts"),'fetch("/v1/widgets");\nfetch(buildUrl());\n// PRIVATE_SOURCE_TOKEN');
  const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
  const e={schema_version:"change-event.v1",id:"synthetic-widgets",source_type:"synthetic",
    method:"GET",old_path:"/v1/widgets",new_path:"/v2/widgets",
    hashes:{algorithm:"SHA-256",old_spec:sha(before),new_spec:sha(after)},...overrides};
  writeFileSync(eventFile,JSON.stringify(e));
  return {old,fresh,eventFile,src};
}
describe("verified P1/P2 local bridge",()=>{
  it("scans verified specs locally and sanitises all source fields",()=>{
    const f=fixture(),r=createP1P2Report(f.eventFile,f.old,f.fresh,f.src);
    expect(r.schema).toBe("impact-report.v1");
    expect(r.privacy_mode).toBe(true);
    expect(r.spec_hashes_verified).toBe(true);
    expect(r.event_source).toBe("synthetic");
    expect(r.provider_authenticated).toBe(false);
    expect(r.metrics.candidate_matches).toBe(1);
    expect(r.findings.filter(x=>x.classification==="UNCERTAIN")).toHaveLength(1);
    expect(r.findings.some(x=>x.classification==="UNKNOWN")).toBe(true);
    expect(r.repair_allowed).toBe(false);
    const serialized=JSON.stringify(r);
    for(const forbidden of ["confidential.ts","PRIVATE_SOURCE_TOKEN","/v1/widgets","synthetic-widgets"])
      expect(serialized).not.toContain(forbidden);
  });
  it("rejects tampered spec bytes",()=>{
    const f=fixture();writeFileSync(f.fresh,JSON.stringify({openapi:"3.0.3",paths:{"/v2/widgets":{get:{responses:{200:{description:"modified but still valid"}}}}}}));
    expect(()=>createP1P2Report(f.eventFile,f.old,f.fresh,f.src)).toThrow("SHA-256 mismatch");
  });

  it("fails closed on an unverified provider claim even when local spec hashes match",()=>{
    const f=fixture({source_type:"provider"});
    expect(()=>createP1P2Report(f.eventFile,f.old,f.fresh,f.src))
      .toThrow(/Provider event not authenticated/);
  });
  it("rejects malicious path and unknown source",()=>{
    let f=fixture({old_path:"/v1/widgets\nnew: payload"});
    expect(()=>createP1P2Report(f.eventFile,f.old,f.fresh,f.src)).toThrow("Invalid P1");
    f=fixture({source_type:"user-supplied-unknown"});
    expect(()=>createP1P2Report(f.eventFile,f.old,f.fresh,f.src)).toThrow("Invalid P1");
  });
  it("rejects a claimed deletion if new spec retains the same operation",()=>{
    const f=fixture(),original=JSON.stringify({openapi:"3.0.3",paths:{"/v1/widgets":{get:{responses:{200:{description:"ok"}}}}}});
    writeFileSync(f.fresh,original);
    const e=JSON.parse(requireJson(f.eventFile));
    e.hashes.new_spec=createHash("sha256").update(original).digest("hex");
    writeFileSync(f.eventFile,JSON.stringify(e));
    expect(()=>createP1P2Report(f.eventFile,f.old,f.fresh,f.src)).toThrow("still present");
  });
  it("fails closed on missing input flags and never reports success",()=>{
    expect(cmdApiEventImpact(["event-impact","any.json","."],{})).toBe(2);
  });
});
function requireJson(path:string):string {
  // A separate helper avoids reading the private customer source path.
  return requireFixture(path);
}
import { readFileSync } from "node:fs";
function requireFixture(path:string):string{return readFileSync(path,"utf8");}
