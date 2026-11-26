"""
Generates 6 rich hand-painted Biome Battle Arena Backdrops (1280x720)
and 28 bespoke beveled brass-and-enamel Action Symbol Medallions (256x256)
plus 4 Tier Border Overlays for Gearbound.
STRICT: Zero faces/eyes, zero casino icons, zero magic/occult imagery.
"""
import math
import os
import cairo
import numpy as np
from PIL import Image
from art_core import (
    make_surface, surface_to_pil, apply_surface_grain, apply_pbr_bevel,
    draw_rounded_rect, draw_rivet, draw_cogwheel, save_png
)

OUT_BIOMES = r"d:\Spin Adventure Neon\public\assets\biomes"
OUT_SYMS = r"d:\Spin Adventure Neon\public\assets\symbols"

def draw_biome(idx, fname, sky_stops, arch_col, floor_col, accent_col, gear_style, theme_tag):
    W, H = 1280, 720
    surf, ctx = make_surface(W, H)

    # 1. Atmospheric sky / vault backdrop
    g = cairo.LinearGradient(0, 0, 0, H * 0.78)
    for stop, rgb in sky_stops:
        g.add_color_stop_rgb(stop, *rgb)
    ctx.set_source(g)
    ctx.rectangle(0, 0, W, H * 0.80)
    ctx.fill()

    # 2. Distant mountains / architectural silhouettes
    ctx.save()
    if theme_tag == "frost":
        # Crisp sunlit alpine peaks
        peaks = [(0, 480), (180, 260), (360, 410), (580, 185), (820, 390), (1040, 230), (1280, 420), (1280, 580), (0, 580)]
        ctx.move_to(*peaks[0])
        for p in peaks[1:]: ctx.line_to(*p)
        ctx.close_path()
        gm = cairo.LinearGradient(0, 185, 0, 560)
        gm.add_color_stop_rgb(0.0, 0.94, 0.97, 1.0)
        gm.add_color_stop_rgb(0.5, 0.62, 0.72, 0.84)
        gm.add_color_stop_rgb(1.0, 0.34, 0.42, 0.54)
        ctx.set_source(gm)
        ctx.fill()
    elif theme_tag == "ruins":
        # Sunlit distant ruin aqueduct arches
        ctx.set_source_rgba(arch_col[0] * 1.15, arch_col[1] * 1.12, arch_col[2] * 1.08, 0.55)
        for ax in range(60, W, 220):
            ctx.rectangle(ax, 250, 38, 320)
            ctx.fill()
            ctx.arc(ax + 129, 290, 91, math.pi, 0)
            ctx.set_line_width(26)
            ctx.stroke()
    elif theme_tag == "catacombs":
        # Canyon stepped sandstone cliff buttresses
        for bx in [40, 280, 860, 1100]:
            ctx.set_source_rgba(arch_col[0] * 0.92, arch_col[1] * 0.88, arch_col[2] * 0.82, 0.62)
            ctx.rectangle(bx, 110, 130, 450)
            ctx.fill()
    elif theme_tag == "foundry":
        # Arched forge furnaces glowing warmly behind iron grates
        for fx in [260, 640, 1020]:
            rg = cairo.RadialGradient(fx, 410, 18, fx, 410, 170)
            rg.add_color_stop_rgba(0, 1.0, 0.78, 0.28, 0.92)
            rg.add_color_stop_rgba(0.5, 0.88, 0.36, 0.10, 0.55)
            rg.add_color_stop_rgba(1, 0.3, 0.1, 0.04, 0.0)
            ctx.set_source(rg)
            ctx.arc(fx, 410, 170, 0, math.tau)
            ctx.fill()
            # Furnace arch grate
            ctx.set_source_rgb(0.14, 0.12, 0.12)
            ctx.set_line_width(10)
            for gx in range(fx - 54, fx + 60, 18):
                ctx.move_to(gx, 320); ctx.line_to(gx, 520); ctx.stroke()
    ctx.restore()

    # 3. Monumental architectural clockwork gears embedded in midground
    ctx.save()
    ctx.push_group()
    if theme_tag in ("spire", "citadel", "foundry"):
        draw_cogwheel(ctx, W * 0.5, 290, 250, 80, teeth=20, spokes=6, style=gear_style, angle=0.18)
        draw_cogwheel(ctx, W * 0.24, 210, 145, 45, teeth=14, spokes=5, style="iron", angle=0.5)
        draw_cogwheel(ctx, W * 0.78, 220, 165, 52, teeth=16, spokes=5, style="brass", angle=0.3)
    else:
        draw_cogwheel(ctx, W * 0.5, 250, 195, 65, teeth=16, spokes=6, style=gear_style, angle=0.25)
        draw_cogwheel(ctx, W * 0.78, 175, 115, 36, teeth=12, spokes=4, style="brass", angle=0.4)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(0.72 if theme_tag in ("spire", "foundry") else 0.42)
    ctx.restore()

    # 4. Left & Right Framing Stone/Brass Pillars + Vaulted Arch Ribs
    for px in [0, W - 122]:
        gp = cairo.LinearGradient(px, 0, px + 122, 0)
        gp.add_color_stop_rgb(0.0, arch_col[0] * 0.65, arch_col[1] * 0.65, arch_col[2] * 0.65)
        gp.add_color_stop_rgb(0.5, arch_col[0] * 1.05, arch_col[1] * 1.05, arch_col[2] * 1.05)
        gp.add_color_stop_rgb(1.0, arch_col[0] * 0.55, arch_col[1] * 0.55, arch_col[2] * 0.55)
        ctx.set_source(gp)
        ctx.rectangle(px, 0, 122, H * 0.78)
        ctx.fill()
        # Stone courses & brass bands
        ctx.set_source_rgba(0.08, 0.06, 0.04, 0.35)
        ctx.set_line_width(3)
        for sy in range(70, int(H * 0.76), 78):
            ctx.move_to(px, sy); ctx.line_to(px + 122, sy); ctx.stroke()
        # Brass collar ring
        ctx.set_source_rgb(*accent_col)
        ctx.rectangle(px - 4, 150, 130, 20)
        ctx.rectangle(px - 4, 460, 130, 20)
        ctx.fill()

    # Overhead vaulted arch framing top edge
    ctx.move_to(0, 0); ctx.line_to(W, 0); ctx.line_to(W, 130)
    ctx.curve_to(W * 0.75, 25, W * 0.25, 25, 0, 130); ctx.close_path()
    ctx.set_source_rgba(arch_col[0] * 0.55, arch_col[1] * 0.55, arch_col[2] * 0.55, 0.92)
    ctx.fill_preserve()
    ctx.set_source_rgb(*accent_col)
    ctx.set_line_width(6)
    ctx.stroke()

    # Hanging lantern braziers / brass astrolabe rings
    for lx in [290, 990]:
        ctx.set_source_rgb(0.24, 0.20, 0.16)
        ctx.set_line_width(4)
        ctx.move_to(lx, 35); ctx.line_to(lx, 178); ctx.stroke()
        # Warm lantern glow
        gl = cairo.RadialGradient(lx, 198, 5, lx, 198, 92)
        gl.add_color_stop_rgba(0, 1.0, 0.94, 0.68, 0.85)
        gl.add_color_stop_rgba(0.45, 0.96, 0.68, 0.24, 0.35)
        gl.add_color_stop_rgba(1, 0.9, 0.5, 0.1, 0.0)
        ctx.set_source(gl)
        ctx.arc(lx, 198, 92, 0, math.tau)
        ctx.fill()
        # Brass lantern cage
        draw_rounded_rect(ctx, lx - 18, 176, 36, 44, 8)
        ctx.set_source_rgb(0.98, 0.86, 0.44)
        ctx.fill_preserve()
        ctx.set_source_rgb(0.16, 0.11, 0.06)
        ctx.set_line_width(4)
        ctx.stroke()

    # 5. Volumetric Diagonal Sunbeams (softened in center so fighters pop!)
    ctx.save()
    for sx in [220, 560, 880]:
        ctx.move_to(sx, 0); ctx.line_to(sx + 135, 0)
        ctx.line_to(sx - 90, H * 0.78); ctx.line_to(sx - 235, H * 0.78); ctx.close_path()
        gb = cairo.LinearGradient(sx, 0, sx - 120, H * 0.78)
        gb.add_color_stop_rgba(0, 1.0, 0.95, 0.78, 0.20 if theme_tag != "foundry" else 0.12)
        gb.add_color_stop_rgba(1, 1.0, 0.90, 0.68, 0.0)
        ctx.set_source(gb)
        ctx.fill()
    ctx.restore()

    # 6. Clear, Flat, Unobstructed Battle Stage Floor (Bottom 24%: y=545..720)
    fy = 544
    gf = cairo.LinearGradient(0, fy, 0, H)
    gf.add_color_stop_rgb(0.0, floor_col[0] * 1.12, floor_col[1] * 1.12, floor_col[2] * 1.12)
    gf.add_color_stop_rgb(0.35, floor_col[0] * 0.95, floor_col[1] * 0.95, floor_col[2] * 0.95)
    gf.add_color_stop_rgb(1.0, floor_col[0] * 0.56, floor_col[1] * 0.56, floor_col[2] * 0.56)
    ctx.set_source(gf)
    ctx.rectangle(0, fy, W, H - fy)
    ctx.fill()

    # Top stone curb / brass trim edge of battle terrace
    ctx.set_source_rgb(*accent_col)
    ctx.rectangle(0, fy - 6, W, 10)
    ctx.fill()
    ctx.set_source_rgba(0.06, 0.04, 0.02, 0.65)
    ctx.rectangle(0, fy + 4, W, 5)
    ctx.fill()

    # Perspective flagstone seams across the battle floor
    ctx.set_source_rgba(0.08, 0.06, 0.04, 0.34)
    ctx.set_line_width(2.5)
    for row_y in [580, 626, 680]:
        ctx.move_to(0, row_y); ctx.line_to(W, row_y); ctx.stroke()
    for i in range(-6, 15):
        top_x = W * 0.5 + i * 95
        bot_x = W * 0.5 + i * 165
        ctx.move_to(top_x, fy + 6); ctx.line_to(bot_x, H); ctx.stroke()

    img = apply_surface_grain(surface_to_pil(surf), strength=0.055, seed=100 + idx)
    save_png(img, os.path.join(OUT_BIOMES, fname))

