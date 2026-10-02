"""Recover approximate constant-width vector centerlines; preserve rejected fills.
Requires numpy, scipy, scikit-image, opencv-python. Uses deterministic skeleton thinning.
"""
import json, sys, math
from pathlib import Path
import numpy as np
import cv2
from skimage.morphology import skeletonize
ROOT=Path('imports/reconstruction')
def mask(path):
    rgba=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
    return rgba[:,:,3]>127
if len(sys.argv)>1:
    entries=json.loads((ROOT/'candidates.json').read_text())
    passed=0;existing=0
    for i,item in enumerate(entries):
        a=mask(ROOT/'masks'/f'{i}.png')
        if item.get('existing'):
            item['status']='existing';item['iou384']=1;item['iou96']=1
        elif item['candidate']:
            b=mask(ROOT/'masks'/f'{i}-candidate.png')
            def iou(a,b):return float(np.logical_and(a,b).sum()/max(1,np.logical_or(a,b).sum()))
            item['iou384']=iou(a,b)
            a96=cv2.resize(a.astype('uint8'),(96,96),interpolation=cv2.INTER_AREA)>0
            b96=cv2.resize(b.astype('uint8'),(96,96),interpolation=cv2.INTER_AREA)>0
            item['iou96']=iou(a96,b96)
            # Topology check rejects candidates that fill holes or disconnect regions.
            ca,_=cv2.findContours(a.astype('uint8'),cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
            cb,_=cv2.findContours(b.astype('uint8'),cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
            topology=len(ca)==len(cb)
            good=item['iou384']>=.97 and item['iou96']>=.95 and item['widthVariation']<=.35 and topology
            item['status']='candidate' if good else 'needs-review'
            item['reason']='High image match; original authoring paths remain unknown.' if good else f"Approximation needs review (IoU {item['iou384']:.3f}; width variation {item['widthVariation']:.2f}; topology {'matches' if topology else 'differs'})."
        else:item['status']='needs-review'
        passed+=item['status']=='candidate';existing+=item['status']=='existing'
    report={'format':'glyph-workbench-reconstruction','version':1,'sourceProject':'eds-icons','method':'skeleton thinning, distance-based width, fitted paths; independent raster comparison','entries':entries,'summary':{'total':len(entries),'candidates':passed,'existingCenterlines':existing,'needsReview':len(entries)-passed-existing}}
    (ROOT/'eds-centerline-review.json').write_text(json.dumps(report,separators=(',',':')))
    print(json.dumps(report['summary']));sys.exit()
sources=json.loads((ROOT/'sources.json').read_text());output=[]
for index,source in enumerate(sources):
    a=mask(ROOT/'masks'/f'{index}.png');s=skeletonize(a);distance=cv2.distanceTransform(a.astype('uint8'),cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
    pixels=set(zip(*np.nonzero(s)))
    def neighbors(point):
        y,x=point;result=[]
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                if not (dx or dy):continue
                other=(y+dy,x+dx)
                if other not in pixels:continue
                if dx and dy and ((y+dy,x) in pixels or (y,x+dx) in pixels):continue
                result.append(other)
        return result
    graph={p:neighbors(p) for p in pixels};critical=sorted(p for p in pixels if len(graph[p])!=2);visited=set();paths=[]
    def trace(start,next_point):
        path=[start];previous=start;point=next_point
        while True:
            edge=tuple(sorted((previous,point)))
            if edge in visited:break
            visited.add(edge);path.append(point)
            if point==start or len(graph[point])!=2:break
            following=[p for p in graph[point] if p!=previous]
            if not following:break
            previous,point=point,following[0]
        return path
    for start in critical:
        for other in graph[start]:
            if tuple(sorted((start,other))) not in visited:paths.append(trace(start,other))
    for start in sorted(pixels):
        for other in graph[start]:
            if tuple(sorted((start,other))) not in visited:paths.append(trace(start,other))
    widths=np.array([distance[p]*2 for p in pixels]);width=float(np.median(widths)) if len(widths) else 0
    variation=float((np.percentile(widths,90)-np.percentile(widths,10))/max(width,1)) if len(widths) else 99
    paths=[p for p in paths if len(p)>max(3,width*.4)]
    vectors=[]
    for points in paths:
        closed=points[0]==points[-1]
        pts=np.array([[x+.5,y+.5] for y,x in points],dtype=np.float32)
        pts=cv2.approxPolyDP(pts,.35,closed).reshape(-1,2)/16
        if len(pts)>=2:vectors.append({'closed':closed,'points':pts.tolist(),'endpoints':[len(graph[points[0]])==1,len(graph[points[-1]])==1]})
    reason='Could not infer useful stroke paths from this filled shape.'
    if width/16>8: vectors=[];reason='Shape is too broad for the editor stroke-width range.'
    if len(vectors)>128: vectors=[];reason='Too many branches for a useful editable reconstruction.'
    output.append({'name':source['name'],'width':round(width/16,4),'widthVariation':variation,'paths':vectors,'reason':reason})
    if index%100==0:print(f'Traced {index}/{len(sources)}',flush=True)
(ROOT/'traced.json').write_text(json.dumps(output))
