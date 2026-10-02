#!/usr/bin/env python3
"""Collect icon references read-only; write local import artifacts under ignored imports/."""
from pathlib import Path
import json,re,subprocess
ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'illtool': Path('/Users/ryders/Developer/GitHub/illtool-standalone'),
    'illmater': Path('/Users/ryders/Developer/GitHub/illmater'),
    'spurious-ecosystem': Path('/Users/ryders/Developer/GitHub/SpuriousEcosystem'),
}
output = ROOT / 'imports'; output.mkdir(exist_ok=True)
def swift_symbols(root):
    names = set()
    for source in root.rglob('*.swift'):
        if any(part in {'build','.build','archive','Archive','tmp','work','node_modules','Tests','tests','test','Previews'} for part in source.parts): continue
        text = source.read_text(errors='replace')
        # Literal references only: dynamic variables cannot safely identify artwork.
        names.update(re.findall(r'(?:systemName|systemImage|systemSymbolName)\s*:\s*"([\w.-]+)"',text))
        if source.name == 'ToolGlyphs.swift':
            names.update(re.findall(r'case\s+\w+\s*=\s*"([\w.-]+)"',text.split('var fallbackSymbol')[0]))
    return sorted(names)
sets={name:swift_symbols(root) for name,root in SOURCES.items() if name!='illmater'}
for name,symbols in sets.items():
    (output/f'{name}-symbol-inventory.json').write_text(json.dumps({'sf_symbols':[{'symbol':s} for s in symbols]},indent=2)+'\n')
    print(name,len(symbols),'literal symbols')
all_symbols=sorted(set(s for names in sets.values() for s in names))
all_inventory=output/'project-symbol-inventory.json';all_inventory.write_text(json.dumps({'sf_symbols':[{'symbol':s} for s in all_symbols]}))
extractor=SOURCES['illtool']/'scripts/dev/extract-sf-symbol-outlines.swift'
raw=subprocess.check_output(['/usr/bin/xcrun','swift',str(extractor),str(all_inventory)],text=True)
(output/'project-symbol-outlines.json').write_text(raw)
outlines={entry['symbol']:entry for entry in json.loads(raw)}
def pen(contour,convert):
    points=[]
    for point in contour['points']:
        x,y=convert(point['position']); q={'x':x,'y':y}
        for key,sourcekey in [('in','inHandle'),('out','outHandle')]:
            hx,hy=convert(point[sourcekey]);delta=[round(hx-x,6),round(hy-y,6)]
            if any(abs(v)>1e-7 for v in delta):q[key]=delta
        points.append(q)
    return {'shape':'pen','pts':points,'closed':contour['closed']}
for name,symbols in sets.items():
    glyphs=[];missing=[]
    for symbol in symbols:
        entry=outlines[symbol]
        if entry.get('error') or not entry['contours']:
            missing.append({'symbol':symbol,'error':entry.get('error') or 'No contours'}); continue
        x,y,w,h=entry['bounds'];scale=20/max(w,h)
        # Cocoa path coordinates are y-up; the workbench is y-down. Normalize to a centered 20-unit box.
        convert=lambda p:(round(12+(p[0]-x-w/2)*scale,6),round(12-(p[1]-y-h/2)*scale,6))
        node={'op':'compound','fillRule':'evenodd','children':[pen(c,convert) for c in entry['contours']]}
        glyphs.append({'name':f'{name}-{symbol}','aliases':symbol.split('.'),'description':f'{symbol} used by {name}', 'grid':0.1,'weight':1.2,'provenance':'imported-fill','source':{'project':name,'symbol':symbol,'extractor':entry['sourceExtractor']},'symmetry':{'mirror':None,'rotate':1},'layers':[{'id':'symbol','name':symbol,'role':'primary','paint':'fill','node':node}]})
    (output/f'{name}-icons.json').write_text(json.dumps({'format':'glyph-workbench-library','version':1,'scope':'all','source':{'project':name,'artwork':'SF Symbols; separate Apple terms'},'count':len(glyphs),'glyphs':glyphs},indent=2)+'\n')
    (output/f'{name}-missing-symbols.json').write_text(json.dumps(missing,indent=2)+'\n')
    print(name,len(glyphs),'importable icons;',len(missing),'unavailable symbols')
