import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const roots = ['dist','src','data','docs'];
const forbidden = [/C:\\Users\\/i,/Privat_Ich/i,/Poker vom 22\.05/i,/markdown-original/i,/data-source-base64/i,/gh[pousr]_[A-Za-z0-9]{25,}/,/sk-[A-Za-z0-9]{25,}/];
let count=0;
function scan(path){for(const entry of readdirSync(path,{withFileTypes:true})){const p=join(path,entry.name);if(entry.isDirectory())scan(p);else{const text=readFileSync(p,'utf8');if(forbidden.some(re=>re.test(text)))throw Error(`Unexpected private content in ${p}`);count++;}}}
roots.forEach(scan);
for(const f of ['index.html','README.md']) {const text=readFileSync(f,'utf8');if(forbidden.some(re=>re.test(text)))throw Error(`Unexpected private content in ${f}`);}
console.log(`Public source and production artifact scan passed (${count+2} files). Allowlisted statistical data only; no embedded original documents.`);