def gen_all_biomes():
    specs = [
        (1, "biome_1.png",
         [(0.0, (0.48, 0.72, 0.88)), (0.45, (0.92, 0.86, 0.68)), (1.0, (0.88, 0.74, 0.50))],
         (0.76, 0.65, 0.48), (0.74, 0.63, 0.46), (0.86, 0.68, 0.28), "brass", "ruins"),
        (2, "biome_2.png",
         [(0.0, (0.44, 0.24, 0.14)), (0.45, (0.82, 0.50, 0.24)), (1.0, (0.94, 0.74, 0.42))],
         (0.64, 0.42, 0.24), (0.68, 0.48, 0.28), (0.92, 0.64, 0.24), "copper", "catacombs"),
        (3, "biome_3.png",
         [(0.0, (0.14, 0.11, 0.12)), (0.55, (0.28, 0.18, 0.14)), (1.0, (0.48, 0.24, 0.12))],
         (0.32, 0.31, 0.34), (0.34, 0.32, 0.34), (0.88, 0.54, 0.20), "iron", "foundry"),
        (4, "biome_4.png",
         [(0.0, (0.34, 0.56, 0.80)), (0.5, (0.72, 0.84, 0.94)), (1.0, (0.88, 0.92, 0.96))],
         (0.56, 0.62, 0.70), (0.64, 0.70, 0.78), (0.84, 0.72, 0.36), "iron", "frost"),
        (5, "biome_5.png",
         [(0.0, (0.34, 0.28, 0.20)), (0.5, (0.76, 0.64, 0.40)), (1.0, (0.96, 0.88, 0.64))],
         (0.58, 0.46, 0.26), (0.66, 0.58, 0.44), (0.96, 0.80, 0.34), "brass", "spire"),
        (6, "biome_6.png",
         [(0.0, (0.24, 0.30, 0.46)), (0.45, (0.72, 0.68, 0.58)), (1.0, (0.96, 0.90, 0.72))],
         (0.80, 0.76, 0.66), (0.78, 0.74, 0.64), (0.98, 0.82, 0.32), "brass", "citadel"),
    ]
    for s in specs:
        draw_biome(*s)

