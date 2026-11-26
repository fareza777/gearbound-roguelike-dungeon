"""
Generates the centerpiece 3x3 Clockwork Combat Console housing, interlocking gears,
tactile pull-lever, lock clamps, bespoke Light & Dark GUI panels/buttons/backdrops,
flagship Splash Key Art ("GEARBOUND"), and sculpted Google Play App Icon.
"""
import math
import os
import cairo
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from art_core import (
    make_surface, surface_to_pil, pil_to_surface, fbm_noise,
    apply_surface_grain, apply_pbr_bevel, draw_rounded_rect,
    draw_rivet, draw_cogwheel, draw_filigree_corner, save_png
)

OUT_UI = r"d:\Spin Adventure Neon\public\assets\ui"
FONT_DIR = r"d:\Spin Adventure Neon\public\fonts"

def find_cinzel_font(bold=True):
    # Pick downloaded Cinzel Decorative or Cinzel TTF if present, fallback to Windows serif
    candidates = []
    if os.path.isdir(FONT_DIR):
        for f in sorted(os.listdir(FONT_DIR)):
            if f.endswith(".ttf"):
                candidates.append(os.path.join(FONT_DIR, f))
    if candidates:
        return candidates[0] if not bold else candidates[-1]
    for p in [r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\timesbd.ttf"]:
        if os.path.exists(p):
            return p
    return None

def gen_gears_and_lever():
    # 1. Three interlocking high-detail gears
    for name, size, teeth, spokes, style in [
        ("gear_brass_lg.png", 256, 16, 6, "brass"),
        ("gear_iron_md.png", 200, 12, 5, "iron"),
        ("gear_copper_sm.png", 160, 10, 4, "copper"),
    ]:
        surf, ctx = make_surface(size * 2, size * 2)
        draw_cogwheel(ctx, size, size, size * 0.88, size * 0.22, teeth=teeth, spokes=spokes, style=style)
        img = surface_to_pil(surf)
        img = apply_pbr_bevel(img, bevel_radius=3.5, light_strength=0.45, shadow_strength=0.40)
        img = apply_surface_grain(img, strength=0.06, brushed_h=True, seed=teeth)
        save_png(img, os.path.join(OUT_UI, name), resize_to=(size, size))

    # 2. Brass Lock Clamp badges (open & locked)
    for locked, fname in [(False, "lock_clamp_open.png"), (True, "lock_clamp_locked.png")]:
        S = 160
        surf, ctx = make_surface(S, S)
        cx, cy = S / 2, S / 2
        # Backing plate
        draw_rounded_rect(ctx, 18, 28, S - 36, S - 46, 20)
        g = cairo.LinearGradient(0, 28, 0, S - 18)
        if locked:
            g.add_color_stop_rgb(0.0, 0.99, 0.86, 0.44)
            g.add_color_stop_rgb(0.5, 0.80, 0.56, 0.16)
            g.add_color_stop_rgb(1.0, 0.46, 0.28, 0.06)
        else:
            g.add_color_stop_rgb(0.0, 0.55, 0.53, 0.50)
            g.add_color_stop_rgb(0.5, 0.34, 0.33, 0.32)
            g.add_color_stop_rgb(1.0, 0.18, 0.17, 0.16)
        ctx.set_source(g)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.10, 0.06, 0.02, 0.92)
        ctx.set_line_width(4.5)
        ctx.stroke()

        # Shackle arch
        ctx.save()
        ctx.set_line_width(12.0)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        if locked:
            ctx.arc(cx, 66, 24, math.pi, 0)
            ctx.line_to(cx + 24, 82)
            ctx.move_to(cx - 24, 66)
            ctx.line_to(cx - 24, 82)
            ctx.set_source_rgb(0.96, 0.84, 0.46)
        else:
            ctx.arc(cx + 8, 56, 24, math.pi * 1.15, -0.15)
            ctx.set_source_rgb(0.75, 0.76, 0.78)
        ctx.stroke()
        ctx.restore()

        # Lock body
        draw_rounded_rect(ctx, cx - 30, 74, 60, 48, 10)
        gb = cairo.LinearGradient(cx - 30, 74, cx + 30, 122)
        if locked:
            gb.add_color_stop_rgb(0.0, 0.75, 0.22, 0.14)
            gb.add_color_stop_rgb(1.0, 0.38, 0.08, 0.05)
        else:
            gb.add_color_stop_rgb(0.0, 0.38, 0.36, 0.34)
            gb.add_color_stop_rgb(1.0, 0.18, 0.16, 0.15)
        ctx.set_source(gb)
        ctx.fill_preserve()
        ctx.set_source_rgb(0.95, 0.80, 0.42)
        ctx.set_line_width(3.2)
        ctx.stroke()
        # Keyhole
        ctx.arc(cx, 93, 7, 0, math.tau)
        ctx.set_source_rgb(0.12, 0.08, 0.04)
        ctx.fill()
        ctx.move_to(cx - 4, 96); ctx.line_to(cx + 4, 96); ctx.line_to(cx + 6, 112); ctx.line_to(cx - 6, 112)
        ctx.close_path(); ctx.fill()

        img = apply_pbr_bevel(surface_to_pil(surf), bevel_radius=2.5)
        save_png(img, os.path.join(OUT_UI, fname), resize_to=(96, 96))

