import 'dotenv/config';
import {chromium} from '@playwright/test';
import pg from 'pg';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {deleteFile} from '../lib/storage.ts';
const {origin}=JSON.parse(await readFile('.preview-runtime.json','utf8'));
const db=new pg.Client({connectionString:process.env.DATABASE_URL}); await db.connect();
const name='media-test-'+randomBytes(8).toString('hex'), password=randomBytes(20).toString('hex'),salt=randomBytes(16).toString('hex');
const user=(await db.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$1,$2,'SUPER_ADMIN') RETURNING id",[name,salt+':'+scryptSync(password,salt,64).toString('hex')])).rows[0];
let browser;
try {
browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const page=await browser.newPage();
await page.goto(origin+'/admin/login');
await page.getByLabel('Tên đăng nhập hoặc email',{exact:true}).fill(name);
await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
await page.waitForURL(origin+'/admin');
await page.getByRole('link',{name:'Bài viết',exact:true}).click();
await page.waitForURL(origin+'/admin/posts');
await page.goto(origin+'/admin/posts/new');
await page.locator('.editor-toolbar').waitFor();
await page.getByPlaceholder('Nhập tiêu đề…').fill(name);
const video=await page.evaluate(async()=>{
const type=['video/mp4;codecs=avc1.42001E','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
if(!type)throw Error('Chrome cannot record MP4');
const canvas=document.createElement('canvas'); canvas.width=64;canvas.height=64;
const ctx=canvas.getContext('2d');ctx.fillStyle='blue';ctx.fillRect(0,0,64,64);
const stream=canvas.captureStream(10), recorder=new MediaRecorder(stream,{mimeType:type}), chunks=[];
return await new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onerror=reject;recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());resolve(Array.from(bytes));};recorder.start();setTimeout(()=>recorder.stop(),500);});
});
const png=await sharp({create:{width:64,height:64,channels:3,background:'#1559dc'}}).png().toBuffer();
await page.locator('.article-media-upload input').setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'two.png',mimeType:'image/png',buffer:png},{name:'clip.mp4',mimeType:'video/mp4',buffer:Buffer.from(video)}]);
await page.getByRole('status').filter({hasText:'Đã chèn 3 tệp'}).waitFor();
if(await page.locator('.tiptap img').count()!==2 || await page.locator('.tiptap video').count()!==1)throw Error('Insertion failed');
await page.getByRole('button',{name:'Xuất bản',exact:true}).click();
await page.getByText(name,{exact:true}).waitFor();
const post=(await db.query('SELECT slug,content FROM posts WHERE author_id=$1',[user.id])).rows[0];
if(!post.content.includes('<video')||!post.content.includes('controls'))throw Error('Video sanitized away');
await page.goto(origin+'/tin-tuc/'+post.slug);
await page.locator('.prose video').waitFor();
if(await page.locator('.prose img').count()!==2)throw Error('Public images missing');
const src=await page.locator('.prose video').getAttribute('src');
const range=await fetch(origin+src,{headers:{Range:'bytes=0-15'}});
if(range.status!==206||(await range.arrayBuffer()).byteLength!==16)throw Error('Video range failed');
await page.reload();await page.locator('.prose video').waitFor();
console.log('PASS: multiple image and real MP4 upload, editor insertion, publish, public rendering, reload and video ranges.');
} finally {
if(browser)await browser.close();
await db.query('DELETE FROM posts WHERE author_id=$1',[user.id]);
for(const m of (await db.query('SELECT * FROM media WHERE author_id=$1',[user.id])).rows){await deleteFile(m.storage_key+(m.mime==='video/mp4'?'.mp4':'.webp'));if(m.mime!=='video/mp4')await deleteFile(m.storage_key+'-thumb.webp');}
await db.query('DELETE FROM media WHERE author_id=$1',[user.id]);
await db.query('DELETE FROM audit_logs WHERE user_id=$1',[user.id]);
await db.query('DELETE FROM users WHERE id=$1',[user.id]);
await db.query('DELETE FROM rate_limits WHERE key LIKE $1 OR key LIKE $2',['%'+user.id+'%','%'+name+'%']);
await db.end();
}

