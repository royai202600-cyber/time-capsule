#!/usr/bin/env python3
"""Place four map figures on one adult scale and the shared (512, 900) anchor."""
import colorsys
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CHECKS = ROOT / '_checks'
NAMES = ('keeper', 'figure-01', 'figure-04', 'figure-06')

def cleaned(im):
    # Generated cutouts contain isolated alpha 1–8 dust far from the person.
    im = im.convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a: a if a > 8 else 0))
    return im

def ink_blue_top(im):
    """Darken only 04's light-blue upper garment to the requested ink-blue family."""
    out = im.copy()
    pixels = out.load()
    # The garment ends above 61% of the source canvas; trousers are darker.
    changed = 0
    for y in range(int(im.height * .61)):
        for x in range(im.width):
            r,g,b,a = pixels[x,y]
            if not a or not (b > g > r and g >= 85 and b-r >= 35):
                continue
            # RGB multiplication retains texture, folds, linework and alpha.
            pixels[x,y] = (round(r*.72), round(g*.72), round(b*.72), a)
            changed += 1
    return out, changed

def feet(alpha):
    bbox = alpha.getbbox()
    mid = round((bbox[0]+bbox[2])/2)
    ankle = round(bbox[1]+.85*(bbox[3]-bbox[1]))
    left = alpha.crop((0,ankle,mid,alpha.height)).getbbox()
    right = alpha.crop((mid,ankle,alpha.width,alpha.height)).getbbox()
    assert left and right, 'both feet must be present'
    return left[3]+ankle, right[3]+ankle

def main():
    config = json.loads((CHECKS/'city-hunt-scale.json').read_text())
    reference = cleaned(Image.open(ROOT/config['figures']['keeper']['source']))
    bbox = reference.getchannel('A').getbbox()
    # One scale derived ONCE from the Keeper's cap-inclusive standing height.
    # Players inherit it; they are not fitted individually to their own bboxes.
    canonical_edge = reference.width
    shared_scale = 740/(bbox[3]-bbox[1])
    config['canonical_source_edge'] = canonical_edge
    config['shared_scale'] = shared_scale
    reports = []
    for name in NAMES:
        entry = config['figures'][name]
        im = cleaned(Image.open(ROOT/entry['source']))
        native_factor = canonical_edge/im.width
        assert im.width == im.height
        if entry['mirror_to_right']:
            im = ImageOps.mirror(im)
        rgb_adjusted = 0
        if name == 'figure-04':
            im,rgb_adjusted = ink_blue_top(im)
        applied_scale = shared_scale*native_factor
        assert applied_scale <= 1, 'never upscale'
        scaled = im.resize((round(im.width*applied_scale),round(im.height*applied_scale)), Image.Resampling.LANCZOS)
        alpha = scaled.getchannel('A')
        box = alpha.getbbox()
        left,right = feet(alpha)
        offset_x = round(512-(box[0]+box[2])/2)
        # Both projected soles straddle y900 by no more than the allowed 4 px.
        offset_y = 900-round((left+right)/2)
        out = Image.new('RGBA',(1024,1024))
        out.alpha_composite(scaled,(offset_x,offset_y))
        out.save(ROOT/'characters'/f'{name}.png',optimize=True)
        a = out.getchannel('A'); b = a.getbbox(); sole_y = feet(a)
        corners = [a.getpixel(p) for p in ((0,0),(1023,0),(0,1023),(1023,1023))]
        assert corners == [0,0,0,0]
        assert all(896 <= y <= 904 for y in sole_y), (name,sole_y)
        assert 896 <= b[3] <= 904
        assert abs((b[0]+b[2])/2-512) <= .5
        height = b[3]-b[1]
        assert 680 <= height <= 760, (name,height)
        reports.append({'file':f'characters/{name}.png','size':[1024,1024],'mode':'RGBA',
          'corners_alpha':corners,'alpha_bbox':list(b),'bottom_of_alpha_y':b[3],
          'head_top_y':b[1],'cap_included':name=='keeper','standing_height':height,
          'soles_y':list(sole_y),'anchor':{'x':512,'y':900},'shared_scale':shared_scale,
          'canonical_source_edge':canonical_edge,'native_canvas_factor':native_factor,
          'applied_downscale':applied_scale,'translation':[offset_x,offset_y],
          'mirror_to_right':entry['mirror_to_right'],'upper_garment_rgb_pixels_adjusted':rgb_adjusted,
          'pose':'upright, arms down, slightly viewer-right, slightly elevated camera',
          'pass':True})
    (CHECKS/'city-hunt-scale.json').write_text(json.dumps(config,indent=2)+'\n')
    (CHECKS/'city-hunt-figures.json').write_text(json.dumps(reports,indent=2)+'\n')
    print(json.dumps([{'file':r['file'],'height':r['standing_height'],'head_top':r['head_top_y'],'soles':r['soles_y'],'shared_scale':r['shared_scale']} for r in reports],indent=2))

if __name__ == '__main__':
    main()
