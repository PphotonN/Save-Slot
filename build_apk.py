from __future__ import annotations
import os, struct, hashlib, zlib, zipfile, subprocess, shutil, json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
APP=ROOT/'app'
OUT=ROOT/'out'
OUT.mkdir(exist_ok=True)

# ---------- helpers ----------
def uleb(v:int)->bytes:
    out=bytearray()
    while True:
        b=v&0x7f; v>>=7
        if v: out.append(b|0x80)
        else: out.append(b); return bytes(out)

def align(v,a): return (v+a-1)//a*a

def pack_u16(*v): return struct.pack('<'+'H'*len(v),*v)
def pack_u32(*v): return struct.pack('<'+'I'*len(v),*v)

# ---------- minimal DEX ----------
def build_dex()->bytes:
    MAIN='Lcom/saveslot/app/MainActivity;'
    ACT='Landroid/app/Activity;'
    BUNDLE='Landroid/os/Bundle;'
    CONTEXT='Landroid/content/Context;'
    VIEW='Landroid/view/View;'
    WEBVIEW='Landroid/webkit/WebView;'
    SETTINGS='Landroid/webkit/WebSettings;'
    STRING='Ljava/lang/String;'
    VOID='V'; BOOL='Z'; INT='I'
    URL='file:///android_asset/index.html'

    proto_defs={
        (VOID,(), 'V'),
        (VOID,(BUNDLE,), 'VL'),
        (BOOL,(INT,), 'ZI'),
        (VOID,(CONTEXT,), 'VL'),
        (SETTINGS,(), 'L'),
        (VOID,(BOOL,), 'VZ'),
        (VOID,(STRING,), 'VL'),
        (VOID,(VIEW,), 'VL'),
        (BOOL,(), 'Z'),
    }
    P_VOID=(VOID,(),'V')
    P_BUNDLE=(VOID,(BUNDLE,),'VL')
    P_REQ=(BOOL,(INT,),'ZI')
    P_CONTEXT=(VOID,(CONTEXT,),'VL')
    P_GETSET=(SETTINGS,(),'L')
    P_BOOL=(VOID,(BOOL,),'VZ')
    P_STRING=(VOID,(STRING,),'VL')
    P_VIEW=(VOID,(VIEW,),'VL')
    P_BOOL0=(BOOL,(),'Z')

    methods=[
        (ACT,'<init>',P_VOID),
        (ACT,'onCreate',P_BUNDLE),
        (ACT,'requestWindowFeature',P_REQ),
        (ACT,'setContentView',P_VIEW),
        (ACT,'onBackPressed',P_VOID),
        (WEBVIEW,'<init>',P_CONTEXT),
        (WEBVIEW,'getSettings',P_GETSET),
        (WEBVIEW,'loadUrl',P_STRING),
        (WEBVIEW,'canGoBack',P_BOOL0),
        (WEBVIEW,'goBack',P_VOID),
        (SETTINGS,'setJavaScriptEnabled',P_BOOL),
        (SETTINGS,'setDomStorageEnabled',P_BOOL),
        (SETTINGS,'setAllowFileAccess',P_BOOL),
        (SETTINGS,'setAllowFileAccessFromFileURLs',P_BOOL),
        (SETTINGS,'setAllowUniversalAccessFromFileURLs',P_BOOL),
        (MAIN,'<init>',P_VOID),
        (MAIN,'onCreate',P_BUNDLE),
        (MAIN,'onBackPressed',P_VOID),
    ]
    fields=[(MAIN,'webView',WEBVIEW)]

    type_descs={MAIN,ACT,BUNDLE,CONTEXT,VIEW,WEBVIEW,SETTINGS,STRING,VOID,BOOL,INT}
    strings=set(type_descs)|{m[1] for m in methods}|{f[1] for f in fields}|{p[2] for p in proto_defs}|{URL}
    strings=sorted(strings)
    sidx={s:i for i,s in enumerate(strings)}
    types=sorted(type_descs,key=lambda s:sidx[s])
    tidx={t:i for i,t in enumerate(types)}
    protos=sorted(proto_defs,key=lambda p:(tidx[p[0]],tuple(tidx[x] for x in p[1]),sidx[p[2]]))
    pidx={p:i for i,p in enumerate(protos)}
    fields=sorted(fields,key=lambda f:(tidx[f[0]],tidx[f[2]],sidx[f[1]]))
    fidx={(c,n,t):i for i,(c,n,t) in enumerate(fields)}
    methods=sorted(methods,key=lambda m:(tidx[m[0]],sidx[m[1]],pidx[m[2]]))
    midx={(c,n,p):i for i,(c,n,p) in enumerate(methods)}

    header_size=0x70
    string_ids_off=header_size
    type_ids_off=string_ids_off+4*len(strings)
    proto_ids_off=type_ids_off+4*len(types)
    field_ids_off=proto_ids_off+12*len(protos)
    method_ids_off=field_ids_off+8*len(fields)
    class_defs_off=method_ids_off+8*len(methods)
    data_off=align(class_defs_off+32,4)
    data=bytearray()

    def add(blob:bytes,alignment=1):
        nonlocal data
        abspos=data_off+len(data)
        pad=align(abspos,alignment)-abspos
        if pad: data.extend(b'\0'*pad)
        off=data_off+len(data)
        data.extend(blob)
        return off

    string_data_offsets=[]
    for s in strings:
        raw=s.encode('utf-8')
        string_data_offsets.append(add(uleb(len(s))+raw+b'\0'))
    first_string_data=string_data_offsets[0]

    type_list_offsets={}
    for _,params,_ in protos:
        if not params: continue
        key=tuple(params)
        if key in type_list_offsets: continue
        blob=pack_u32(len(params))+b''.join(pack_u16(tidx[x]) for x in params)
        type_list_offsets[key]=add(blob,4)
    first_type_list=min(type_list_offsets.values()) if type_list_offsets else 0

    def inv(op,mi,regs):
        count=len(regs); rr=list(regs)+[0]*(5-len(regs))
        C,D,E,F,G=rr[:5]
        return [op|((G&0xf)<<8)|((count&0xf)<<12), mi, (C&0xf)|((D&0xf)<<4)|((E&0xf)<<8)|((F&0xf)<<12)]
    def new_instance(reg,ti): return [0x22|((reg&0xff)<<8),ti]
    def move_result(reg): return [0x0a|((reg&0xff)<<8)]
    def move_result_object(reg): return [0x0c|((reg&0xff)<<8)]
    def const4(reg,val): return [0x12|((reg&0xf)<<8)|((val&0xf)<<12)]
    def const_string(reg,si): return [0x1a|((reg&0xff)<<8),si]
    def iput_object(val_reg,obj_reg,fi): return [0x5b|((val_reg&0xf)<<8)|((obj_reg&0xf)<<12),fi]
    def iget_object(dest_reg,obj_reg,fi): return [0x54|((dest_reg&0xf)<<8)|((obj_reg&0xf)<<12),fi]
    def if_eqz(reg,offset): return [0x38|((reg&0xff)<<8),offset & 0xffff]

    def code_item(registers,ins,outs,units):
        blob=struct.pack('<HHHHII',registers,ins,outs,0,0,len(units))
        blob+=struct.pack('<'+'H'*len(units),*units)
        return blob

    ctor_units=[]
    ctor_units+=inv(0x70,midx[(ACT,'<init>',P_VOID)],[0])
    ctor_units+=[0x0e]
    ctor_code_off=add(code_item(1,1,1,ctor_units),4)

    oc=[]
    oc+=inv(0x6f,midx[(ACT,'onCreate',P_BUNDLE)],[4,5])
    oc+=const4(2,1)
    oc+=inv(0x6e,midx[(ACT,'requestWindowFeature',P_REQ)],[4,2])
    oc+=new_instance(0,tidx[WEBVIEW])
    oc+=inv(0x70,midx[(WEBVIEW,'<init>',P_CONTEXT)],[0,4])
    oc+=iput_object(0,4,fidx[(MAIN,'webView',WEBVIEW)])
    oc+=inv(0x6e,midx[(WEBVIEW,'getSettings',P_GETSET)],[0])
    oc+=move_result_object(1)
    oc+=const4(2,1)
    for name in ['setJavaScriptEnabled','setDomStorageEnabled','setAllowFileAccess','setAllowFileAccessFromFileURLs','setAllowUniversalAccessFromFileURLs']:
        oc+=inv(0x6e,midx[(SETTINGS,name,P_BOOL)],[1,2])
    oc+=const_string(3,sidx[URL])
    oc+=inv(0x6e,midx[(WEBVIEW,'loadUrl',P_STRING)],[0,3])
    oc+=inv(0x6e,midx[(ACT,'setContentView',P_VIEW)],[4,0])
    oc+=[0x0e]
    oncreate_code_off=add(code_item(6,2,2,oc),4)

    ob=[]
    ob+=iget_object(0,2,fidx[(MAIN,'webView',WEBVIEW)])
    ob+=inv(0x6e,midx[(WEBVIEW,'canGoBack',P_BOOL0)],[0])
    ob+=move_result(1)
    ob+=if_eqz(1,6)
    ob+=inv(0x6e,midx[(WEBVIEW,'goBack',P_VOID)],[0])
    ob+=[0x0e]
    ob+=inv(0x6f,midx[(ACT,'onBackPressed',P_VOID)],[2])
    ob+=[0x0e]
    onback_code_off=add(code_item(3,1,1,ob),4)
    first_code=min(ctor_code_off,oncreate_code_off,onback_code_off)

    ctor_idx=midx[(MAIN,'<init>',P_VOID)]
    oncreate_idx=midx[(MAIN,'onCreate',P_BUNDLE)]
    onback_idx=midx[(MAIN,'onBackPressed',P_VOID)]
    class_data=bytearray()
    class_data+=uleb(0)+uleb(1)+uleb(1)+uleb(2)
    class_data+=uleb(fidx[(MAIN,'webView',WEBVIEW)])+uleb(0x2)
    class_data+=uleb(ctor_idx)+uleb(0x10001)+uleb(ctor_code_off)
    virtual_methods=sorted([(onback_idx,0x1,onback_code_off),(oncreate_idx,0x4,oncreate_code_off)], key=lambda x:x[0])
    prev=0
    for idx,flags,code_off in virtual_methods:
        class_data+=uleb(idx-prev)+uleb(flags)+uleb(code_off)
        prev=idx
    class_data_off=add(bytes(class_data))

    map_off=align(data_off+len(data),4)
    map_entries=[
        (0x0000,1,0),
        (0x0001,len(strings),string_ids_off),
        (0x0002,len(types),type_ids_off),
        (0x0003,len(protos),proto_ids_off),
        (0x0004,len(fields),field_ids_off),
        (0x0005,len(methods),method_ids_off),
        (0x0006,1,class_defs_off),
        (0x2002,len(strings),first_string_data),
    ]
    if type_list_offsets: map_entries.append((0x1001,len(type_list_offsets),first_type_list))
    map_entries += [
        (0x2001,3,first_code),
        (0x2000,1,class_data_off),
        (0x1000,1,map_off),
    ]
    map_entries.sort(key=lambda x:x[2])
    map_blob=pack_u32(len(map_entries))+b''.join(struct.pack('<HHII',typ,0,count,off) for typ,count,off in map_entries)
    actual_map_off=add(map_blob,4)
    assert actual_map_off==map_off

    file_size=data_off+len(data)
    out=bytearray(file_size)
    for i,off in enumerate(string_data_offsets): struct.pack_into('<I',out,string_ids_off+4*i,off)
    for i,t in enumerate(types): struct.pack_into('<I',out,type_ids_off+4*i,sidx[t])
    for i,p in enumerate(protos):
        ret,params,shorty=p
        struct.pack_into('<III',out,proto_ids_off+12*i,sidx[shorty],tidx[ret],type_list_offsets.get(tuple(params),0))
    for i,(cls,name,ftype) in enumerate(fields):
        struct.pack_into('<HHI',out,field_ids_off+8*i,tidx[cls],tidx[ftype],sidx[name])
    for i,(cls,name,proto) in enumerate(methods):
        struct.pack_into('<HHI',out,method_ids_off+8*i,tidx[cls],pidx[proto],sidx[name])
    struct.pack_into('<IIIIIIII',out,class_defs_off,
                     tidx[MAIN],0x21,tidx[ACT],0,0xffffffff,0,class_data_off,0)
    out[data_off:]=data
    out[0:8]=b'dex\n035\0'
    struct.pack_into('<I',out,32,file_size)
    struct.pack_into('<I',out,36,0x70)
    struct.pack_into('<I',out,40,0x12345678)
    struct.pack_into('<II',out,44,0,0)
    struct.pack_into('<I',out,52,map_off)
    struct.pack_into('<II',out,56,len(strings),string_ids_off)
    struct.pack_into('<II',out,64,len(types),type_ids_off)
    struct.pack_into('<II',out,72,len(protos),proto_ids_off)
    struct.pack_into('<II',out,80,len(fields),field_ids_off)
    struct.pack_into('<II',out,88,len(methods),method_ids_off)
    struct.pack_into('<II',out,96,1,class_defs_off)
    struct.pack_into('<II',out,104,file_size-data_off,data_off)
    sig=hashlib.sha1(out[32:]).digest(); out[12:32]=sig
    checksum=zlib.adler32(out[12:])&0xffffffff; struct.pack_into('<I',out,8,checksum)
    return bytes(out)

