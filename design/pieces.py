"""Generates the Tamer's Court piece sets as SVG. Run: python3 design/pieces.py"""
import os, json

# Each figure is drawn in a 100x100 box, standing on y=74 (the base is added separately).
# 'body' paths take the piece fill; 'detail' paths take the detail colour; 'cut' paths take the background-ish colour.
BODY = "M37 74 L41 50 L59 50 L63 74 Z"
FIG = {
 'king': dict(body=[BODY, "M33 50 L31 27 L41 37 L50 21 L59 37 L69 27 L67 50 Z"],
              ball=[(31,24,3.4),(50,17.5,3.6),(69,24,3.4)],
              detail=["M34 45 L66 45", "M39 62 L61 62"]),
 'prince': dict(body=[BODY, "M35 50 L35 36 Q50 22 65 36 L65 50 Z"],
              crescent=(50,15),
              detail=["M36 45 L64 45", "M39 62 L61 62"]),
 'advking': dict(body=[BODY, "M33 50 L33 33 L41.5 39 L50 31 L58.5 39 L67 33 L67 50 Z"],
              star=(50,20),
              detail=["M34 45 L66 45", "M39 62 L61 62"]),
 'general': dict(body=[BODY, "M34 50 Q33 30 50 24 Q67 30 66 50 Z", "M48 25 L50 9 L52 25 Z"],
              detail=["M32 48 L68 48", "M50 30 L50 44", "M39 62 L61 62"]),
 'vizier': dict(body=[BODY, "M32 50 Q29 31 50 27 Q71 31 68 50 Z", "M50 29 Q58 18 54 8 Q66 14 58 30 Z"],
              detail=["M34 38 Q50 32 66 40", "M33 45 Q50 39 67 47", "M39 62 L61 62"], jewel=(50,36,3)),
 'giraffe': dict(body=["M64 74 L43 74 Q47 62 47 52 Q47 39 41 30 Q39 27 33 28 L26 28 Q21 26 23 21 Q27 15 35 15 L35 8 L38.5 8 L38.5 13.5 L41.5 13.5 L41.5 8 L45 8 L45 15.5 Q51 19 53 29 Q59 42 61 52 Q66 62 64 74 Z"],
              spots=[(50,40,2.6),(55,52,2.8),(51,62,2.6),(58,65,2.2),(46,30,2)], eye=(33,21)),
 'picket': dict(body=["M38 74 L44 52 L56 52 L62 74 Z", "M48.5 52 L48.5 18 L51.5 18 L51.5 52 Z", "M47 19 L50 7 L53 19 Z",
                      "M51.5 21 L76 25 L68 31 L76 37 L51.5 41 Z"],
              detail=["M41 64 L59 64"]),
 'knight': dict(body=["M65 74 L36 74 Q35 63 44 56 Q47 52 43 50 L33 55 Q26 56 25 49 L27 44 Q37 35 41 27 L39 17 L46 22 Q52 18 58 20 Q72 27 70 47 Q68 62 65 74 Z"],
              eye=(44,32), detail=["M58 24 Q66 34 64 52", "M53 23 Q61 32 59 46"]),
 'rook': dict(body=["M37 74 L39 41 L34 41 L34 25 L41 25 L41 31 L46.5 31 L46.5 25 L53.5 25 L53.5 31 L59 31 L59 25 L66 25 L66 41 L61 41 L63 74 Z"],
              cut=["M46 74 L46 62 Q50 56 54 62 L54 74 Z", "M48 47 L48 41 Q50 38 52 41 L52 47 Z"], detail=["M36 41 L64 41"]),
 'elephant': dict(body=["M64 74 L39 74 Q41 65 39 58 Q31 60 29 66 Q27 72 22 70 Q19 62 25 54 Q30 46 31 37 Q33 24 47 22 Q60 21 64 32 Q70 50 64 74 Z"],
              ear=["M50 30 Q70 22 74 40 Q75 58 58 60 Q51 50 50 30 Z"], tusk="M35 51 Q30 57 36 61", eye=(40,35),
              detail=["M56 36 Q66 34 68 46", "M33 31 Q41 26 49 28"], jewel=(41,28,2.4)),
 'camel': dict(body=["M36 74 L36 57 Q30 53 27 46 Q25 40 26 34 L19 33 Q14 32 14 28 Q15 23 22 23 Q30 23 32 30 Q33 39 39 45 Q48 25 62 37 Q70 40 73 46 Q76 52 72 58 L71 74 L66 74 L66 59 L43 59 L42 74 Z"],
              eye=(21,27), detail=["M73 48 Q79 53 76 60", "M46 47 Q55 43 64 47"]),
 'engine': dict(body=["M35 68 L40 22 L60 22 L65 68 Z", "M38 22 L38 15 L44 15 L44 19 L48 19 L48 15 L52 15 L52 19 L56 19 L56 15 L62 15 L62 22 Z",
                      "M19 49 L37 49 L37 56 L19 56 Z", "M15 46 L21 52.5 L15 59 Z"],
              wheels=[(42,70,5.5),(58,70,5.5)], cut=["M45 68 L45 50 L55 50 L55 68 Z"], detail=["M39 34 L61 34"]),
}
PAWN_BODY = ["M40 74 Q45 62 44 57 L56 57 Q55 62 60 74 Z", "M37 58 L63 58 L63 53 L37 53 Z"]
PAWN_OF = {'pawn':None,'engine':'engine','camel':'camel','elephant':'elephant','general':'general','king':'prince',
           'vizier':'vizier','giraffe':'giraffe','picket':'picket','knight':'knight','rook':'rook'}
