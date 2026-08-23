#!/usr/bin/env python3
# hlidarendi/tools/bake-terrain.py — bake the real ground into src/terrain-data.js.
# Hlíðarendi, Fljótshlíð, Iceland (63.7422 N, 20.1080 W): fetches z14 terrarium
# elevation tiles from the public AWS set (the same source the Terrarium builds
# read), decodes h = (R*256 + G + B/256) - 32768, windows a ~1 km patch on the
# farmstead, and quantizes relative heights to uint16. Change LAT/LON/Z to bake
# any other place on earth. Needs: pillow, network.
import math, os, ssl, struct, base64, urllib.request
from PIL import Image
LAT, LON, Z, N = 63.7422, -20.1080, 14, 232
n2 = 2 ** Z
xf = (LON + 180) / 360 * n2
lr = math.radians(LAT)
yf = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n2
x0t, y0t = int(xf), int(yf)
here = os.path.dirname(os.path.abspath(__file__))
tdir = os.path.join(here, 'tiles'); os.makedirs(tdir, exist_ok=True)
tiles = {}
for dx in (0, 1):
    for dy in (0, 1):
        tx, ty = x0t + dx, y0t + dy
        p = os.path.join(tdir, f'{Z}_{tx}_{ty}.png')
        if not os.path.exists(p):
            urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png', p)
        tiles[(tx, ty)] = Image.open(p).convert('RGB')
def h_at(gx, gy):
    tx, ty = x0t + gx // 256, y0t + gy // 256
    r, g, b = tiles[(tx, ty)].getpixel((gx % 256, gy % 256))
    return (r * 256 + g + b / 256) - 32768
CX, CY = (xf - x0t) * 256, (yf - y0t) * 256
x0 = int(max(0, min(512 - N, CX - N / 2))); y0 = int(max(0, min(512 - N, CY - N / 2)))
res = 156543.03 * math.cos(lr) / n2
base = h_at(int(CX), int(CY))
vals, mn, mx = [], 1e9, -1e9
for j in range(N):
    for i in range(N):
        h = h_at(x0 + i, y0 + j) - base
        vals.append(h); mn = min(mn, h); mx = max(mx, h)
scale = (mx - mn) / 65535
buf = bytearray()
for h in vals: buf += struct.pack('<H', int((h - mn) / scale + 0.5))
b64 = base64.b64encode(bytes(buf)).decode()
out = os.path.join(here, '..', 'src', 'terrain-data.js')
with open(out, 'w') as f:
    f.write(f'''// hlidarendi/src/terrain-data.js — REAL GROUND, baked by tools/bake-terrain.py.
// Hlíðarendi, Fljótshlíð, Iceland ({LAT} N, {-LON} W) — the farm Gunnar turned
// back for. Elevation from the public AWS terrarium tile set, z{Z}, a {N}x{N}
// window ({round(N*res)} m across) centred on the farmstead, heights relative
// to the farm datum ({round(base,1)} m a.s.l.), quantized to uint16.
export const TERRAIN = {{
  n: {N}, res: {round(res, 4)},
  min: {round(mn, 2)}, max: {round(mx, 2)},
  cx: {round(CX - x0, 2)}, cy: {round(CY - y0, 2)},
  b64: "{b64}"
}};
''')
print('wrote', out, os.path.getsize(out))