# ---------- binary AndroidManifest.xml ----------
RES_XML_TYPE=0x0003
RES_STRING_POOL_TYPE=0x0001
RES_XML_RESOURCE_MAP_TYPE=0x0180
RES_XML_START_NAMESPACE_TYPE=0x0100
RES_XML_END_NAMESPACE_TYPE=0x0101
RES_XML_START_ELEMENT_TYPE=0x0102
RES_XML_END_ELEMENT_TYPE=0x0103
NO_INDEX=0xffffffff
ANDROID_URI='http://schemas.android.com/apk/res/android'

ATTR_IDS={
    'label':0x01010001,
    'icon':0x01010002,
    'name':0x01010003,
    'exported':0x01010010,
    'screenOrientation':0x0101001e,
    'minSdkVersion':0x0101020c,
    'versionCode':0x0101021b,
    'versionName':0x0101021c,
    'targetSdkVersion':0x01010270,
    'hardwareAccelerated':0x010102d3,
    'usesCleartextTraffic':0x010104ec,
}

def len8(n):
    if n<0x80:return bytes([n])
    return bytes([(n>>8)|0x80,n&0xff])

def string_pool(strings):
    offsets=[]; data=bytearray()
    for s in strings:
        offsets.append(len(data)); raw=s.encode('utf-8')
        utf16_len=len(s.encode('utf-16-le'))//2
        data+=len8(utf16_len)+len8(len(raw))+raw+b'\0'
    while len(data)%4:data.append(0)
    header_size=28
    strings_start=header_size+4*len(strings)
    size=strings_start+len(data)
    return struct.pack('<HHI',RES_STRING_POOL_TYPE,header_size,size)+struct.pack('<IIIII',len(strings),0,0x100,strings_start,0)+b''.join(pack_u32(o) for o in offsets)+data