# ---------------- 28 BESPOKE ACTION SYMBOL MEDALLIONS ----------------

def draw_medallion_base(ctx, S, bg_top, bg_bot, rim_style="brass"):
    cx, cy = S / 2, S / 2
    # Outer metallic bevel badge
    draw_rounded_rect(ctx, 14, 14, S - 28, S - 28, 36)
    gr = cairo.LinearGradient(14, 14, S - 14, S - 14)
    if rim_style == "brass":
        gr.add_color_stop_rgb(0.0, 0.98, 0.88, 0.52)
        gr.add_color_stop_rgb(0.45, 0.76, 0.55, 0.18)
        gr.add_color_stop_rgb(1.0, 0.42, 0.26, 0.08)
    else:
        gr.add_color_stop_rgb(0.0, 0.82, 0.86, 0.92)
        gr.add_color_stop_rgb(0.5, 0.46, 0.50, 0.56)
        gr.add_color_stop_rgb(1.0, 0.22, 0.24, 0.28)
    ctx.set_source(gr)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.07, 0.03)
    ctx.set_line_width(6)
    ctx.stroke()

    # Recessed rich enamel face
    draw_rounded_rect(ctx, 28, 28, S - 56, S - 56, 26)
    ge = cairo.RadialGradient(cx, cy * 0.78, 12, cx, cy, S * 0.52)
    ge.add_color_stop_rgb(0.0, *bg_top)
    ge.add_color_stop_rgb(1.0, *bg_bot)
    ctx.set_source(ge)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.08, 0.05, 0.02, 0.75)
    ctx.set_line_width(4)
    ctx.stroke()

    # Subtle engraved inner ring
    ctx.arc(cx, cy, S * 0.33, 0, math.tau)
    ctx.set_source_rgba(1.0, 0.94, 0.74, 0.18)
    ctx.set_line_width(2.5)
    ctx.stroke()

    # Corner mini-rivets
    for rx, ry in [(34, 34), (S - 34, 34), (34, S - 34), (S - 34, S - 34)]:
        draw_rivet(ctx, rx, ry, r=4.8, style="brass")