def gen_console_housing():
    """
    Ultra-detailed museum-grade 3x3 Clockwork Combat Console chassis overlay.
    Canvas will render live rotating cylindrical drums behind the crisp transparent
    3-channel viewport window cutouts so every brass bevel, corner rivet, walnut inlay,
    crown arch, and steam vent sits cleanly in front with real depth!
    """
    W, H = 1200, 920
    surf, ctx = make_surface(W, H)

    # Outer wrought-iron drop rim
    draw_rounded_rect(ctx, 28, 56, W - 56, H - 84, 48)
    g_outer = cairo.LinearGradient(0, 56, W, H - 28)
    g_outer.add_color_stop_rgb(0.0, 0.32, 0.23, 0.14)
    g_outer.add_color_stop_rgb(0.22, 0.62, 0.45, 0.18)
    g_outer.add_color_stop_rgb(0.50, 0.88, 0.70, 0.30)
    g_outer.add_color_stop_rgb(0.78, 0.56, 0.39, 0.15)
    g_outer.add_color_stop_rgb(1.0, 0.24, 0.16, 0.08)
    ctx.set_source(g_outer)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.09, 0.06, 0.03)
    ctx.set_line_width(8)
    ctx.stroke()

    # Oiled walnut wood recessed chassis body
    draw_rounded_rect(ctx, 50, 78, W - 100, H - 128, 36)
    g_wood = cairo.LinearGradient(50, 78, 50, H - 50)
    g_wood.add_color_stop_rgb(0.0, 0.36, 0.22, 0.12)
    g_wood.add_color_stop_rgb(0.35, 0.25, 0.14, 0.08)
    g_wood.add_color_stop_rgb(0.75, 0.18, 0.10, 0.06)
    g_wood.add_color_stop_rgb(1.0, 0.12, 0.07, 0.04)
    ctx.set_source(g_wood)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.95, 0.80, 0.44, 0.65)
    ctx.set_line_width(3.5)
    ctx.stroke()

    # Ornate arched brass crown crest at top center
    ctx.save()
    ctx.move_to(W * 0.24, 82)
    ctx.curve_to(W * 0.32, 12, W * 0.68, 12, W * 0.76, 82)
    ctx.close_path()
    g_crown = cairo.LinearGradient(W * 0.24, 14, W * 0.76, 84)
    g_crown.add_color_stop_rgb(0.0, 0.54, 0.38, 0.14)
    g_crown.add_color_stop_rgb(0.35, 0.96, 0.82, 0.42)
    g_crown.add_color_stop_rgb(0.55, 0.99, 0.90, 0.58)
    g_crown.add_color_stop_rgb(1.0, 0.48, 0.32, 0.11)
    ctx.set_source(g_crown)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.11, 0.07, 0.03)
    ctx.set_line_width(5)
    ctx.stroke()
    # Center medallion crest
    ctx.arc(W * 0.5, 58, 28, 0, math.tau)
    g_med = cairo.RadialGradient(W * 0.5 - 8, 50, 4, W * 0.5, 58, 28)
    g_med.add_color_stop_rgb(0.0, 0.98, 0.88, 0.56)
    g_med.add_color_stop_rgb(0.6, 0.68, 0.44, 0.14)
    g_med.add_color_stop_rgb(1.0, 0.24, 0.14, 0.04)
    ctx.set_source(g_med)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.12, 0.07, 0.03)
    ctx.set_line_width(3)
    ctx.stroke()
    draw_cogwheel(ctx, W * 0.5, 58, 19, 6, teeth=8, spokes=0, style="iron")
    ctx.restore()

    # Forged dark-iron inner bezel framing the 3x3 viewport
    vx, vy, vw, vh = 88, 118, W - 176, H - 208
    draw_rounded_rect(ctx, vx - 18, vy - 18, vw + 36, vh + 36, 26)
    g_iron = cairo.LinearGradient(vx, vy - 18, vx, vy + vh + 18)
    g_iron.add_color_stop_rgb(0.0, 0.34, 0.35, 0.38)
    g_iron.add_color_stop_rgb(0.5, 0.18, 0.19, 0.22)
    g_iron.add_color_stop_rgb(1.0, 0.10, 0.10, 0.12)
    ctx.set_source(g_iron)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.88, 0.70, 0.32)
    ctx.set_line_width(5)
    ctx.stroke()

    # Punch out 3 crisp transparent drum channel windows!
    col_gap = 18
    col_w = (vw - col_gap * 2) / 3.0
    for c in range(3):
        cx0 = vx + c * (col_w + col_gap)
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_CLEAR)
        draw_rounded_rect(ctx, cx0, vy, col_w, vh, 14)
        ctx.fill()
        ctx.restore()

        # Inner gilded chamfer rim around each drum window
        draw_rounded_rect(ctx, cx0 - 2, vy - 2, col_w + 4, vh + 4, 15)
        g_rim = cairo.LinearGradient(cx0, vy, cx0, vy + vh)
        g_rim.add_color_stop_rgb(0.0, 0.98, 0.86, 0.48)
        g_rim.add_color_stop_rgb(0.5, 0.65, 0.46, 0.16)
        g_rim.add_color_stop_rgb(1.0, 0.94, 0.76, 0.38)
        ctx.set_source(g_rim)
        ctx.set_line_width(4.5)
        ctx.stroke()

        # Brass row tick pointers on left/right of channel
        for r in range(3):
            ry = vy + vh * (r + 0.5) / 3.0
            ctx.move_to(cx0 - 8, ry)
            ctx.line_to(cx0 + 4, ry - 5)
            ctx.line_to(cx0 + 4, ry + 5)
            ctx.close_path()
            ctx.set_source_rgb(0.95, 0.78, 0.36)
            ctx.fill()

    # Corner ornate filigree brackets & rivets
    draw_filigree_corner(ctx, 56, 84, 58, 1, 1)
    draw_filigree_corner(ctx, W - 56, 84, 58, -1, 1)
    draw_filigree_corner(ctx, 56, H - 56, 58, 1, -1)
    draw_filigree_corner(ctx, W - 56, H - 56, 58, -1, -1)

    rivet_pts = [
        (46, 118), (46, H * 0.5), (46, H - 102),
        (W - 46, 118), (W - 46, H * 0.5), (W - 46, H - 102),
        (160, H - 44), (W * 0.5, H - 44), (W - 160, H - 44),
        (160, 74), (W - 160, 74),
    ]
    for rx, ry in rivet_pts:
        draw_rivet(ctx, rx, ry, r=9.5, style="brass")

    # Decorative brass divider rivets between drum channels
    for c in range(2):
        dx = vx + (c + 1) * col_w + c * col_gap + col_gap * 0.5
        for frac in [0.16, 0.5, 0.84]:
            draw_rivet(ctx, dx, vy + vh * frac, r=6.5, style="brass")

    # Brass bottom plaque accents (vent slats)
    for sx in [W * 0.28, W * 0.72]:
        for k in range(-2, 3):
            draw_rounded_rect(ctx, sx + k * 16 - 4, H - 62, 8, 22, 3)
            ctx.set_source_rgba(0.07, 0.05, 0.03, 0.85)
            ctx.fill()

    img = surface_to_pil(surf)
    img = apply_pbr_bevel(img, bevel_radius=4.0, light_strength=0.40, shadow_strength=0.38)
    img = apply_surface_grain(img, strength=0.055, brushed_h=True, seed=77)
    save_png(img, os.path.join(OUT_UI, "console_housing.png"), resize_to=(900, 690))