def node_header(chunk_type,size,line=1):
    return struct.pack('<HHIII',chunk_type,16,size,line,NO_INDEX)

def ns_chunk(start,prefix_idx,uri_idx):
    typ=RES_XML_START_NAMESPACE_TYPE if start else RES_XML_END_NAMESPACE_TYPE
    return node_header(typ,24)+pack_u32(prefix_idx,uri_idx)

def attr(ns_idx,name_idx,raw_idx,data_type,data):
    return pack_u32(ns_idx,name_idx,raw_idx)+struct.pack('<HBBI',8,0,data_type,data)

def start_element(strings_idx,name,attrs,ns=None,line=1):
    # attrs: list of (namespace or None, attr name, kind, value)
    encoded=[]
    for ans,aname,kind,value in attrs:
        ns_i=strings_idx[ans] if ans else NO_INDEX
        name_i=strings_idx[aname]
        if kind=='string':
            raw_i=strings_idx[value]; encoded.append(attr(ns_i,name_i,raw_i,0x03,raw_i))
        elif kind=='int': encoded.append(attr(ns_i,name_i,NO_INDEX,0x10,int(value)))
        elif kind=='bool': encoded.append(attr(ns_i,name_i,NO_INDEX,0x12,1 if value else 0))
        elif kind=='enum': encoded.append(attr(ns_i,name_i,NO_INDEX,0x10,int(value)))
        elif kind=='ref': encoded.append(attr(ns_i,name_i,NO_INDEX,0x01,int(value)))
        else: raise ValueError(kind)
    count=len(encoded); size=36+20*count
    ns_i=strings_idx[ns] if ns else NO_INDEX
    ext=pack_u32(ns_i,strings_idx[name])+struct.pack('<HHHHHH',20,20,count,0,0,0)
    return node_header(RES_XML_START_ELEMENT_TYPE,size,line)+ext+b''.join(encoded)