def draw_sword_shape(ctx, length=130, width=26, angle=-0.78, blade_col=(0.94, 0.96, 1.0), hilt_col=(0.94, 0.74, 0.26)):
    ctx.save()
    ctx.rotate(angle)
    # Blade
    ctx.move_to(0, -length * 0.62)
    ctx.line_to(width * 0.5, -length * 0.38)
    ctx.line_to(width * 0.40, length * 0.26)
    ctx.line_to(-width * 0.40, length * 0.26)
    ctx.line_to(-width * 0.5, -length * 0.38)
    ctx.close_path()
    gb = cairo.LinearGradient(-width, 0, width, 0)
    gb.add_color_stop_rgb(0.0, blade_col[0] * 0.62, blade_col[1] * 0.65, blade_col[2] * 0.72)
    gb.add_color_stop_rgb(0.48, *blade_col)
    gb.add_color_stop_rgb(1.0, blade_col[0] * 0.45, blade_col[1] * 0.48, blade_col[2] * 0.56)
    ctx.set_source(gb)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05)
    ctx.set_line_width(5)
    ctx.stroke()
    # Center fuller ridge
    ctx.move_to(0, -length * 0.50); ctx.line_to(0, length * 0.22)
    ctx.set_source_rgba(1, 1, 1, 0.65); ctx.set_line_width(2.5); ctx.stroke()
    # Crossguard
    draw_rounded_rect(ctx, -width * 1.45, length * 0.22, width * 2.9, 16, 6)
    ctx.set_source_rgb(*hilt_col); ctx.fill_preserve()
    ctx.set_source_rgb(0.12, 0.08, 0.03); ctx.set_line_width(4); ctx.stroke()
    # Grip & pommel
    draw_rounded_rect(ctx, -7, length * 0.34, 14, 34, 4)
    ctx.set_source_rgb(0.36, 0.18, 0.10); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(3.5); ctx.stroke()
    ctx.arc(0, length * 0.62, 11, 0, math.tau)
    ctx.set_source_rgb(*hilt_col); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(3.5); ctx.stroke()
    ctx.restore()

def draw_shield_shape(ctx, r=66, c0=(0.30, 0.56, 0.86), c1=(0.14, 0.28, 0.48), spikes=False):
    ctx.save()
    ctx.move_to(0, -r)
    ctx.curve_to(r * 0.92, -r * 0.92, r * 0.96, -r * 0.15, r * 0.78, r * 0.38)
    ctx.curve_to(r * 0.55, r * 0.82, r * 0.22, r * 1.02, 0, r * 1.12)
    ctx.curve_to(-r * 0.22, r * 1.02, -r * 0.55, r * 0.82, -r * 0.78, r * 0.38)
    ctx.curve_to(-r * 0.96, -r * 0.15, -r * 0.92, -r * 0.92, 0, -r)
    ctx.close_path()
    gs = cairo.LinearGradient(-r, -r, r, r)
    gs.add_color_stop_rgb(0.0, *c0)
    gs.add_color_stop_rgb(1.0, *c1)
    ctx.set_source(gs)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.95, 0.78, 0.36)
    ctx.set_line_width(9)
    ctx.stroke()
    # Center boss & brass cross
    ctx.move_to(0, -r * 0.82); ctx.line_to(0, r * 0.92)
    ctx.move_to(-r * 0.68, -r * 0.12); ctx.line_to(r * 0.68, -r * 0.12)
    ctx.set_source_rgba(0.96, 0.84, 0.48, 0.85); ctx.set_line_width(7); ctx.stroke()
    ctx.arc(0, -r * 0.12, 16, 0, math.tau)
    ctx.set_source_rgb(0.98, 0.86, 0.46); ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.09, 0.04); ctx.set_line_width(4); ctx.stroke()
    if spikes:
        for a in np.linspace(0, math.tau, 8, endpoint=False):
            sx, sy = math.cos(a) * (r * 0.98), math.sin(a) * (r * 0.98)
            tx, ty = math.cos(a) * (r * 1.24), math.sin(a) * (r * 1.24)
            ctx.move_to(sx - math.sin(a) * 8, sy + math.cos(a) * 8)
            ctx.line_to(tx, ty)
            ctx.line_to(sx + math.sin(a) * 8, sy - math.cos(a) * 8)
            ctx.close_path()
            ctx.set_source_rgb(0.88, 0.90, 0.95); ctx.fill_preserve()
            ctx.set_source_rgb(0.12, 0.12, 0.14); ctx.set_line_width(3); ctx.stroke()
    ctx.restore()

