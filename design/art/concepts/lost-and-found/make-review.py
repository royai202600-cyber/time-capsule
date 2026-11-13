"""Time Capsule concept processing; writes only inside this concept folder."""
from pathlib import Path
from collections import deque
from io import BytesIO
import subprocess
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageFont, ImageChops
P=Path(__file__).resolve().parent
LAND=(243,239,230); NAVY=(22,38,63); BRASS=(201,161,90); PLUM=(110,43,63)
SIZE=(1024,1536)
NAMES=("waypost-gem-purple",)
def load(path): return Image.open(path).convert("RGBA")
def box(im): return im.getchannel("A").point(lambda x:255 if x>=16 else 0).getbbox()
def crop(im): return im.crop(box(im))
def resized(im,width=None,height=None):
    scale=width/im.width if width else height/im.height
    return im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
def fit(im,w,h):
    im=im.copy();im.thumbnail((w,h),Image.Resampling.LANCZOS);return im
def layer(im,xy):
    out=Image.new("RGBA",SIZE);out.alpha_composite(im,xy);return out
def export(name,im): im.save(P/name)
LANDMARKS=("landmark-gem-deep-purple",)
def extract_keyhole_ball():
    raw=subprocess.check_output(["git","show","86d882b:design/art/concepts/magic-ball/wax-hero.png"])
    source=Image.open(BytesIO(raw)).convert("RGBA")
    alpha=source.getchannel("A");w,h=source.size;seen=set();components=[]
    for y in range(h):
        for x in range(w//2):
            if alpha.getpixel((x,y))==0 or (x,y) in seen:continue
            queue=deque([(x,y)]);seen.add((x,y));xs=[];ys=[]
            while queue:
                xx,yy=queue.popleft();xs.append(xx);ys.append(yy)
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=xx+dx,yy+dy
                    if 0<=nx<w//2 and 0<=ny<h and (nx,ny) not in seen and alpha.getpixel((nx,ny))>0:
                        seen.add((nx,ny));queue.append((nx,ny))
            components.append((len(xs),(min(xs),min(ys),max(xs)+1,max(ys)+1)))
    bounds=max(components)[1]
    piece=source.crop(bounds);edge=max(piece.size)
    ball=Image.new("RGBA",(edge,edge))
    ball.paste(piece,((edge-piece.width)//2,(edge-piece.height)//2))
    export("ball/ball-keyhole.png",ball)
def gem_pieces():
    source=load(P/"waypost/landmark-a-gem.png")
    alpha=source.getchannel("A");w,h=source.size;bands=[]
    for y in range(h):
        if alpha.crop((0,y,w,y+1)).getextrema()[1]>0:
            if not bands or y>bands[-1][1]+1:bands.append([y,y])
            else:bands[-1][1]=y
    if bands!=[[103,251],[263,936]]:
        raise RuntimeError("Source geometry changed; gem separation needs Roy's review.")
    small=source.crop((0,103,w,252));small=small.crop(small.getchannel("A").getbbox())
    # Follow the visible pointed facet boundary in the source, clipping the pole behind it.
    mask=Image.new("L",(w*4,h*4));d=ImageDraw.Draw(mask)
    points=((0,263),(w,263),(w,593),(525,593),(502,607),(480,593),(0,593))
    d.polygon([(x*4,y*4) for x,y in points],fill=255)
    mask=mask.resize(source.size,Image.Resampling.LANCZOS)
    large=source.copy();large.putalpha(ImageChops.multiply(alpha,mask));large=large.crop(large.getchannel("A").getbbox())
    return source,large,small
def derive_gems():
    source,large,small=gem_pieces();w,h=source.size
    large=large.resize((round(large.width*.5),large.height),Image.Resampling.LANCZOS)
    small=small.resize((round(small.width*.5),small.height),Image.Resampling.LANCZOS)
    common=Image.new("RGBA",source.size)
    common.paste(large,((w-large.width)//2,(h-large.height)//2))
    export("waypost/waypost-gem-purple.png",common)
    stacked=Image.new("RGBA",source.size)
    stacked.paste(large,((w-large.width)//2,263))
    stacked.paste(small,((w-small.width)//2,103))
    r,g,b,a=stacked.split()
    deeper=Image.merge("RGBA",tuple(ch.point(lambda v:round(v*.8)) for ch in (r,g,b))+(a,))
    export("waypost/landmark-gem-deep-purple.png",deeper)
def overview():
    out=load(P/"screens/map-plain.png")
    hero=resized(crop(load(P/"cracks/hourglass-corrupted-a.png")),height=200)
    out.alpha_composite(hero,((1024-hero.width)//2,500))
    source=load(P/"waypost/landmark-a-gem.png")
    old_common=source.crop((0,263,1024,1024));old_common=old_common.crop(old_common.getchannel("A").getbbox())
    old_stack=source.crop(source.getchannel("A").getbbox())
    shadow=Image.new("RGBA",SIZE);d=ImageDraw.Draw(shadow)
    for cx,cy in ((170,650),(850,740),(610,1130),(380,290)):
        rx=7 if (cx,cy)!=(380,290) else 11
        d.ellipse((cx-rx,cy-3,cx+rx,cy+3),fill=NAVY+(45,))
    out=Image.alpha_composite(out,shadow.filter(ImageFilter.GaussianBlur(2.5)))
    for cx,cy in ((170,650),(850,740),(610,1130)):
        scale=56/old_common.width;im=crop(load(P/"waypost/waypost-gem-purple.png"))
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        out.alpha_composite(im,(cx-im.width//2,cy-round(old_common.height*scale)))
    scale=110/old_stack.width;im=crop(load(P/"waypost/landmark-gem-deep-purple.png"))
    im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    out.alpha_composite(im,(380-im.width//2,290-round(old_stack.height*scale)))
    export("screens/map-capsule-and-wayposts.png",out.convert("RGB"))
def small_check():
    out=Image.new("RGBA",(500,300),LAND+(255,))
    for name,cx,sizes in ((NAMES[0],150,(48,64)),(LANDMARKS[0],350,(64,96))):
        for row,size in enumerate(sizes):
            im=fit(crop(load(P/f"waypost/{name}.png")),size,size)
            out.alpha_composite(im,(cx-im.width//2,25+row*135))
    export("checks/wayposts-64.png",out)
WHEEL_SCENES=(
    ("park","Park"),("garden","Garden"),("waterfront","Waterfront"),
    ("square","Square"),("public-art","Public art"),
    ("landmark-taipei","Landmark: Taipei"),
    ("landmark-singapore","Landmark: Singapore"),("landmark-macau","Landmark: Macau"),
)
def wheel_circle(path,size):
    # Rim belongs to the preview, never to the opaque square scene master.
    scale=4;edge=size*scale
    scene=load(P/path).resize((edge,edge),Image.Resampling.LANCZOS)
    mask=Image.new("L",(edge,edge));ImageDraw.Draw(mask).ellipse((0,0,edge-1,edge-1),fill=255)
    scene.putalpha(mask)
    ImageDraw.Draw(scene).ellipse((0,0,edge-1,edge-1),outline=BRASS+(255,),width=3*scale)
    return scene.resize((size,size),Image.Resampling.LANCZOS)
def wheel_checks():
    for name,_ in WHEEL_SCENES:
        path=P/f"wheel/scene-{name}.png";im=load(path)
        if im.width!=im.height or min(im.size)<1024:
            raise RuntimeError(f"Expected square scene at least 1024 px: {path}")
        if im.getchannel("A").getextrema()!=(255,255):
            raise RuntimeError(f"Expected opaque wheel scene: {path}")
        if im.size!=(1024,1024):
            im.resize((1024,1024),Image.Resampling.LANCZOS).convert("RGB").save(path)
    check=Image.new("RGBA",(480,8*264),(246,248,251,255))
    for row,(name,_) in enumerate(WHEEL_SCENES):
        path=f"wheel/scene-{name}.png"
        for x,size in ((32,96),(200,240)):
            check.alpha_composite(wheel_circle(path,size),(x,row*264+(264-size)//2))
    export("checks/wheel-96-240.png",check.convert("RGB"))
def chosen_ball_previews():
    gold_path=P/"ball/ball-keyhole-gold.png"
    gold=load(gold_path)
    if max(gold.size)>1024:gold.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    gold.save(gold_path)
    ball=load(P/"ball/ball-keyhole.png")
    ball=resized(ball.crop(ball.getchannel("A").getbbox()),width=180)
    ball_layer=layer(ball,((1024-ball.width)//2,1270))
    export("screens/layers/ball-keyhole.png",ball_layer)
    for target,shadow,capsule in (("screen-throw.png","shadow.png","capsule-corrupted.png"),("screen-landmark-fight.png","landmark-shadow.png","landmark-capsule.png")):
        out=load(P/"screens/catch-background.png")
        for im in (load(P/"screens/layers"/shadow),load(P/"screens/layers"/capsule),ball_layer):
            out=Image.alpha_composite(out,im)
        export("screens/"+target,out.convert("RGB"))
    check=Image.new("RGBA",(400,200),LAND+(255,));ImageDraw.Draw(check).rectangle((0,100,400,200),fill="white")
    for name,cx in (("ball-keyhole.png",100),("ball-keyhole-gold.png",300)):
        im=fit(crop(load(P/"ball"/name)),64,64)
        for y in (18,118):check.alpha_composite(im,(cx-im.width//2,y))
    export("checks/balls-64.png",check)
    portrait=load(P/"whoever/portrait-a-bench.png")
    check=Image.new("RGBA",(120,90),(246,248,251,255))
    for x,size in ((15,24),(65,40)):
        check.alpha_composite(portrait.resize((size,size),Image.Resampling.LANCZOS),(x,25))
    export("checks/bench-portrait-24-40.png",check)
def sheet():
    font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",24)
    title=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",32)
    rows=[
      ("1 Keyhole ball",[("ball/ball-keyhole.png","Chosen keyhole wax ball"),("ball/ball-keyhole-gold.png","Gold veins on the keyhole ball")],400),
      ("",[("checks/balls-64.png","Normal / gold at 64 px on land and road")],220),
      ("2 Crack A",[("cracks/hourglass-corrupted-a.png","Corrupted hourglass: Crack A"),("cracks/hourglass-restored.png","Restored hourglass")],450),
      ("",[("cracks/other-vessels-proof.png","Crack A on the dome, envelope and Maison vessels")],450),
      ("3 Throw and hit",[("screens/screen-throw.png","Throw: keyhole ball, separate layers"),("screens/screen-hit.png","Hit: mending Corrupted Capsule")],700),
      ("",[("screens/catch-background.png","Shared catch and Landmark fight background")],650),
      ("4 Waypost",[("waypost/waypost-gem-purple.png","Waypost: floating purple gem"),("waypost/landmark-gem-deep-purple.png","Landmark Waypost: floating deep purple gems"),("screens/map-capsule-and-wayposts.png","Chosen Wayposts on the map")],550),
      ("5 Landmark fight",[("screens/screen-landmark-fight.png","Landmark fight: chosen keyhole ball")],700),
      ("6 To whoever passes by",[("whoever/portrait-a-bench.png","Bench portrait"),("checks/bench-portrait-24-40.png","Bench portrait at actual 24 and 40 px")],380),
      ("",[("whoever/scene-a-bench.png","Bench scene: an envelope waiting")],450),
      ("7 Waypost picture wheel",[(f"wheel/scene-{name}.png",label) for name,label in WHEEL_SCENES[:4]],480),
      ("",[(f"wheel/scene-{name}.png",label) for name,label in WHEEL_SCENES[4:]],480)
    ]
    height=sum(h+80 for _,_,h in rows)
    out=Image.new("RGBA",(2200,height),(246,248,251,255));d=ImageDraw.Draw(out);y=0
    for heading,items,h in rows:
        if heading:d.text((24,y+4),heading,font=title,fill=NAVY)
        y+=44;cw=2200//len(items)
        for i,(path,label) in enumerate(items):
            picture=load(P/path)
            if path in ("ball/ball-keyhole.png","ball/ball-keyhole-gold.png"):picture=crop(picture)
            if path.startswith("wheel/"):picture=wheel_circle(path,400)
            im=fit(picture,cw-32,h-42)
            out.alpha_composite(im,(i*cw+(cw-im.width)//2,y+(h-42-im.height)//2))
            d.text((i*cw+16,y+h-35),label,font=font,fill=NAVY)
        y+=h+36
    export("contact-sheet.png",out.convert("RGB"))
if __name__=="__main__":
    derive_gems();overview();small_check();wheel_checks();sheet()