BASE = ["M21 89 Q21 81 29 81 L71 81 Q79 81 79 89 L79 91 L21 91 Z", "M31 81 L33 74 L67 74 L69 81 Z"]

def star(cx, cy, r1=6.5, r2=3):
    import math
    pts = []
    for i in range(16):
        r = r1 if i % 2 == 0 else r2
        a = math.pi * i / 8 - math.pi / 2
        pts.append(f"{cx + r*math.cos(a):.2f} {cy + r*math.sin(a):.2f}")
    return "M" + " L".join(pts) + " Z"

def figure(name, fill, ink, detail, cut, sw=2.6):
    f = FIG[name]; out = []
    S = f'stroke="{ink}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"'
    for p in f.get('body', []): out.append(f'<path d="{p}" fill="{fill}" {S}/>')
    for p in f.get('ear', []): out.append(f'<path d="{p}" fill="{fill}" {S}/>')
    for (x,y,r) in f.get('wheels', []): out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" {S}/><circle cx="{x}" cy="{y}" r="1.6" fill="{ink}"/>')
    for (x,y,r) in f.get('ball', []): out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{detail}" {S}/>')
    if 'crescent' in f:
        x,y = f['crescent']; out.append(f'<path d="M{x-5} {y} A6 6 0 1 0 {x+5} {y-3} A4.6 4.6 0 1 1 {x-5} {y} Z" fill="{detail}" {S}/>')
    if 'star' in f: out.append(f'<path d="{star(*f["star"])}" fill="{detail}" {S}/>')
    for p in f.get('cut', []): out.append(f'<path d="{p}" fill="{cut}" {S}/>')
    for p in f.get('detail', []): out.append(f'<path d="{p}" fill="none" stroke="{ink}" stroke-width="{sw*0.75}" stroke-linecap="round"/>')
    if 'tusk' in f: out.append(f'<path d="{f["tusk"]}" fill="none" stroke="{detail}" stroke-width="3.4" stroke-linecap="round"/><path d="{f["tusk"]}" fill="none" stroke="{ink}" stroke-width="0.8" stroke-linecap="round" opacity=".5"/>')
    if 'jewel' in f: x,y,r=f['jewel']; out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{detail}" {S}/>')
    for (x,y,r) in f.get('spots', []): out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{detail}"/>')
    if 'eye' in f: x,y=f['eye']; out.append(f'<circle cx="{x}" cy="{y}" r="2" fill="{ink}"/>')
    return "".join(out)