def gen_all_symbols():
    S = 256
    cx, cy = S / 2, S / 2
    symbols = [
        ("vanguard_blade", (0.64, 0.24, 0.18), (0.28, 0.09, 0.08)),
        ("heavy_broadsword", (0.72, 0.20, 0.14), (0.30, 0.07, 0.06)),
        ("twin_daggers", (0.68, 0.30, 0.16), (0.28, 0.11, 0.07)),
        ("siege_crossbow", (0.24, 0.52, 0.46), (0.09, 0.22, 0.20)),
        ("volley_arbalest", (0.20, 0.58, 0.52), (0.08, 0.24, 0.22)),
        ("tower_shield", (0.22, 0.44, 0.72), (0.09, 0.18, 0.34)),
        ("spiked_buckler", (0.26, 0.38, 0.66), (0.10, 0.15, 0.30)),
        ("war_mace", (0.58, 0.34, 0.16), (0.24, 0.13, 0.06)),
        ("anvil_crusher", (0.52, 0.28, 0.18), (0.20, 0.10, 0.07)),
        ("field_kit", (0.20, 0.60, 0.36), (0.08, 0.26, 0.15)),
        ("steam_boiler", (0.76, 0.46, 0.18), (0.34, 0.18, 0.07)),
        ("gear_link", (0.76, 0.58, 0.18), (0.36, 0.24, 0.06)),
        ("master_cogwheel", (0.84, 0.66, 0.20), (0.40, 0.26, 0.06)),
        ("counter_parry", (0.30, 0.48, 0.74), (0.12, 0.20, 0.36)),
        ("grappling_hook", (0.42, 0.44, 0.48), (0.18, 0.19, 0.22)),
        ("oil_flint", (0.82, 0.38, 0.12), (0.36, 0.14, 0.04)),
        ("caltrops_pouch", (0.46, 0.38, 0.32), (0.20, 0.15, 0.12)),
        ("banner_resolve", (0.74, 0.22, 0.22), (0.34, 0.08, 0.09)),
        ("fortress_wall", (0.36, 0.44, 0.56), (0.16, 0.20, 0.28)),
        ("clock_pendulum", (0.66, 0.52, 0.22), (0.30, 0.22, 0.08)),
        ("bellows_vent", (0.70, 0.42, 0.20), (0.30, 0.16, 0.08)),
        ("whetstone", (0.46, 0.50, 0.56), (0.20, 0.22, 0.26)),
        ("riveted_plate", (0.32, 0.44, 0.60), (0.13, 0.19, 0.28)),
        ("blueprint", (0.18, 0.40, 0.68), (0.08, 0.18, 0.36)),
        ("ballista_bolt", (0.64, 0.28, 0.14), (0.28, 0.11, 0.05)),
        ("iron_chain", (0.42, 0.45, 0.50), (0.18, 0.19, 0.22)),
        ("signal_flare", (0.86, 0.54, 0.16), (0.40, 0.20, 0.05)),
        ("masterwork_core", (0.90, 0.72, 0.24), (0.42, 0.26, 0.06)),
    ]

    for sid, top_c, bot_c in symbols:
        surf, ctx = make_surface(S, S)
        draw_medallion_base(ctx, S, top_c, bot_c)
        ctx.save()
        ctx.translate(cx, cy)

        if sid == "vanguard_blade":
            draw_sword_shape(ctx, 146, 26, angle=0.68)
        elif sid == "heavy_broadsword":
            draw_sword_shape(ctx, 156, 38, angle=0.58, blade_col=(1.0, 0.94, 0.80))
        elif sid == "twin_daggers":
            ctx.save(); ctx.translate(-14, 0); draw_sword_shape(ctx, 118, 20, angle=-0.55); ctx.restore()
            ctx.save(); ctx.translate(14, 0); draw_sword_shape(ctx, 118, 20, angle=0.55); ctx.restore()
        elif sid in ("siege_crossbow", "volley_arbalest"):
            # Crossbow prod & stock
            ctx.rotate(-0.68)
            ctx.move_to(-66, -12); ctx.curve_to(-25, -48, 25, -48, 66, -12)
            ctx.set_source_rgb(0.86, 0.68, 0.30); ctx.set_line_width(12); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
            ctx.move_to(-64, -10); ctx.line_to(0, 22); ctx.line_to(64, -10)
            ctx.set_source_rgb(0.95, 0.92, 0.84); ctx.set_line_width(3.5); ctx.stroke()
            draw_rounded_rect(ctx, -9, -46, 18, 116, 6)
            ctx.set_source_rgb(0.46, 0.26, 0.14); ctx.fill_preserve()
            ctx.set_source_rgb(0.12, 0.07, 0.03); ctx.set_line_width(4); ctx.stroke()
            # Steel bolts
            offsets = [-14, 0, 14] if sid == "volley_arbalest" else [0]
            for ox in offsets:
                ctx.move_to(ox, -74); ctx.line_to(ox + 10, -52); ctx.line_to(ox - 10, -52); ctx.close_path()
                ctx.set_source_rgb(0.94, 0.96, 1.0); ctx.fill()
                ctx.move_to(ox, -54); ctx.line_to(ox, 20); ctx.set_line_width(4.5); ctx.stroke()
        elif sid == "tower_shield":
            draw_shield_shape(ctx, 64, (0.34, 0.60, 0.90), (0.14, 0.28, 0.50), spikes=False)
        elif sid == "spiked_buckler":
            draw_shield_shape(ctx, 56, (0.48, 0.54, 0.66), (0.20, 0.24, 0.34), spikes=True)
        elif sid in ("war_mace", "anvil_crusher"):
            ctx.rotate(0.68)
            draw_rounded_rect(ctx, -8, -18, 16, 94, 5)
            ctx.set_source_rgb(0.44, 0.26, 0.14); ctx.fill_preserve()
            ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(4); ctx.stroke()
            if sid == "war_mace":
                # Flanged steel mace head
                for a in np.linspace(0, math.tau, 6, endpoint=False):
                    ctx.move_to(0, -40); ctx.line_to(math.cos(a) * 44, -40 + math.sin(a) * 44)
                    ctx.set_source_rgb(0.86, 0.89, 0.95); ctx.set_line_width(14); ctx.stroke()
                ctx.arc(0, -40, 24, 0, math.tau)
                ctx.set_source_rgb(0.70, 0.74, 0.80); ctx.fill_preserve()
                ctx.set_source_rgb(0.12, 0.12, 0.15); ctx.set_line_width(4); ctx.stroke()
            else:
                draw_rounded_rect(ctx, -48, -68, 96, 52, 10)
                ctx.set_source_rgb(0.58, 0.62, 0.68); ctx.fill_preserve()
                ctx.set_source_rgb(0.96, 0.78, 0.32); ctx.set_line_width(6); ctx.stroke()
        elif sid == "field_kit":
            draw_rounded_rect(ctx, -56, -42, 112, 88, 14)
            ctx.set_source_rgb(0.94, 0.90, 0.80); ctx.fill_preserve()
            ctx.set_source_rgb(0.16, 0.12, 0.08); ctx.set_line_width(5); ctx.stroke()
            # Handle
            ctx.arc(0, -42, 22, math.pi, 0); ctx.set_source_rgb(0.86, 0.66, 0.24); ctx.set_line_width(8); ctx.stroke()
            # Emerald-and-brass medic emblem cross
            ctx.set_source_rgb(0.14, 0.62, 0.34)
            draw_rounded_rect(ctx, -14, -26, 28, 56, 5); ctx.fill()
            draw_rounded_rect(ctx, -28, -12, 56, 28, 5); ctx.fill()
        elif sid == "steam_boiler":
            draw_rounded_rect(ctx, -44, -46, 88, 100, 26)
            gb = cairo.LinearGradient(-44, 0, 44, 0)
            gb.add_color_stop_rgb(0, 0.88, 0.56, 0.26); gb.add_color_stop_rgb(0.5, 0.98, 0.82, 0.46); gb.add_color_stop_rgb(1, 0.48, 0.24, 0.10)
            ctx.set_source(gb); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.08, 0.04); ctx.set_line_width(5); ctx.stroke()
            # Pressure dial gauge
            ctx.arc(0, -4, 24, 0, math.tau); ctx.set_source_rgb(0.98, 0.95, 0.86); ctx.fill_preserve()
            ctx.set_source_rgb(0.24, 0.16, 0.08); ctx.set_line_width(4); ctx.stroke()
            ctx.move_to(0, -4); ctx.line_to(14, -16); ctx.set_source_rgb(0.82, 0.18, 0.12); ctx.set_line_width(4.5); ctx.stroke()
            # Steam puffs
            for sx, sy, sr in [(-24, -64, 14), (0, -72, 18), (24, -62, 13)]:
                ctx.arc(sx, sy, sr, 0, math.tau); ctx.set_source_rgba(1, 0.98, 0.92, 0.85); ctx.fill()
        elif sid == "gear_link":
            draw_cogwheel(ctx, -26, -20, 44, 14, teeth=8, spokes=4, style="brass", angle=0.2)
            draw_cogwheel(ctx, 28, 22, 44, 14, teeth=8, spokes=4, style="copper", angle=0.6)
        elif sid == "master_cogwheel":
            draw_cogwheel(ctx, 0, 0, 74, 22, teeth=14, spokes=6, style="brass", angle=0.12)
        elif sid == "counter_parry":
            draw_shield_shape(ctx, 50, (0.36, 0.62, 0.88), (0.16, 0.28, 0.48))
            draw_sword_shape(ctx, 138, 22, angle=-0.75)
        elif sid == "grappling_hook":
            ctx.move_to(0, -64); ctx.line_to(0, 56); ctx.set_source_rgb(0.86, 0.88, 0.94); ctx.set_line_width(12); ctx.stroke()
            for side in [-1, 1]:
                ctx.move_to(0, 14); ctx.curve_to(side * 58, 12, side * 66, -34, side * 38, -52)
                ctx.set_line_width(11); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
            ctx.arc(0, 58, 16, 0, math.tau); ctx.set_line_width(8); ctx.stroke()
        elif sid == "oil_flint":
            # Brass oil flask + bright sparks (pure physical heat, zero magic)
            ctx.arc(0, 18, 42, 0, math.tau)
            ctx.set_source_rgb(0.74, 0.36, 0.12); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.08, 0.04); ctx.set_line_width(5); ctx.stroke()
            draw_rounded_rect(ctx, -16, -42, 32, 26, 6)
            ctx.set_source_rgb(0.88, 0.68, 0.26); ctx.fill_preserve(); ctx.stroke()
            # Flame spark tongue
            ctx.move_to(0, -82); ctx.curve_to(26, -54, 22, -32, 0, -28); ctx.curve_to(-22, -32, -26, -54, 0, -82)
            ctx.set_source_rgb(1.0, 0.76, 0.20); ctx.fill()
        elif sid == "caltrops_pouch":
            for ox, oy, sc in [(-32, 18, 0.85), (32, 18, 0.85), (0, -24, 1.0)]:
                ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc)
                for a in [math.pi * 1.5, math.pi * 0.18, math.pi * 0.82]:
                    ctx.move_to(0, 0); ctx.line_to(math.cos(a) * 34, math.sin(a) * 34)
                    ctx.set_source_rgb(0.86, 0.89, 0.94); ctx.set_line_width(10); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
                ctx.arc(0, 0, 9, 0, math.tau); ctx.set_source_rgb(0.32, 0.34, 0.38); ctx.fill()
                ctx.restore()
        elif sid == "banner_resolve":
            # Vertical war standard banner
            ctx.move_to(-46, -72); ctx.line_to(-46, 74); ctx.set_source_rgb(0.86, 0.68, 0.26); ctx.set_line_width(9); ctx.stroke()
            ctx.move_to(-42, -62); ctx.line_to(54, -62); ctx.line_to(38, -22); ctx.line_to(54, 18); ctx.line_to(-42, 18); ctx.close_path()
            ctx.set_source_rgb(0.92, 0.26, 0.20); ctx.fill_preserve()
            ctx.set_source_rgb(0.98, 0.84, 0.42); ctx.set_line_width(5); ctx.stroke()
            draw_cogwheel(ctx, 4, -22, 22, 6, teeth=8, spokes=0, style="brass")
        elif sid == "fortress_wall":
            ctx.set_source_rgb(0.76, 0.78, 0.82)
            draw_rounded_rect(ctx, -64, -22, 128, 86, 6); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.15, 0.18); ctx.set_line_width(5); ctx.stroke()
            # Crenellations
            for bx in [-64, -18, 28]:
                draw_rounded_rect(ctx, bx, -56, 36, 38, 4)
                ctx.set_source_rgb(0.82, 0.84, 0.88); ctx.fill_preserve(); ctx.stroke()
            # Mortar lines
            ctx.set_source_rgba(0.18, 0.20, 0.24, 0.6); ctx.set_line_width(3)
            ctx.move_to(-62, 18); ctx.line_to(62, 18); ctx.stroke()
        elif sid == "clock_pendulum":
            ctx.move_to(0, -68); ctx.line_to(26, 38)
            ctx.set_source_rgb(0.94, 0.78, 0.34); ctx.set_line_width(9); ctx.stroke()
            ctx.arc(0, -68, 12, 0, math.tau); ctx.set_source_rgb(0.96, 0.84, 0.44); ctx.fill()
            ctx.arc(28, 42, 30, 0, math.tau); ctx.set_source_rgb(0.98, 0.82, 0.34); ctx.fill_preserve()
            ctx.set_source_rgb(0.16, 0.10, 0.04); ctx.set_line_width(5); ctx.stroke()
            ctx.arc(-32, 34, 18, 0, math.tau); ctx.set_source_rgba(1, 0.9, 0.55, 0.35); ctx.fill()
        elif sid == "bellows_vent":
            ctx.move_to(-60, 0); ctx.line_to(30, -52); ctx.line_to(54, -20); ctx.line_to(54, 20); ctx.line_to(30, 52); ctx.close_path()
            ctx.set_source_rgb(0.58, 0.32, 0.16); ctx.fill_preserve()
            ctx.set_source_rgb(0.94, 0.76, 0.34); ctx.set_line_width(6); ctx.stroke()
            ctx.move_to(-72, 0); ctx.line_to(-42, 0); ctx.set_source_rgb(0.88, 0.90, 0.94); ctx.set_line_width(14); ctx.stroke()
        elif sid == "whetstone":
            ctx.rotate(-0.42)
            draw_rounded_rect(ctx, -64, -22, 128, 44, 10)
            ctx.set_source_rgb(0.68, 0.72, 0.76); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.16, 0.20); ctx.set_line_width(5); ctx.stroke()
            # Bright steel sparks
            for sx, sy in [(-24, -42), (4, -52), (32, -38), (16, -28)]:
                ctx.arc(sx, sy, 6, 0, math.tau); ctx.set_source_rgb(1.0, 0.92, 0.46); ctx.fill()
        elif sid == "riveted_plate":
            draw_rounded_rect(ctx, -56, -56, 112, 112, 14)
            gp = cairo.LinearGradient(-56, -56, 56, 56)
            gp.add_color_stop_rgb(0, 0.84, 0.88, 0.94); gp.add_color_stop_rgb(1, 0.36, 0.40, 0.48)
            ctx.set_source(gp); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.16, 0.20); ctx.set_line_width(5); ctx.stroke()
            for rx in [-38, 0, 38]:
                for ry in [-38, 38]:
                    draw_rivet(ctx, rx, ry, r=7, style="brass")
        elif sid == "blueprint":
            draw_rounded_rect(ctx, -58, -46, 116, 92, 8)
            ctx.set_source_rgb(0.14, 0.38, 0.70); ctx.fill_preserve()
            ctx.set_source_rgb(0.95, 0.92, 0.82); ctx.set_line_width(4); ctx.stroke()
            ctx.arc(0, 0, 28, 0, math.tau); ctx.set_line_width(2.5); ctx.stroke()
            ctx.move_to(-44, 0); ctx.line_to(44, 0); ctx.move_to(0, -34); ctx.line_to(0, 34); ctx.stroke()
        elif sid == "ballista_bolt":
            ctx.rotate(0.75)
            ctx.move_to(0, -78); ctx.line_to(24, -28); ctx.line_to(9, -28); ctx.line_to(9, 66); ctx.line_to(-9, 66); ctx.line_to(-9, -28); ctx.line_to(-24, -28); ctx.close_path()
            ctx.set_source_rgb(0.95, 0.82, 0.40); ctx.fill_preserve()
            ctx.set_source_rgb(0.14, 0.08, 0.04); ctx.set_line_width(5); ctx.stroke()
        elif sid == "iron_chain":
            for i, (lx, ly, rot) in enumerate([(-34, 34, 0.78), (0, 0, 0.78), (34, -34, 0.78)]):
                ctx.save(); ctx.translate(lx, ly); ctx.rotate(rot)
                draw_rounded_rect(ctx, -26, -15, 52, 30, 15)
                ctx.set_source_rgb(0.84, 0.88, 0.94); ctx.set_line_width(11); ctx.stroke()
                ctx.restore()
        elif sid == "signal_flare":
            # Sunburst mechanical signal flare (zero musical instruments!)
            for i in range(12):
                a = i * (math.tau / 12)
                r2 = 66 if i % 2 == 0 else 36
                ctx.move_to(0, 0); ctx.line_to(math.cos(a) * r2, math.sin(a) * r2)
                ctx.set_source_rgb(1.0, 0.88, 0.42); ctx.set_line_width(8); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
            ctx.arc(0, 0, 22, 0, math.tau); ctx.set_source_rgb(1.0, 0.98, 0.86); ctx.fill()
        elif sid == "masterwork_core":
            draw_cogwheel(ctx, 0, 0, 68, 28, teeth=12, spokes=4, style="brass", angle=0.25)
            # Diamond core jewel in center
            ctx.move_to(0, -34); ctx.line_to(34, 0); ctx.line_to(0, 34); ctx.line_to(-34, 0); ctx.close_path()
            ctx.set_source_rgb(1.0, 0.96, 0.72); ctx.fill_preserve()
            ctx.set_source_rgb(0.68, 0.42, 0.08); ctx.set_line_width(5); ctx.stroke()

        ctx.restore()
        img = apply_pbr_bevel(surface_to_pil(surf), bevel_radius=3.0, light_strength=0.35, shadow_strength=0.30)
        img = apply_surface_grain(img, strength=0.04, seed=hash(sid) % 1000)
        save_png(img, os.path.join(OUT_SYMS, f"{sid}.png"), resize_to=(160, 160))

if __name__ == "__main__":
    os.makedirs(OUT_BIOMES, exist_ok=True)
    os.makedirs(OUT_SYMS, exist_ok=True)
    gen_all_biomes()
    gen_all_symbols()
    print("Generated 6 Biome Battle Arenas and 28 Action Symbol Medallions!")
