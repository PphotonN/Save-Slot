import struct,zlib,sys
from dataclasses import dataclass, field

@dataclass
class Node:
    name:str
    props:list
    children:list=field(default_factory=list)

def read_prop(data, off):
    t=chr(data[off]); off+=1
    if t=='Y': return struct.unpack_from('<h',data,off)[0], off+2
    if t=='C': return bool(data[off]), off+1
    if t=='I': return struct.unpack_from('<i',data,off)[0], off+4
    if t=='F': return struct.unpack_from('<f',data,off)[0], off+4
    if t=='D': return struct.unpack_from('<d',data,off)[0], off+8
    if t=='L': return struct.unpack_from('<q',data,off)[0], off+8
    if t in 'fdlib':
        n, enc, clen=struct.unpack_from('<III',data,off); off+=12
        raw=data[off:off+clen]; off+=clen
        if enc: raw=zlib.decompress(raw)
        fmt={'f':'f','d':'d','l':'q','i':'i','b':'B'}[t]
        vals=list(struct.unpack('<'+fmt*n,raw[:struct.calcsize('<'+fmt*n)]))
        return vals,off
    if t in 'SR':
        n=struct.unpack_from('<I',data,off)[0]; off+=4
        raw=data[off:off+n]; off+=n
        return (raw.decode('utf-8','replace') if t=='S' else raw),off
    raise ValueError((t,off))

def parse_node(data, off, version):
    if version>=7500:
        end,num,plen=struct.unpack_from('<QQQ',data,off); off+=24; null_len=25
    else:
        end,num,plen=struct.unpack_from('<III',data,off); off+=12; null_len=13
    name_len=data[off]; off+=1
    if end==0: return None,off
    name=data[off:off+name_len].decode('utf-8','replace'); off+=name_len
    props=[]
    for _ in range(num):
        p,off=read_prop(data,off); props.append(p)
    children=[]
    while off < end-null_len:
        ch,noff=parse_node(data,off,version)
        if ch is None: break
        children.append(ch); off=noff
    return Node(name,props,children),end

def parse(path):
    data=open(path,'rb').read()
    assert data.startswith(b'Kaydara FBX Binary')
    version=struct.unpack_from('<I',data,23)[0]
    off=27; roots=[]
    while off < len(data):
        n,noff=parse_node(data,off,version)
        if n is None: break
        roots.append(n); off=noff
    return version,roots

def show(n,depth=0,maxd=4):
    print('  '*depth+n.name, [repr(p)[:100] for p in n.props])
    if depth<maxd:
      for c in n.children: show(c,depth+1,maxd)

if __name__=='__main__':
 v,r=parse(sys.argv[1]); print('version',v)
 for n in r: show(n,0,3)