def gen_gui_panels_and_buttons():
    # 1. Bespoke Light Mode (Sunlit Parchment + Brass Filigree) & Dark Mode (Obsidian Slate + Bronze Filigree) Panels
    for mode, fname in [("light", "panel_light.png"), ("dark", "panel_dark.png")]:
        W, H = 760, 520
        surf, ctx = make_surface(W, H)
        draw_rounded_rect(ctx, 10, 10, W - 20, H - 20, 26)
        g = cairo.LinearGradient(0, 10, 0, H - 10)
        if mode == "light":
            g.add_color_stop_rgb(0.0, 0.97, 0.94, 0.85)
            g.add_color_stop_rgb(0.5, 0.94, 0.89, 0.77)
            g.add_color_stop_rgb(1.0, 0.89, 0.82, 0.67)
        else:
            g.add_color_stop_rgb(0.0, 0.16, 0.15, 0.18)
            g.add_color_stop_rgb(0.5, 0.12, 0.11, 0.14)
            g.add_color_stop_rgb(1.0, 0.08, 0.07, 0.10)
        ctx.set_source(g)
        ctx.fill()

        # Subtle aged vignette
        vg = cairo.RadialGradient(W / 2, H / 2, min(W, H) * 0.25, W / 2, H / 2, max(W, H) * 0.65)
        if mode == "light":
            vg.add_color_stop_rgba(0, 1, 1, 1, 0.0)
            vg.add_color_stop_rgba(1, 0.56, 0.42, 0.20, 0.26)
        else:
            vg.add_color_stop_rgba(0, 0.92, 0.68, 0.28, 0.05)
            vg.add_color_stop_rgba(1, 0.02, 0.02, 0.03, 0.45)
        draw_rounded_rect(ctx, 10, 10, W - 20, H - 20, 26)
        ctx.set_source(vg)
        ctx.fill()

        # Double ornate brass border
        draw_rounded_rect(ctx, 12, 12, W - 24, H - 24, 24)
        gb = cairo.LinearGradient(0, 0, W, H)
        gb.add_color_stop_rgb(0.0, 0.86, 0.68, 0.30)
        gb.add_color_stop_rgb(0.5, 0.54, 0.37, 0.13)
        gb.add_color_stop_rgb(1.0, 0.90, 0.72, 0.34)
        ctx.set_source(gb)
        ctx.set_line_width(7)
        ctx.stroke()

        draw_rounded_rect(ctx, 23, 23, W - 46, H - 46, 17)
        ctx.set_source_rgba(0.76, 0.58, 0.24, 0.65 if mode == "light" else 0.55)
        ctx.set_line_width(2.2)
        ctx.stroke()

        # Corner filigree & rivets
        fc = (0.64, 0.45, 0.16, 0.92) if mode == "light" else (0.90, 0.72, 0.34, 0.88)
        draw_filigree_corner(ctx, 28, 28, 52, 1, 1, fc)
        draw_filigree_corner(ctx, W - 28, 28, 52, -1, 1, fc)
        draw_filigree_corner(ctx, 28, H - 28, 52, 1, -1, fc)
        draw_filigree_corner(ctx, W - 28, H - 28, 52, -1, -1, fc)
        for rx, ry in [(22, 22), (W - 22, 22), (22, H - 22), (W - 22, H - 22)]:
            draw_rivet(ctx, rx, ry, r=6.5, style="brass")

        img = apply_surface_grain(surface_to_pil(surf), strength=0.055 if mode == "light" else 0.045, seed=21 if mode == "light" else 29)
        save_png(img, os.path.join(OUT_UI, fname))

    # 2. Custom Bespoke Metallic/Enamel Game Buttons
    btn_specs = [
        ("btn_brass.png", (0.96, 0.82, 0.40), (0.76, 0.54, 0.16), (0.48, 0.31, 0.08)),
        ("btn_crimson.png", (0.86, 0.28, 0.22), (0.64, 0.15, 0.13), (0.36, 0.07, 0.07)),
        ("btn_iron.png", (0.44, 0.46, 0.50), (0.28, 0.30, 0.34), (0.16, 0.17, 0.20)),
        ("btn_emerald.png", (0.24, 0.68, 0.48), (0.14, 0.46, 0.32), (0.07, 0.26, 0.18)),
    ]
    for fname, c0, c1, c2 in btn_specs:
        W, H = 520, 128
        surf, ctx = make_surface(W, H)
        draw_rounded_rect(ctx, 8, 8, W - 16, H - 16, 22)
        g = cairo.LinearGradient(0, 8, 0, H - 8)
        g.add_color_stop_rgb(0.0, *c0)
        g.add_color_stop_rgb(0.48, *c1)
        g.add_color_stop_rgb(1.0, *c2)
        ctx.set_source(g)
        ctx.fill()

        # Gloss specular bar along top
        draw_rounded_rect(ctx, 18, 16, W - 36, H * 0.34, 14)
        gs = cairo.LinearGradient(0, 16, 0, 16 + H * 0.34)
        gs.add_color_stop_rgba(0, 1, 0.98, 0.88, 0.34)
        gs.add_color_stop_rgba(1, 1, 0.98, 0.88, 0.0)
        ctx.set_source(gs)
        ctx.fill()

        # Double beveled brass frame
        draw_rounded_rect(ctx, 8, 8, W - 16, H - 16, 22)
        ctx.set_source_rgb(0.14, 0.09, 0.04)
        ctx.set_line_width(6)
        ctx.stroke()

        draw_rounded_rect(ctx, 14, 14, W - 28, H - 28, 17)
        ctx.set_source_rgba(0.98, 0.86, 0.50, 0.85)
        ctx.set_line_width(3)
        ctx.stroke()

        # Side rivets
        for rx, ry in [(30, 30), (30, H - 30), (W - 30, 30), (W - 30, H - 30)]:
            draw_rivet(ctx, rx, ry, r=6.5, style="brass")

        img = apply_pbr_bevel(surface_to_pil(surf), bevel_radius=3.0, light_strength=0.35, shadow_strength=0.30)
        img = apply_surface_grain(img, strength=0.045, brushed_h=True, seed=hash(fname) % 999)
        save_png(img, os.path.join(OUT_UI, fname))

    # 3. Full Portrait Hub Backdrops (Light Sunlit Workshop Archive + Dark Obsidian Foundry Vault)
    for mode, fname in [("light", "bg_light_hub.png"), ("dark", "bg_dark_hub.png")]:
        W, H = 720, 1280
        surf, ctx = make_surface(W, H)
        g = cairo.LinearGradient(0, 0, W * 0.3, H)
        if mode == "light":
            g.add_color_stop_rgb(0.0, 0.97, 0.93, 0.82)
            g.add_color_stop_rgb(0.45, 0.92, 0.85, 0.70)
            g.add_color_stop_rgb(1.0, 0.82, 0.72, 0.54)
        else:
            g.add_color_stop_rgb(0.0, 0.14, 0.11, 0.09)
            g.add_color_stop_rgb(0.45, 0.09, 0.08, 0.09)
            g.add_color_stop_rgb(1.0, 0.05, 0.04, 0.06)
        ctx.set_source(g)
        ctx.rectangle(0, 0, W, H)
        ctx.fill()

        # Architectural sunlit arches & clockwork drafting rings watermark
        ctx.save()
        alpha_g = 0.12 if mode == "light" else 0.10
        for gx, gy, gr, teeth in [(W * 0.12, H * 0.18, 190, 18), (W * 0.88, H * 0.26, 150, 14), (W * 0.82, H * 0.84, 220, 20), (W * 0.15, H * 0.78, 130, 12)]:
            ctx.save()
            ctx.push_group()
            draw_cogwheel(ctx, gx, gy, gr, gr * 0.25, teeth=teeth, spokes=6, style="brass" if mode == "dark" else "copper", angle=0.3)
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(alpha_g)
            ctx.restore()

        # Delicate brass compass/astrolabe blueprint circles
        ctx.set_source_rgba(0.68, 0.50, 0.20, 0.22 if mode == "light" else 0.16)
        ctx.set_line_width(2.0)
        for rr in [160, 240, 320]:
            ctx.arc(W * 0.5, H * 0.34, rr, 0, math.tau)
            ctx.stroke()

        # Warm volumetric sunlight glow from top center
        rg = cairo.RadialGradient(W * 0.5, H * 0.15, 20, W * 0.5, H * 0.22, W * 0.85)
        if mode == "light":
            rg.add_color_stop_rgba(0, 1.0, 0.96, 0.82, 0.55)
            rg.add_color_stop_rgba(1, 0.85, 0.72, 0.45, 0.0)
        else:
            rg.add_color_stop_rgba(0, 0.95, 0.62, 0.22, 0.22)
            rg.add_color_stop_rgba(1, 0.10, 0.06, 0.02, 0.0)
        ctx.set_source(rg)
        ctx.rectangle(0, 0, W, H)
        ctx.fill()
        ctx.restore()

        img = apply_surface_grain(surface_to_pil(surf), strength=0.055, seed=303 if mode == "light" else 404)
        save_png(img, os.path.join(OUT_UI, fname))

