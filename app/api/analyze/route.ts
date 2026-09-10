function safeUrl(value: string) {
  const u = new URL(value.includes('://') ? value : `https://${value}`);
  const h = u.hostname.toLowerCase();
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port || !h.includes('.') || h.includes(':') || /^\d/.test(h) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(h)) throw new Error('Enter a public website address, such as https://example.com.');
  return u;
}
export async function POST(request: Request) {
 try {
  const body = await request.json() as {url?: string};
  let u = safeUrl(String(body.url || '')); const start = Date.now(); let response: Response | undefined;
  for(let i=0;i<6;i++) {
   response = await fetch(u.href, {redirect:'manual', signal:AbortSignal.timeout(15000), headers:{'User-Agent':'SitepulseAudit/1.0','Accept':'text/html'}});
   if(response.status >=300 && response.status<400 && response.headers.get('location')) { u=safeUrl(new URL(response.headers.get('location')!,u).href); continue; } break;
  }
  if(!response?.ok) throw new Error(`The website returned HTTP ${response?.status}. Try another public page.`);
  const ttfb = Date.now()-start;
  if(!response.headers.get('content-type')?.includes('text/html')) throw new Error('This address does not return an HTML webpage.');
  const reader=response.body!.getReader(); let bytes=0; const chunks: Uint8Array[]=[];
  while(true) { const {done,value}=await reader.read(); if(done)break; bytes+=value.length; if(bytes>2500000){await reader.cancel();throw new Error('This page is too large to analyze (2.5 MB HTML limit).');} chunks.push(value); }
  const joined=new Uint8Array(bytes);let offset=0; for(const c of chunks){joined.set(c,offset);offset+=c.length;} const html=new TextDecoder().decode(joined);
  const attr=(s:string,n:string)=>s.match(new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'))?.slice(1).find(x=>x!==undefined)||'';
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  const meta=(n:string)=>tags.find(t=>attr(t,'name').toLowerCase()===n || attr(t,'property').toLowerCase()===n);
  const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';
  const description=attr(meta('description')||'','content');
  const images=html.match(/<img\b[^>]*>/gi)||[]; const missingAlt=images.filter(t=>! /\balt\s*=/i.test(t)).length;
  const headings=(html.match(/<h1\b/gi)||[]).length;
  const canonical=(html.match(/<link\b[^>]*>/gi)||[]).find(t=>attr(t,'rel').toLowerCase()==='canonical');
  const checks=[
   {name:'Page title',pass:!!title,detail:title||'No title found.',fix:'Add a unique, descriptive <title> to the page.',category:'Content'},
   {name:'Meta description',pass:!!description,detail:description?`${description.length} characters · ${description}`:'Missing description',fix:'Write a useful summary in a meta description to describe this page in search results.',category:'Content'},
   {name:'Main heading',pass:headings===1,detail:`${headings} H1 headings found`,fix:'Use one clear main heading to describe the page topic.',category:'Content'},
   {name:'Image alternative text',pass:missingAlt===0,detail:`${missingAlt} of ${images.length} images missing alt attributes`,fix:'Add meaningful alt text to informative images and empty alt attributes to decorative images.',category:'Accessibility'},
   {name:'Canonical URL',pass:!!canonical,detail:canonical?attr(canonical,'href'):'No canonical link found',fix:'Specify a canonical URL to clarify the preferred version of this page.',category:'Technical'},
   {name:'Mobile viewport',pass:!!meta('viewport'),detail:meta('viewport')?'Viewport metadata present':'Viewport metadata missing',fix:'Add a viewport meta tag with width=device-width, initial-scale=1.',category:'Technical'},
   {name:'Search indexing',pass:!/noindex/i.test(attr(meta('robots')||'','content')+' '+response.headers.get('x-robots-tag')),detail:'Checks page robots metadata and response headers; does not check robots.txt.',fix:'Remove noindex directives if this page should appear in search.',category:'Technical'},
   {name:'Secure connection',pass:u.protocol==='https:',detail:u.protocol==='https:'?'Page served over HTTPS':'Page served over HTTP',fix:'Serve the page securely over HTTPS.',category:'Technical'},
   {name:'Social sharing metadata',pass:!!meta('og:title')&&!!meta('og:description'),detail:meta('og:title')?'Open Graph title found':'Open Graph title missing',fix:'Add og:title and og:description for useful link previews.',category:'Content'},
   {name:'Document language',pass:/<html\b[^>]*\blang\s*=/i.test(html),detail:'Checks the HTML language attribute.',fix:'Declare the document language on the html element.',category:'Accessibility'}
  ];
  return Response.json({url:u.href,title,description,score:Math.round(checks.filter(c=>c.pass).length/checks.length*100),checks,ttfb,load:Date.now()-start,bytes,images:images.length,scripts:(html.match(/<script\b[^>]*\bsrc\s*=/gi)||[]).length,styles:(html.match(/<link\b[^>]*\brel\s*=\s*["']stylesheet/gi)||[]).length,date:new Date().toISOString()});
 } catch(e) {return Response.json({error:e instanceof Error ? e.message:'Unable to analyze this website.'},{status:400});}
}

