import pymupdf
from pathlib import Path

out = Path(r"c:\Users\s.shyaka\Desktop\B-ZENETH\public\brand")
out.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(r"c:\Users\s.shyaka\Desktop\B-ZENETH\0 (1).pdf")

page = doc[0]
pix = page.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5))
cover = out / "cover.png"
pix.save(str(cover))
print("cover", cover.exists(), cover.stat().st_size, "page", page.rect)

seen = set()
for i, pg in enumerate(doc):
    for img in pg.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        info = doc.extract_image(xref)
        if info["width"] < 180 or info["height"] < 180:
            continue
        dest = out / f"img-{i + 1:02d}-{xref}-{info['width']}x{info['height']}.{info['ext']}"
        dest.write_bytes(info["image"])
        print(dest.name, dest.stat().st_size)

print("files", [p.name for p in out.iterdir()])