def draw_heroic_greathelm(ctx, cx, cy, scale=1.0):
    """
    Draws an ultra-detailed, iconic, 100% ENCLOSED medieval steel & burnished-brass
    Vanguard Greathelm with a narrow dark solid visor slit (STRICT ZERO TASWIR — ZERO eyes/face).
    """
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)

    # Plume / Brass Crest Fin
    ctx.move_to(0, -142)
    ctx.curve_to(48, -148, 72, -108, 62, -62)
    ctx.curve_to(26, -78, -26, -78, -62, -62)
    ctx.curve_to(-72, -108, -48, -148, 0, -142)
    ctx.close_path()
    gc = cairo.LinearGradient(-50, -145, 50, -65)
    gc.add_color_stop_rgb(0.0, 0.78, 0.16, 0.14)
    gc.add_color_stop_rgb(0.5, 0.94, 0.30, 0.20)
    gc.add_color_stop_rgb(1.0, 0.44, 0.08, 0.07)
    ctx.set_source(gc)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.06, 0.04)
    ctx.set_line_width(4.5)
    ctx.stroke()

    # Main Enclosed Steel Dome & Cheekplates
    ctx.move_to(0, -104)
    ctx.curve_to(74, -102, 92, -46, 86, 36)
    ctx.curve_to(82, 82, 46, 114, 0, 128)
    ctx.curve_to(-46, 114, -82, 82, -86, 36)
    ctx.curve_to(-92, -46, -74, -102, 0, -104)
    ctx.close_path()
    gs = cairo.LinearGradient(-90, -90, 90, 95)
    gs.add_color_stop_rgb(0.0, 0.88, 0.91, 0.96)
    gs.add_color_stop_rgb(0.32, 0.56, 0.60, 0.68)
    gs.add_color_stop_rgb(0.52, 0.94, 0.96, 0.99)
    gs.add_color_stop_rgb(0.75, 0.34, 0.38, 0.45)
    gs.add_color_stop_rgb(1.0, 0.16, 0.18, 0.24)
    ctx.set_source(gs)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.09, 0.09, 0.12)
    ctx.set_line_width(6.5)
    ctx.stroke()

    # Brass Cross-Reinforcement Band (Vertical & Brow)
    gb = cairo.LinearGradient(-70, -100, 70, 110)
    gb.add_color_stop_rgb(0.0, 0.99, 0.90, 0.54)
    gb.add_color_stop_rgb(0.45, 0.80, 0.58, 0.18)
    gb.add_color_stop_rgb(1.0, 0.44, 0.28, 0.07)
    # Brow arch band
    ctx.move_to(-85, -18)
    ctx.curve_to(-35, -34, 35, -34, 85, -18)
    ctx.line_to(84, -2)
    ctx.curve_to(35, -18, -35, -18, -84, -2)
    ctx.close_path()
    ctx.set_source(gb)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.09, 0.03)
    ctx.set_line_width(3.2)
    ctx.stroke()

    # Center nasal ridge
    ctx.move_to(-12, -102); ctx.line_to(12, -102); ctx.line_to(10, 122); ctx.line_to(-10, 122); ctx.close_path()
    ctx.set_source(gb)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.09, 0.03)
    ctx.set_line_width(3.2)
    ctx.stroke()

    # SOLID DARK VISOR SLIT ONLY (NO EYES, NO GLOW, PURE SHADOW METAL SLIT)
    for side in [-1, 1]:
        ctx.move_to(side * 14, -4)
        ctx.line_to(side * 72, -10)
        ctx.line_to(side * 68, 5)
        ctx.line_to(side * 14, 8)
        ctx.close_path()
        ctx.set_source_rgb(0.05, 0.05, 0.06)
        ctx.fill()

    # Vertical breathing vents along lower steel cheekplates
    for side in [-1, 1]:
        for k in range(3):
            vx = side * (28 + k * 15)
            vy = 34 + k * 4
            draw_rounded_rect(ctx, vx - 3.5, vy, 7, 36 - k * 4, 3.5)
            ctx.set_source_rgb(0.08, 0.08, 0.10)
            ctx.fill()

    # Rivets along brow & crown
    for rx, ry in [(-66, -12), (-36, -20), (0, -24), (36, -20), (66, -12), (0, -68), (0, 68)]:
        draw_rivet(ctx, rx, ry, r=5.2, style="brass")

    ctx.restore()