def end_element(strings_idx,name,ns=None,line=1):
    ns_i=strings_idx[ns] if ns else NO_INDEX
    return node_header(RES_XML_END_ELEMENT_TYPE,24,line)+pack_u32(ns_i,strings_idx[name])

def build_manifest()->bytes:
    strings=[
        'android',ANDROID_URI,'manifest','package','com.saveslot.app','versionCode','versionName','0.2.2',
        'uses-sdk','minSdkVersion','targetSdkVersion','uses-permission','name','android.permission.INTERNET','android.permission.VIBRATE',
        'application','label','Save Slot','icon','hardwareAccelerated','usesCleartextTraffic','activity','.MainActivity','screenOrientation','exported',
        'intent-filter','action','android.intent.action.MAIN','category','android.intent.category.LAUNCHER'
    ]
    # preserve order but unique
    strings=list(dict.fromkeys(strings)); idx={s:i for i,s in enumerate(strings)}
    chunks=[string_pool(strings)]
    # resource map indexed by string index
    max_i=max(idx[name] for name in ATTR_IDS if name in idx)
    rmap=[0]*(max_i+1)
    for name,rid in ATTR_IDS.items():
        if name in idx:rmap[idx[name]]=rid
    rblob=b''.join(pack_u32(x) for x in rmap)
    chunks.append(struct.pack('<HHI',RES_XML_RESOURCE_MAP_TYPE,8,8+len(rblob))+rblob)
    chunks.append(ns_chunk(True,idx['android'],idx[ANDROID_URI]))
    chunks.append(start_element(idx,'manifest',[
        (None,'package','string','com.saveslot.app'),
        (ANDROID_URI,'versionCode','int',8),
        (ANDROID_URI,'versionName','string','0.2.2'),
    ]))
    chunks.append(start_element(idx,'uses-sdk',[
        (ANDROID_URI,'minSdkVersion','int',23),
        (ANDROID_URI,'targetSdkVersion','int',35),
    ]))
    chunks.append(end_element(idx,'uses-sdk'))
    chunks.append(start_element(idx,'uses-permission',[(ANDROID_URI,'name','string','android.permission.INTERNET')]))
    chunks.append(end_element(idx,'uses-permission'))
    chunks.append(start_element(idx,'uses-permission',[(ANDROID_URI,'name','string','android.permission.VIBRATE')]))
    chunks.append(end_element(idx,'uses-permission'))
    chunks.append(start_element(idx,'application',[
        (ANDROID_URI,'label','string','Save Slot'),
        (ANDROID_URI,'hardwareAccelerated','bool',True),
        (ANDROID_URI,'usesCleartextTraffic','bool',False),
    ]))
    chunks.append(start_element(idx,'activity',[
        (ANDROID_URI,'name','string','.MainActivity'),
        (ANDROID_URI,'screenOrientation','enum',1),
        (ANDROID_URI,'exported','bool',True),
    ]))
    chunks.append(start_element(idx,'intent-filter',[]))
    chunks.append(start_element(idx,'action',[(ANDROID_URI,'name','string','android.intent.action.MAIN')]))
    chunks.append(end_element(idx,'action'))
    chunks.append(start_element(idx,'category',[(ANDROID_URI,'name','string','android.intent.category.LAUNCHER')]))
    chunks.append(end_element(idx,'category'))
    chunks.append(end_element(idx,'intent-filter'))
    chunks.append(end_element(idx,'activity'))
    chunks.append(end_element(idx,'application'))
    chunks.append(end_element(idx,'manifest'))
    chunks.append(ns_chunk(False,idx['android'],idx[ANDROID_URI]))
    body=b''.join(chunks)
    return struct.pack('<HHI',RES_XML_TYPE,8,8+len(body))+body


