import {it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acquireControllerLock} from './provenance';
it('rejects a competing controller before registry inspection; release permits a later claim',()=>{
 const root=mkdtempSync(join(tmpdir(),'evaluation-lock-')),file=join(root,'lock');
 try{const release=acquireControllerLock(file);expect(()=>acquireControllerLock(file)).toThrow(/controller/);release();const again=acquireControllerLock(file);again();}finally{rmSync(root,{recursive:true,force:true});}
});
