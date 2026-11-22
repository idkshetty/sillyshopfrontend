from PIL import Image
from pathlib import Path
for name,limit in [('silly-sensei-loading',560),('loading-doodles',480),('brand-logo',360)]:
    source=Path('frontend/assets')/(name+'.png')
    image=Image.open(source)
    image.thumbnail((limit,limit),Image.Resampling.LANCZOS)
    target=source.with_suffix('.webp')
    image.save(target,'WEBP',quality=85,method=4)
    print(name,source.stat().st_size,'->',target.stat().st_size,flush=True)
for path in list(Path('frontend').glob('*.js'))+list(Path('frontend').glob('*.css'))+[Path('frontend/shop.html')]:
    text=path.read_text(encoding='utf-8')
    for name in ['silly-sensei-loading','loading-doodles','brand-logo']:
        text=text.replace('assets/'+name+'.png','assets/'+name+'.webp')
    path.write_text(text,encoding='utf-8')
