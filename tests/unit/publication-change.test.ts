import { describe, it, expect } from 'vitest';
import { isPendingCandidateOnly } from '../../scripts/publication-change';
describe('production deployment ownership', () => {
  it('defers a single unpromoted incident or weekly candidate to its trusted publisher', () => {
    expect(isPendingCandidateOnly(['data/candidates/editions/2026-11-15.json'])).toBe(true);
    expect(isPendingCandidateOnly(['data/candidates/incidents/reported-incident.json'])).toBe(true);
  });
  it.each([[], ['data/production/editions/2026-11-15.json'], ['data/candidates/editions/2026-11-15.json', 'src/lib/content.ts'], ['data/candidates/editions/2026-11-15.json', 'data/production/newsletter-reviews/2026-11-15.json'], ['.github/workflows/weekly-newsletter.yml'], ['data/candidates/editions/../../production/editions/2026-11-15.json']].map(paths => ({ paths })))('never suppresses deployment for production/code changes: $paths', ({ paths }) => {
    expect(isPendingCandidateOnly(paths)).toBe(false);
  });
});
it('feeds the actual candidate-only git diff into the workflow output',async()=>{
 const {execFileSync}=await import('node:child_process');const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');const{tmpdir}=await import('node:os');const{join,resolve}=await import('node:path');
 const root=mkdtempSync(join(tmpdir(),'tsd-deploy-owner-test-'));
 const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null'}}).trim();
 try{
  git('init','--quiet');git('config','user.name','Unit Test');git('config','user.email','unit-test@example.invalid');writeFileSync(join(root,'README.md'),'Unit-test repo');git('add','.');git('commit','--quiet','-m','test base');const base=git('rev-parse','HEAD');
  mkdirSync(join(root,'data/candidates/editions'),{recursive:true});writeFileSync(join(root,'data/candidates/editions/2026-11-15.json'),'{}');git('add','.');git('commit','--quiet','-m','test pending candidate');const candidate=git('rev-parse','HEAD');const output=join(root,'github-output');
  const run=(before:string,head:string)=>execFileSync(process.execPath,['--import','tsx',resolve('scripts/publication-change.ts')],{encoding:'utf8',env:{...process.env,GIT_DIR:join(root,'.git'),GIT_WORK_TREE:root,PUBLICATION_BASE_SHA:before,GITHUB_SHA:head,GITHUB_OUTPUT:output}});
  run(base,candidate);expect(readFileSync(output,'utf8')).toContain('pending_candidate=true');
  mkdirSync(join(root,'data/production/editions'),{recursive:true});writeFileSync(join(root,'data/production/editions/2026-11-15.json'),'{}');git('add','.');git('commit','--quiet','-m','test published snapshot');run(candidate,git('rev-parse','HEAD'));expect(readFileSync(output,'utf8').trim().split('\n').at(-1)).toBe('pending_candidate=false');
 }finally{rmSync(root,{recursive:true});}
});