def build_resources_arsc()->bytes:
    """Minimal resource table with one drawable: @drawable/icon (0x7f010000)."""
    global_pool = string_pool(['res/drawable/icon.png'])
    type_pool = string_pool(['drawable'])
    key_pool = string_pool(['icon'])

    type_spec_flags = pack_u32(0x40000000)
    type_spec_size = 16 + len(type_spec_flags)
    type_spec = struct.pack('<HHIBBHI', 0x0202, 16, type_spec_size, 1, 0, 0, 1) + type_spec_flags

    config_size = 64
    config = pack_u32(config_size) + b'\0' * (config_size - 4)
    type_header_size = 20 + config_size
    entry_offsets = pack_u32(0)
    entries_start = type_header_size + len(entry_offsets)
    entry = struct.pack('<HHI', 8, 0, 0)
    value = struct.pack('<HBBI', 8, 0, 0x03, 0)
    type_chunk_size = entries_start + len(entry) + len(value)
    type_chunk = (
        struct.pack('<HHI', 0x0201, type_header_size, type_chunk_size)
        + struct.pack('<BBHII', 1, 0, 0, 1, entries_start)
        + config
        + entry_offsets
        + entry
        + value
    )

    package_header_size = 288
    package_name = 'com.saveslot.app'.encode('utf-16le')
    package_name = package_name + b'\0' * (256 - len(package_name))
    type_strings_off = package_header_size
    key_strings_off = package_header_size + len(type_pool)
    package_body = type_pool + key_pool + type_spec + type_chunk
    package_size = package_header_size + len(package_body)
    package_header = (
        struct.pack('<HHI', 0x0200, package_header_size, package_size)
        + pack_u32(0x7f)
        + package_name
        + pack_u32(type_strings_off, 1, key_strings_off, 1, 0)
    )
    package_chunk = package_header + package_body
    table_size = 12 + len(global_pool) + len(package_chunk)
    return struct.pack('<HHII', 0x0002, 12, table_size, 1) + global_pool + package_chunk


