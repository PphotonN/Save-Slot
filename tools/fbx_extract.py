from __future__ import annotations
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_fbx import parse, Node

ROOT=Path(__file__).resolve().parents[1]
SRC=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'source-assets'/'cartridge.fbx'
OUT=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else ROOT/'app'/'assets'/'model.json'

def child(node,name):
    return next(c for c in node.children if c.name==name)

def prop_map(node):
    p70=next((c for c in node.children if c.name=='Properties70'),None)
    out={}
    if p70:
        for p in p70.children:
            if p.name=='P' and p.props:
                out[p.props[0]]=p.props[4:]
    return out

version,roots=parse(SRC)
objects=next(n for n in roots if n.name=='Objects')
connections=next(n for n in roots if n.name=='Connections')
# IDs and names
by_id={n.props[0]:n for n in objects.children if n.props and isinstance(n.props[0],int)}
# Map model -> geometry/materials in connection order
model_geometries={}
model_materials={}
for c in connections.children:
    if c.name!='C' or len(c.props)<3: continue
    rel,src,dst=c.props[:3]
    if rel!='OO': continue
    sn=by_id.get(src); dn=by_id.get(dst)
    if not sn or not dn: continue
    if sn.name=='Geometry' and dn.name=='Model': model_geometries[dst]=src
    if sn.name=='Material' and dn.name=='Model': model_materials.setdefault(dst,[]).append(src)

materials={}
for n in objects.children:
    if n.name!='Material': continue
    mid=n.props[0]
    name=n.props[1].split('\x00')[0]
    pm=prop_map(n)
    diffuse=pm.get('DiffuseColor',[0.3,0.3,0.3])[:3]
    rough=(pm.get('3dsMax|Parameters|roughness') or pm.get('Shininess') or [0.55])[0]
    metal=(pm.get('3dsMax|Parameters|metalness') or [0.0])[0]
    materials[mid]={'name':name,'color':[round(float(x),6) for x in diffuse], 'roughness':float(rough), 'metalness':float(metal)}

meshes=[]
for model in [n for n in objects.children if n.name=='Model' and n.props[2]=='Mesh']:
    model_id=model.props[0]
    model_name=model.props[1].split('\x00')[0]
    gid=model_geometries.get(model_id)
    g=by_id[gid]
    geo_name=g.props[1].split('\x00')[0]
    d={c.name:c for c in g.children}
    pos=d['Vertices'].props[0]
    pvi=d['PolygonVertexIndex'].props[0]
    # polygon vertex occurrence indices
    polys=[]; poly_occ=[]; cur=[]; occ=[]
    pv_counter=0
    for idx in pvi:
        if idx<0:
            cur.append(-idx-1); occ.append(pv_counter); pv_counter+=1
            polys.append(cur); poly_occ.append(occ); cur=[]; occ=[]
        else:
            cur.append(idx); occ.append(pv_counter); pv_counter+=1
    normal_el=d['LayerElementNormal']
    nd={c.name:c for c in normal_el.children}
    normals=nd['Normals'].props[0]
    nidx=nd.get('NormalsIndex')
    nidx=nidx.props[0] if nidx else list(range(len(pvi)))
    uv_el=d['LayerElementUV']
    ud={c.name:c for c in uv_el.children}
    uvs=ud['UV'].props[0]
    uidx=ud.get('UVIndex')
    uidx=uidx.props[0] if uidx else list(range(len(pvi)))
    mat_el=d['LayerElementMaterial']
    md={c.name:c for c in mat_el.children}
    mat_indices=md['Materials'].props[0]
    mat_ids=model_materials.get(model_id,[])
    groups=[]
    for mi,mat_id in enumerate(mat_ids):
        verts=[]
        for pi,(poly,occs) in enumerate(zip(polys,poly_occ)):
            if mat_indices[pi] != mi: continue
            # already triangles, fan fallback
            for k in range(1,len(poly)-1):
                for j in (0,k,k+1):
                    vi=poly[j]; oi=occs[j]
                    ni=nidx[oi]; ui=uidx[oi]
                    x,y,z=pos[vi*3:vi*3+3]
                    nx,ny,nz=normals[ni*3:ni*3+3]
                    u,v=uvs[ui*2:ui*2+2]
                    # UVs in FBX are bottom-left; canvas images are top-left.
                    verts.extend([x,y,z,nx,ny,nz,u,1-v])
        if verts:
            mat=materials[mat_id]
            groups.append({'material':mat['name'],'color':mat['color'],'roughness':mat['roughness'],'metalness':mat['metalness'],'vertices':[round(float(x),6) for x in verts]})
    # Identify actual role by material names, not accidentally swapped object labels.
    mat_names={g['material'] for g in groups}
    role='cartridge' if 'boxart' in mat_names else 'slot'
    meshes.append({'sourceModel':model_name,'sourceGeometry':geo_name,'role':role,'groups':groups})

payload={'version':1,'source':'cartridge.fbx','coordinateSystem':'X right, Y up, Z depth; inserted pose at origin','meshes':meshes}
OUT.write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
print('wrote',OUT,OUT.stat().st_size)
for m in meshes:
    print(m['role'],m['sourceModel'],[(g['material'],len(g['vertices'])//8) for g in m['groups']])
