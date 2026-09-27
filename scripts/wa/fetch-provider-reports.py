"""Fetch a provider's annual/financial report PDFs from its own site, no Firecrawl.

  python3 scripts/wa/fetch-provider-reports.py <abn> <site> <outdir>

Walks sitemap(s) + homepage links for report-shaped URLs, follows one hop, keeps
responses that are really PDFs (max 6), writes <abn>-<hash>.pdf/.txt/.url.
Check robots.txt first; 2026-09-27 run excluded 3 sites that disallow /.
Grep the .txt for funder names; audited statements carry funder-by-program lines.
"""
import re, sys, os, ssl, hashlib, urllib.request, subprocess
UA={'User-Agent':'Mozilla/5.0 (CivicGraph research)'}
ctx=ssl.create_default_context()
def req(u,n=None):
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30,context=ctx)
    return r.headers.get('Content-Type',''), (r.read(n) if n else r.read())
def txt(u):
    try: return req(u,3_000_000)[1].decode('utf8','ignore')
    except Exception: return ''
abn, site = sys.argv[1], sys.argv[2].rstrip('/')
if not site.startswith('http'): site='https://'+site
try:
    r=urllib.request.urlopen(urllib.request.Request(site,headers=UA),timeout=20,context=ctx); from urllib.parse import urlsplit; x=urlsplit(r.geturl()); site=f'{x.scheme}://{x.netloc}'
except Exception: pass
out=sys.argv[3]; os.makedirs(out,exist_ok=True)
seen,queue,urls=set(),[site+'/sitemap_index.xml',site+'/sitemap.xml',site+'/wp-sitemap.xml'],set()
while queue and len(seen)<40:
    u=queue.pop(0)
    if u in seen: continue
    seen.add(u)
    for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>',txt(u)):
        (queue.append(loc) if re.search(r'sitemap[^/]*\.xml',loc) else urls.add(loc))
home=txt(site); urls|=set(re.findall(r'href="([^"]+)"',home))
key=re.compile(r'annual[-_ ]?report|financial[-_ ]?(report|statement)|year[-_ ]?in[-_ ]?review|impact[-_ ]?report|/reports?/?$|annualreport',re.I)
cands=set(u for u in urls if key.search(u))
links=set()
for p in [u for u in cands if not u.lower().endswith('.pdf')][:12]:
    for h in re.findall(r'href="([^"#]+)"',txt(p)):
        if h.startswith('/'): h=site+h
        if h.lower().endswith('.pdf') or key.search(h): links.add(h)
links|=set(u for u in cands if u.lower().endswith('.pdf'))
got=0
for u in sorted(links):
    if got>=6: break
    if not u.startswith('http') or 'wp-json' in u or u.endswith('/feed'): continue
    try:
        ct,b=req(u,40_000_000)
    except Exception: continue
    if 'pdf' not in ct.lower() and not b[:5]==b'%PDF-': continue
    f=os.path.join(out,f"{abn}-{hashlib.md5(u.encode()).hexdigest()[:8]}.pdf"); open(f,'wb').write(b)
    subprocess.run(['pdftotext','-layout',f,f[:-4]+'.txt'],capture_output=True)
    open(f[:-4]+'.url','w').write(u); got+=1
print(abn, site, 'sitemap_urls',len(urls),'cands',len(cands),'pdfs',got)