PAL = {
 'white': dict(fill='#f4ecd8', ink='#1c2541', detail='#c9973a', cut='#1c2541', base='#e6dcc2'),
 'black': dict(fill='#1f2e57', ink='#0b1124', detail='#e3b65c', cut='#e3b65c', base='#16224a'),
}

def staunton(name, side, of=None):
    """Free-standing silhouette piece on a plinth."""
    P = PAL[side]; S = f'stroke="{P["ink"]}" stroke-width="2.6" stroke-linejoin="round"'
    base = "".join(f'<path d="{p}" fill="{P["base"]}" {S}/>' for p in BASE)
    if name == 'pawn':
        body = "".join(f'<path d="{p}" fill="{P["fill"]}" {S}/>' for p in PAWN_BODY)
        head = f'<circle cx="50" cy="35" r="19" fill="{P["fill"]}" {S}/>'
        emblem = ''
        if of:
            emblem = f'<g transform="translate(50 35) scale(0.31) translate(-50 -45)">{figure(of, P["ink"], P["ink"], P["detail"], P["fill"], sw=0.1)}</g>'
        else:
            emblem = f'<circle cx="50" cy="35" r="6" fill="{P["detail"]}" stroke="{P["ink"]}" stroke-width="2"/>'
        return base + body + head + emblem
    return base + figure(name, P['fill'], P['ink'], P['detail'], P['cut'])

def medallion(name, side, of=None, royal=False):
    """Tile medallion: the figure set inside a round glazed token."""
    if side == 'white': disc, ring, fig, ink, det, cut = '#f4ecd8', '#22407a', '#22407a', '#22407a', '#c9973a', '#f4ecd8'
    else: disc, ring, fig, ink, det, cut = '#22407a', '#0e1a3a', '#f4ecd8', '#0e1a3a', '#e3b65c', '#22407a'
    ringc = '#c9973a' if royal else ring
    out = f'<circle cx="50" cy="50" r="45" fill="{disc}" stroke="{ringc}" stroke-width="{6 if royal else 4.5}"/>'
    out += f'<circle cx="50" cy="50" r="38" fill="none" stroke="{ringc}" stroke-width="1.2" stroke-dasharray="2 3" opacity=".7"/>'
    if name == 'pawn':
        r = 24 if of else 14
        out += f'<circle cx="50" cy="50" r="{r}" fill="none" stroke="{fig}" stroke-width="2.4"/>'
        if of: out += f'<g transform="translate(50 50) scale(0.36) translate(-50 -46)">{figure(of, fig, fig, det, cut, sw=0.1)}</g>'
        else: out += f'<circle cx="50" cy="50" r="6" fill="{det}"/>'
        return out
    out += f'<g transform="translate(50 52) scale(0.74) translate(-50 -46)">{figure(name, fig, ink, det, cut, sw=2.2)}</g>'
    return out

def svg(inner): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{inner}</svg>'

ORDER = ['king','prince','advking','general','vizier','giraffe','picket','knight','rook','elephant','camel','engine','pawn']
ROYAL = {'king','prince','advking'}
if __name__ == '__main__':
    root = os.path.dirname(os.path.abspath(__file__))
    data = {}
    for style in ('staunton', 'medallion'):
        for side in ('white', 'black'):
            for n in ORDER:
                inner = staunton(n, side) if style == 'staunton' else medallion(n, side, royal=n in ROYAL)
                data[f'{style}/{side}/{n}'] = svg(inner)
            for of, fig in PAWN_OF.items():
                inner = staunton('pawn', side, fig) if style == 'staunton' else medallion('pawn', side, fig)
                data[f'{style}/{side}/pawn-of-{of}'] = svg(inner)
    json.dump(data, open(os.path.join(root, 'pieces.json'), 'w'), indent=0)
    print(len(data), 'pieces')