def gen_app_icon_and_splash():
    # 1. Sculpted Premium App Icon (1024x1024)
    S = 1024
    surf, ctx = make_surface(S, S)
    cx, cy = S / 2, S / 2

    # Radiant deep royal-iron & sunlit-amber backdrop
    rg = cairo.RadialGradient(cx, cy * 0.85, 60, cx, cy, S * 0.72)
    rg.add_color_stop_rgb(0.0, 0.96, 0.76, 0.34)
    rg.add_color_stop_rgb(0.42, 0.56, 0.34, 0.14)
    rg.add_color_stop_rgb(0.75, 0.18, 0.16, 0.22)
    rg.add_color_stop_rgb(1.0, 0.08, 0.07, 0.11)
    ctx.set_source(rg)
    ctx.rectangle(0, 0, S, S)
    ctx.fill()

    # Radiant sunbeam rays behind emblem
    ctx.save()
    ctx.translate(cx, cy)
    for i in range(16):
        a0 = i * (math.tau / 16)
        a1 = a0 + 0.16
        ctx.move_to(0, 0)
        ctx.line_to(math.cos(a0) * S, math.sin(a0) * S)
        ctx.line_to(math.cos(a1) * S, math.sin(a1) * S)
        ctx.close_path()
        ctx.set_source_rgba(1.0, 0.88, 0.54, 0.12)
        ctx.fill()
    ctx.restore()

    # Giant Masterwork Golden Clockwork Gear Ring
    draw_cogwheel(ctx, cx, cy, 428, 250, teeth=18, spokes=6, style="brass", angle=0.17)

    # Crossed Forged Broadswords behind Greathelm
    for side in [-1, 1]:
        ctx.save()
        ctx.translate(cx, cy + 20)
        ctx.rotate(side * 0.62)
        # Blade
        ctx.move_to(0, -370); ctx.line_to(26, -290); ctx.line_to(22, 160); ctx.line_to(-22, 160); ctx.line_to(-26, -290); ctx.close_path()
        gs = cairo.LinearGradient(-26, 0, 26, 0)
        gs.add_color_stop_rgb(0, 0.52, 0.56, 0.64)
        gs.add_color_stop_rgb(0.5, 0.96, 0.98, 1.0)
        gs.add_color_stop_rgb(1, 0.36, 0.40, 0.48)
        ctx.set_source(gs)
        ctx.fill_preserve()
        ctx.set_source_rgb(0.08, 0.08, 0.11)
        ctx.set_line_width(7)
        ctx.stroke()
        # Crossguard
        draw_rounded_rect(ctx, -68, 152, 136, 28, 10)
        ctx.set_source_rgb(0.86, 0.66, 0.24)
        ctx.fill_preserve()
        ctx.set_source_rgb(0.12, 0.08, 0.03)
        ctx.set_line_width(6)
        ctx.stroke()
        ctx.restore()

    # Central Dark Shield Crest Backing
    ctx.move_to(cx, cy - 240)
    ctx.curve_to(cx + 220, cy - 235, cx + 230, cy - 40, cx + 190, cy + 120)
    ctx.curve_to(cx + 140, cy + 230, cx + 45, cy + 290, cx, cy + 320)
    ctx.curve_to(cx - 45, cy + 290, cx - 140, cy + 230, cx - 190, cy + 120)
    ctx.curve_to(cx - 230, cy - 40, cx - 220, cy - 235, cx, cy - 240)
    ctx.close_path()
    gsh = cairo.LinearGradient(cx - 200, cy - 240, cx + 200, cy + 320)
    gsh.add_color_stop_rgb(0.0, 0.26, 0.24, 0.30)
    gsh.add_color_stop_rgb(0.5, 0.16, 0.15, 0.20)
    gsh.add_color_stop_rgb(1.0, 0.08, 0.08, 0.12)
    ctx.set_source(gsh)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.95, 0.78, 0.36)
    ctx.set_line_width(18)
    ctx.stroke()

    # Heroic Enclosed Steel Greathelm (ZERO EYES/FACE!)
    draw_heroic_greathelm(ctx, cx, cy + 14, scale=2.15)

    img = apply_pbr_bevel(surface_to_pil(surf), bevel_radius=5.0, light_strength=0.38, shadow_strength=0.35)
    img = apply_surface_grain(img, strength=0.04, seed=91)
    save_png(img, os.path.join(OUT_UI, "app_icon_master.png"))

    # 2. Monumental Portrait Splash Key Art (1080x1920)
    W, H = 1080, 1920
    surf, ctx = make_surface(W, H)
    # Sunlit ancient sandstone & warm brass sky gradient
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0.0, 0.18, 0.13, 0.09)
    g.add_color_stop_rgb(0.28, 0.44, 0.30, 0.16)
    g.add_color_stop_rgb(0.56, 0.86, 0.67, 0.36)
    g.add_color_stop_rgb(0.80, 0.50, 0.34, 0.18)
    g.add_color_stop_rgb(1.0, 0.14, 0.10, 0.07)
    ctx.set_source(g)
    ctx.rectangle(0, 0, W, H)
    ctx.fill()

    # Volumetric golden sunbeams pouring from behind the great clockwork gate
    ctx.save()
    ctx.translate(W * 0.5, H * 0.48)
    for i in range(20):
        a = i * (math.tau / 20)
        ctx.move_to(0, 0)
        ctx.line_to(math.cos(a) * 1400, math.sin(a) * 1400)
        ctx.line_to(math.cos(a + 0.12) * 1400, math.sin(a + 0.12) * 1400)
        ctx.close_path()
        ctx.set_source_rgba(1.0, 0.92, 0.62, 0.11)
        ctx.fill()
    ctx.restore()

    # Monumental interlocking background gears framing the dungeon arch
    draw_cogwheel(ctx, W * 0.5, H * 0.52, 430, 290, teeth=22, spokes=8, style="brass", angle=0.14)
    draw_cogwheel(ctx, W * 0.14, H * 0.40, 220, 90, teeth=14, spokes=5, style="iron", angle=0.5)
    draw_cogwheel(ctx, W * 0.86, H * 0.64, 240, 100, teeth=16, spokes=6, style="copper", angle=0.2)

    # Vaulted Stone Archway Silhouette framing sides
    ctx.save()
    ctx.move_to(0, 0); ctx.line_to(W, 0); ctx.line_to(W, H); ctx.line_to(W - 95, H)
    ctx.line_to(W - 95, H * 0.44)
    ctx.arc_negative(W * 0.5, H * 0.44, W * 0.5 - 95, 0, math.pi)
    ctx.line_to(95, H); ctx.line_to(0, H); ctx.close_path()
    ga = cairo.LinearGradient(0, 0, W, 0)
    ga.add_color_stop_rgb(0.0, 0.18, 0.13, 0.09)
    ga.add_color_stop_rgb(0.5, 0.28, 0.21, 0.14)
    ga.add_color_stop_rgb(1.0, 0.15, 0.11, 0.08)
    ctx.set_source(ga)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.84, 0.66, 0.30)
    ctx.set_line_width(7)
    ctx.stroke()
    ctx.restore()

    # Radiant halo behind centerpiece Vanguard Crest
    rh = cairo.RadialGradient(W * 0.5, H * 0.54, 40, W * 0.5, H * 0.54, 380)
    rh.add_color_stop_rgba(0, 1.0, 0.95, 0.75, 0.72)
    rh.add_color_stop_rgba(0.6, 0.92, 0.68, 0.28, 0.28)
    rh.add_color_stop_rgba(1, 0.5, 0.3, 0.1, 0.0)
    ctx.set_source(rh)
    ctx.arc(W * 0.5, H * 0.54, 380, 0, math.tau)
    ctx.fill()

    # Heroic armored shoulders & cloak silhouette beneath iconic Greathelm (ZERO EYES/FACE!)
    ctx.save()
    ctx.translate(W * 0.5, H * 0.66)
    # Flowing crimson cloak
    ctx.move_to(-180, -40); ctx.curve_to(-260, 140, -290, 320, -240, 480)
    ctx.line_to(240, 480); ctx.curve_to(290, 320, 260, 140, 180, -40); ctx.close_path()
    gcl = cairo.LinearGradient(-220, 0, 220, 420)
    gcl.add_color_stop_rgb(0.0, 0.62, 0.14, 0.12)
    gcl.add_color_stop_rgb(0.5, 0.44, 0.09, 0.09)
    gcl.add_color_stop_rgb(1.0, 0.18, 0.04, 0.04)
    ctx.set_source(gcl)
    ctx.fill()
    # Heavy Armored Pauldrons & Cuirass
    ctx.move_to(-230, 15); ctx.curve_to(-185, -75, -80, -90, 0, -82)
    ctx.curve_to(80, -90, 185, -75, 230, 15)
    ctx.line_to(175, 290); ctx.line_to(0, 340); ctx.line_to(-175, 290); ctx.close_path()
    gcu = cairo.LinearGradient(-210, -80, 210, 300)
    gcu.add_color_stop_rgb(0.0, 0.78, 0.81, 0.86)
    gcu.add_color_stop_rgb(0.35, 0.44, 0.47, 0.54)
    gcu.add_color_stop_rgb(0.55, 0.84, 0.87, 0.92)
    gcu.add_color_stop_rgb(1.0, 0.18, 0.20, 0.25)
    ctx.set_source(gcu)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.90, 0.72, 0.34)
    ctx.set_line_width(8)
    ctx.stroke()
    # Brass chest gear emblem
    draw_cogwheel(ctx, 0, 75, 76, 22, teeth=10, spokes=5, style="brass", angle=0.2)
    ctx.restore()

    # Heroic Enclosed Greathelm
    draw_heroic_greathelm(ctx, W * 0.5, H * 0.51, scale=1.55)

    # Ornate Title Banner Plate at Upper Third
    bx, by, bw, bh = 86, 220, W - 172, 235
    draw_rounded_rect(ctx, bx, by, bw, bh, 28)
    gpl = cairo.LinearGradient(bx, by, bx, by + bh)
    gpl.add_color_stop_rgba(0.0, 0.14, 0.10, 0.06, 0.92)
    gpl.add_color_stop_rgba(0.5, 0.20, 0.14, 0.08, 0.94)
    gpl.add_color_stop_rgba(1.0, 0.10, 0.07, 0.04, 0.94)
    ctx.set_source(gpl)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.92, 0.74, 0.34)
    ctx.set_line_width(8)
    ctx.stroke()
    draw_rounded_rect(ctx, bx + 14, by + 14, bw - 28, bh - 28, 18)
    ctx.set_source_rgba(0.96, 0.84, 0.48, 0.55)
    ctx.set_line_width(2.5)
    ctx.stroke()
    for rx, ry in [(bx + 26, by + 26), (bx + bw - 26, by + 26), (bx + 26, by + bh - 26), (bx + bw - 26, by + bh - 26)]:
        draw_rivet(ctx, rx, ry, r=9, style="brass")

    img = surface_to_pil(surf)
    img = apply_surface_grain(img, strength=0.045, seed=555)

    # Hand-crafted 3D Embossed Metallic Gold "GEARBOUND" Title & Subtitle
    font_path = find_cinzel_font(bold=True)
    title_font = ImageFont.truetype(font_path, 118) if font_path else ImageFont.load_default()
    sub_font = ImageFont.truetype(font_path, 34) if font_path else ImageFont.load_default()

    # Render embossed metallic gold title via mask + metallic gradient
    txt_mask = Image.new("L", (W, H), 0)
    mdraw = ImageDraw.Draw(txt_mask)
    title = "GEARBOUND"
    bbox = mdraw.textbbox((0, 0), title, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx, ty = (W - tw) // 2 - bbox[0], by + 34 - bbox[1]
    mdraw.text((tx, ty), title, fill=255, font=title_font)

    # Deep forged drop shadow
    shadow = txt_mask.filter(ImageFilter.GaussianBlur(7))
    sh_layer = Image.new("RGBA", (W, H), (14, 8, 4, 230))
    img.paste(sh_layer, (0, 8), shadow)

    # Rich burnished-gold linear gradient fill for letters
    grad_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    garr = np.zeros((H, W, 4), dtype=np.uint8)
    ys = np.linspace(0, 1, H)[:, None]
    local_t = np.clip((np.arange(H)[:, None] - (by + 25)) / 130.0, 0, 1)
    r = np.where(local_t < 0.45, 255 - local_t * 30, 210 + (local_t - 0.45) * 70)
    g_c = np.where(local_t < 0.45, 236 - local_t * 90, 152 + (local_t - 0.45) * 95)
    b = np.where(local_t < 0.45, 148 - local_t * 170, 44 + (local_t - 0.45) * 75)
    garr[:, :, 0] = np.clip(r, 0, 255).astype(np.uint8)
    garr[:, :, 1] = np.clip(g_c, 0, 255).astype(np.uint8)
    garr[:, :, 2] = np.clip(b, 0, 255).astype(np.uint8)
    garr[:, :, 3] = 255
    grad_img = Image.fromarray(garr, mode="RGBA")
    img.paste(grad_img, (0, 0), txt_mask)

    # Crisp outline + subtitle
    draw = ImageDraw.Draw(img)
    sub = "CLOCKWORK EXPEDITION DUEL"
    sb = draw.textbbox((0, 0), sub, font=sub_font)
    sw = sb[2] - sb[0]
    draw.text(((W - sw) // 2, by + 168), sub, fill=(242, 216, 154, 240), font=sub_font)

    save_png(img, os.path.join(OUT_UI, "splash_game_portrait.png"), resize_to=(720, 1280))

if __name__ == "__main__":
    os.makedirs(OUT_UI, exist_ok=True)
    gen_gears_and_lever()
    gen_console_housing()
    gen_gui_panels_and_buttons()
    gen_app_icon_and_splash()
    print("Generated console, gears, GUI panels/buttons, app icon, and splash key art!")
