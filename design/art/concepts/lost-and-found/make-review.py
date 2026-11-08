"""Concept-only processing. Every output stays beside this script."""
from pathlib import Path
import json, math, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance
from PIL.PngImagePlugin import PngInfo
P=Path(__file__).resolve().parent
ART=P.parents[1]
NAVY=(22,38,63); PALE=(220,232,242); LAND=(243,239,230)
def load(p): return Image.open(p).convert("RGBA")
def visible_box(im): return im.getchannel("A").point(lambda v:255 if v>=64 else 0).getbbox()
def save_processed(im,f):
    info=PngInfo();info.add_text("concept_processed","yes");im.save(f,pnginfo=info)
def fit(im,w,h):
    im=im.copy(); im.thumbnail((w,h),Image.Resampling.LANCZOS); return im
def normalize():
    for folder in ("ball","cracks","waypost","whoever"):
        for f in (P/folder).glob("*.png"):
            if Image.open(f).info.get("concept_processed")=="yes": continue
            if folder=="cracks" and not f.stem.endswith("raw"): continue
            if folder=="whoever" and f.name.startswith("scene"): continue
            im=load(f)
            if im.width>1024: im=im.resize((1024,round(im.height*1024/im.width)),Image.Resampling.LANCZOS)
            if im.size!=(1024,1024):
                canvas=Image.new("RGBA",(1024,1024));canvas.alpha_composite(im,((1024-im.width)//2,(1024-im.height)//2));im=canvas
            im.save(f)
def crack(key):
    im=Image.open(P/f"cracks/crack-{key}-raw.png").convert("RGB")
    # White is empty. Discard faint paper noise before using darkness as alpha.
    a=ImageOps.grayscale(im).point(lambda v:max(0,min(255,round((245-v)*255/220))))
    navy=Image.new("RGBA",im.size,NAVY+(0,));navy.putalpha(a)
    pale=Image.new("RGBA",im.size,PALE+(0,));pale.putalpha(a)
    layer=Image.new("RGBA",im.size);layer.alpha_composite(pale,(2,1));layer.alpha_composite(navy)
    layer.save(P/f"cracks/crack-{key}.png");return layer
def lost(name,layer,out,heavy=False):
    im=load(ART/"vessels"/name);a=im.getchannel("A");box=a.getbbox()
    rgb=ImageEnhance.Color(im.convert("RGB")).enhance(.5).convert("RGBA");rgb.putalpha(a)
    mist=Image.new("RGBA",im.size,PALE+(36,));rgb=Image.alpha_composite(rgb,mist);rgb.putalpha(a)
    l=layer.copy()
    if heavy:l=Image.alpha_composite(l,l.rotate(71,resample=Image.Resampling.BICUBIC))
    l=l.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
    overlay=Image.new("RGBA",im.size);overlay.alpha_composite(l,box[:2])
    clipped=ImageChops.multiply(overlay.getchannel("A"),a);overlay.putalpha(clipped)
    result=Image.alpha_composite(rgb,overlay);result.putalpha(a);result.save(P/out);return result
from PIL import ImageChops
def montage(items,size=(1024,400),bg=(246,248,251,255)):
    out=Image.new("RGBA",size,bg);cw=size[0]//len(items)
    for i,im in enumerate(items):
        im=fit(im,cw-20,size[1]-20);out.alpha_composite(im,(i*cw+(cw-im.width)//2,(size[1]-im.height)//2))
    return out
def process():
    normalize()
    a=crack("a-large");b=crack("b-fine")
    for key,l in (("a",a),("b",b)):
        lost("vessel-hourglass.png",l,f"cracks/hourglass-lost-{key}.png")
    shutil.copyfile(ART/"vessels/vessel-hourglass.png",P/"cracks/hourglass-restored.png")
    proofs=[]
    for name in ("dome","envelope","maison"):
        # Keep proof intermediates in this folder too.
        proofs.append(lost(f"vessel-{name}.png",a,f"cracks/proof-{name}.png"))
    montage(proofs,(1536,512)).save(P/"cracks/other-vessels-proof.png")
    lost("vessel-senado-fountain.png",a,"cracks/senado-lost-heavy.png",True)
    for f in (P/"whoever").glob("portrait-*.png"):
        if Image.open(f).info.get("concept_processed")=="yes": continue
        im=load(f);mask=Image.new("L",(4096,4096));ImageDraw.Draw(mask).ellipse(((505-430)*4,(526-430)*4,(505+430)*4,(526+430)*4),fill=255)
        mask=mask.resize((1024,1024),Image.Resampling.LANCZOS);im.putalpha(ImageChops.multiply(im.getchannel("A"),mask));save_processed(im,f)
    for f in (P/"whoever").glob("scene-*.png"):
        if Image.open(f).info.get("concept_processed")=="yes": continue
        im=load(f);w,h=im.size
        # Raised-cosine fade, always multiply by existing transparency.
        ax=Image.new("L",(w,h));px=ax.load()
        edge=min(w,h)*.12
        for y in range(h):
            for x in range(w):
                t=min(1,min(x,y,w-1-x,h-1-y)/edge);px[x,y]=round(255*(.5-.5*math.cos(math.pi*t)))
        im.putalpha(ImageChops.multiply(im.getchannel("A"),ax));save_processed(im,f)
    checks()
def checks():
    balls=sorted((P/"ball").glob("*.png"))
    if len(balls)==5:
        out=Image.new("RGBA",(700,200),LAND+(255,))
        d=ImageDraw.Draw(out);d.rectangle((0,100,700,200),fill="white")
        for i,f in enumerate(balls):
            im=load(f);im=im.crop(visible_box(im));im=fit(im,64,64)
            for y in (18,118):out.alpha_composite(im,(i*140+38,y))
        out.save(P/"checks/balls-64.png")
    out=Image.new("RGBA",(600,240),LAND+(255,))
    for i,n in enumerate(("lost-a","lost-b","restored")):
        for y,s in ((8,120),(156,64)):
            im=load(P/f"cracks/hourglass-{n}.png");im=im.crop(im.getchannel("A").getbbox());im=fit(im,s,s);out.alpha_composite(im,(i*200+(200-im.width)//2,y))
    out.save(P/"checks/hourglasses-120-64.png")
    fs=sorted((P/"waypost").glob("*.png"),key=lambda f:(f.name.startswith("spinner"),f.name))
    if len(fs)==6:
        out=Image.new("RGBA",(840,100),LAND+(255,))
        for i,f in enumerate(fs):
            im=load(f);im=fit(im.crop(visible_box(im)),64,64);out.alpha_composite(im,(i*140+38,18))
        out.save(P/"checks/wayposts-64.png")
    fs=sorted((P/"whoever").glob("portrait-*.png"))
    if len(fs)==2:
        out=Image.new("RGBA",(240,100),(246,248,251,255))
        for i,f in enumerate(fs):
            for j,s in enumerate((24,40)):
                im=load(f).resize((s,s),Image.Resampling.LANCZOS);out.alpha_composite(im,(i*120+j*50,25))
        out.save(P/"checks/portraits-24-40.png")
def sheet():
    from PIL import ImageFont
    font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",24)
    title=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",32)
    rows=[
      ("1 Balls",[(str(f.relative_to(P)),f.stem.replace("ball-","Ball ").replace("-"," ")) for f in sorted((P/"ball").glob("*.png"))],400),
      ("", [("checks/balls-64.png","All five balls at 64 px: map land / white road")],220),
      ("2 Shared crack effect",[(f"cracks/crack-{k}{s}.png",f"Crack {k[0].upper()}: "+("raw ink" if s else "transparent + pale edge")) for k in ("a-large","b-fine") for s in ("-raw","")],400),
      ("",[(f"cracks/hourglass-{k}.png",label) for k,label in (("lost-a","Hourglass: large cracks"),("lost-b","Hourglass: fine cracks"),("restored","Hourglass: untouched master"))]+[("cracks/other-vessels-proof.png","Shared effect on three other vessels")],450),
      ("",[("checks/hourglasses-120-64.png","Lost A / Lost B / restored at 120 and 64 px")],260),
      ("3 Throw and hit",[("screens/screen-throw.png","Throw: plain wax ball, one wide brass ring"),("screens/screen-hit.png","Hit: wax dust, one tight brass ring")],700),
      ("4 Common Wayposts",[(f"waypost/waypost-{k}.png",label) for k,label in (("a-post-hut","Waypost A: post hut"),("b-kiosk","Waypost B: round kiosk"),("c-shelter","Waypost C: wayside shelter"))],400),
      ("",[(f"waypost/spinner-{k}.png",label) for k,label in (("a-pinwheel","Spinner A: paper pinwheel"),("b-lantern","Spinner B: turning lantern"),("c-letter-rack","Spinner C: letter rack"))],400),
      ("",[("checks/wayposts-64.png","Three buildings and three spinners at 64 px")],180),
      ("5 Landmark Waypost",[("cracks/senado-lost-heavy.png","Senado vessel: heavy shared crack effect"),("screens/screen-landmark.png","Giant cracked fountain on invented map")],650),
      ("6 To whoever passes by",[("whoever/portrait-a-bench.png","Portrait A: waiting envelope on bench"),("whoever/portrait-b-lamp.png","Portrait B: envelope tied to lamp")],380),
      ("",[("whoever/scene-a-bench.png","Scene A: envelope waiting on bench"),("whoever/scene-b-lamp.png","Scene B: envelope tied to lamp")],450),
      ("",[("checks/portraits-24-40.png","Both portraits at actual 24 and 40 px")],150)
    ]
    height=sum(h+80 for _,_,h in rows)
    out=Image.new("RGBA",(2200,height),(246,248,251,255));d=ImageDraw.Draw(out);y=0
    for heading,items,h in rows:
        if heading:d.text((24,y+4),heading,font=title,fill=NAVY)
        y+=44;cw=2200//len(items)
        for i,(path,label) in enumerate(items):
            im=load(P/path);im=fit(im,cw-32,h-42)
            out.alpha_composite(im,(i*cw+(cw-im.width)//2,y+(h-42-im.height)//2))
            d.text((i*cw+16,y+h-35),label,font=font,fill=NAVY)
        y+=h+36
    out.convert("RGB").save(P/"contact-sheet.png")
if __name__=="__main__":
    process()
    if len(list((P/"whoever").glob("*.png")))==4:sheet()
