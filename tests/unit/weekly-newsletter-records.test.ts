import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir}from'node:os';import{join}from'node:path';
import{it,expect}from'vitest';
import{buildWeeklyDraft,finalizeWeeklyDraft,validateWeeklyReviewRecords}from'../../src/lib/weekly-newsletter';
import{story}from'../helpers/weekly-newsletter';
it('validates immutable weekly merge records during production content loading',async()=>{
 const root=mkdtempSync(join(tmpdir(),'tsd-weekly-records-'));const dir=join(root,'data/production/newsletter-reviews');mkdirSync(dir,{recursive:true});
 const draft=buildWeeklyDraft([story('test')],[],new Date('2026-11-09T00:00:00Z'))!;
 const result=finalizeWeeklyDraft(draft,{actor:'pankajmouriya',merged_at:'2026-11-15T00:00:00Z',head_sha:'a'.repeat(40),merge_sha:'b'.repeat(40),pr_number:1});
 const file=join(dir,'2026-11-15.json');writeFileSync(file,JSON.stringify(result.record));
 try{
  expect(validateWeeklyReviewRecords(root,[result.edition])).toBe(1);
  const editionDir=join(root,'data/production/editions');mkdirSync(editionDir,{recursive:true});
  const editionFile=join(editionDir,'2026-11-15.json');writeFileSync(editionFile,JSON.stringify(result.edition));
  const {loadEditions}=await import('../../src/lib/content');expect(loadEditions('production',root)).toHaveLength(1);
  const changed=structuredClone(result.edition);changed.newsletter!.subject='Unreviewed edit';expect(()=>validateWeeklyReviewRecords(root,[changed])).toThrow(/match/);
  writeFileSync(editionFile,JSON.stringify(changed));expect(()=>loadEditions('production',root)).toThrow(/match/);
  expect(()=>validateWeeklyReviewRecords(root,[])).toThrow(/edition/);
  writeFileSync(file,JSON.stringify({...result.record,date:'2026-11-22'}));expect(()=>validateWeeklyReviewRecords(root,[result.edition])).toThrow(/filename/);
 }finally{rmSync(root,{recursive:true});}
});