def build():
    dex=build_dex(); manifest=build_manifest(); resources=build_resources_arsc()
    (OUT/'classes.dex').write_bytes(dex)
    (OUT/'AndroidManifest.xml').write_bytes(manifest)
    (OUT/'resources.arsc').write_bytes(resources)
    unsigned=OUT/'SaveSlot-0.2-concept-unsigned.apk'
    with zipfile.ZipFile(unsigned,'w') as z:
        z.writestr('AndroidManifest.xml',manifest,compress_type=zipfile.ZIP_STORED)
        z.writestr('classes.dex',dex,compress_type=zipfile.ZIP_STORED)
        z.writestr('resources.arsc',resources,compress_type=zipfile.ZIP_STORED)
        icon_path=APP/'assets'/'app-icon.png'
        if icon_path.exists(): z.write(icon_path,'res/drawable/icon.png',compress_type=zipfile.ZIP_STORED)
        for path in sorted(APP.rglob('*')):
            if not path.is_file(): continue
            arc='assets/'+path.relative_to(APP).as_posix()
            z.write(path,arc,compress_type=zipfile.ZIP_DEFLATED)
    keystore=OUT/'save-slot-debug.keystore'
    if not keystore.exists():
        subprocess.run(['keytool','-genkeypair','-v','-keystore',str(keystore),'-storepass','saveslot','-keypass','saveslot','-alias','saveslot','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Save Slot Test, OU=Development, O=Local, L=Kyiv, C=UA'],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    signed=OUT/'SaveSlot-0.2-concept.apk'
    shutil.copy2(unsigned,signed)
    subprocess.run(['jarsigner','-keystore',str(keystore),'-storepass','saveslot','-keypass','saveslot','-sigalg','SHA256withRSA','-digestalg','SHA-256',str(signed),'saveslot'],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    verify=subprocess.run(['jarsigner','-verify','-verbose','-certs',str(signed)],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,check=False)
    (OUT/'signature-verification.txt').write_text(verify.stdout)
    print('DEX',len(dex),'Manifest',len(manifest),'APK',signed.stat().st_size,'verify',verify.returncode)
    return signed

if __name__=='__main__': build()
