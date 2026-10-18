// Real finance components, isolated local APIs and synthetic data. No production writes.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=process.cwd();
const temporary=mkdtempSync(path.join(tmpdir(),'partspro-finance-ui-'));
try{
 for(const name of ['build.cjs','entry.tsx','run.cjs']){
  const source=readFileSync(path.join(root,'tests/fixtures/finance-ui',`${name}.fixture`),'utf8');
  writeFileSync(path.join(temporary,name),source.replaceAll('__HARNESS_DIR__',JSON.stringify(temporary)));
 }
 execFileSync(process.execPath,[path.join(temporary,'build.cjs')],{cwd:root,stdio:'inherit'});
 const {default:postcss}=await import('postcss');
 const {default:tailwind}=await import('@tailwindcss/postcss');
 const css=await postcss([tailwind({base:root,optimize:true})]).process(readFileSync(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
 writeFileSync(path.join(temporary,'style.css'),css.css);
 execFileSync(process.execPath,[path.join(temporary,'run.cjs')],{cwd:root,stdio:'inherit',timeout:180000,env:{...process.env,FINANCE_UI_OUTPUT_DIR:path.resolve(root,process.argv[2]||'outputs/finance-redesign/2026-10-18')}});
}finally{rmSync(temporary,{recursive:true,force:true});}
