from pathlib import Path
from PIL import Image,ImageDraw
A=Path(__file__).resolve().parents[1];ids=['spellbook','escape-pod','crystal-ball','wishing-lamp','potion','pocket-watch','diploma-tube','baby-shoes','memorial-candle','rocket-tin'];paper=(246,248,251);out=Image.new('RGB',(1200,900),paper);d=ImageDraw.Draw(out)
for i,id in enumerate(ids):
 im=Image.open(A/'vessels'/f'vessel-{id}.png').convert('RGBA');bg=Image.new('RGBA',im.size,paper+(255,));bg.alpha_composite(im);x=i%5*240;y=i//5*450;out.paste(bg.convert('RGB').resize((240,240),Image.Resampling.LANCZOS),(x,y));d.text((x+12,y+240),id,fill=(22,38,63));preview=Image.open(A/'_checks'/f'{id}-motion.png').convert('RGB');preview=preview.crop((880,40,1320,480)).resize((180,180),Image.Resampling.LANCZOS);out.paste(preview,(x+30,y+265));d.text((x+12,y+425),'open',fill=(22,38,63))
out.save(A/'_checks/b6-contact-sheet.png',optimize=True)
