"""
Next-Gen Multi-Archetype Painterly Frame-by-Frame Sprite Atlas Generator for Gearbound.
- 16 RADICALLY VARIED silhouettes (ZERO clones/twins!):
  * 3 Distinct Heroes: Sculpted Royal Knight, Hooded Siege Arbalest, Brass Steam-Exo Artificer
  * 7 Distinct Enemies: Tall Conical Ruin Halberdier, 3-Legged Mechanical Tripod Crossbow,
    Rolling Gyro-Monowheel Saw-Automaton, Hulking Iron Pavise Fortress, Barrel-Chested Furnace Golem,
    Wheeled Siege Ballista Wagon, Quad-Legged Mechanical Strider Lancer
  * 6 Monumental Unique Act Bosses: Floating Sandstone-Ring Monolith, 6-Legged Bronze Siege Crawler,
    Walking Smelter Tower, Frost-Iron Citadel Mech, Grand Clock-Halo Astrolabe Arbiter,
    Gilded Winged-Gear Sovereign Titan
- Packs frames into compact GPU-friendly 4x3 texture atlases (fast Adreno/Mali sampling, 60 FPS!).
- STRICT ZERO TASWIR: ZERO eyes, ZERO glowing eyes, ZERO faces anywhere!
"""
import json
import math
import os
import cairo
from PIL import Image
from art_core import (
    make_surface, surface_to_pil, draw_rounded_rect, draw_rivet, draw_cogwheel, save_png
)

OUT_SPRITES = r"d:\Spin Adventure Neon\public\assets\sprites"

def ease_out_back(t):
    c1 = 1.70158
    c3 = c1 + 1.0
    return 1.0 + c3 * ((t - 1.0) ** 3) + c1 * ((t - 1.0) ** 2)

def ease_in_out(t):
    return t * t * (3.0 - 2.0 * t)

def metal_grad(x1, y1, x2, y2, hi, lo):
    g = cairo.LinearGradient(x1, y1, x2, y2)
    mid = ((hi[0] + lo[0]) * 0.52, (hi[1] + lo[1]) * 0.52, (hi[2] + lo[2]) * 0.52)
    spec = (min(1, hi[0] * 1.15), min(1, hi[1] * 1.15), min(1, hi[2] * 1.15))
    g.add_color_stop_rgb(0.0, *hi)
    g.add_color_stop_rgb(0.28, *spec)
    g.add_color_stop_rgb(0.62, *mid)
    g.add_color_stop_rgb(1.0, *lo)
    return g

def draw_shadow(ctx, x, y, rx, ry=9):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1.0, ry / max(1.0, rx))
    ctx.arc(0, 0, rx, 0, math.tau)
    ctx.set_source_rgba(0.04, 0.02, 0.01, 0.36)
    ctx.fill()
    ctx.restore()

def draw_tapered_limb(ctx, x1, y1, x2, y2, w1, w2, hi, lo, trim=None):
    dx, dy = x2 - x1, y2 - y1
    ang = math.atan2(dy, dx)
    L = math.hypot(dx, dy)
    ctx.save()
    ctx.translate(x1, y1)
    ctx.rotate(ang)
    ctx.move_to(0, -w1 * 0.5)
    ctx.line_to(L, -w2 * 0.5)
    ctx.line_to(L + w2 * 0.25, 0)
    ctx.line_to(L, w2 * 0.5)
    ctx.line_to(0, w1 * 0.5)
    ctx.close_path()
    ctx.set_source(metal_grad(0, -w1 * 0.6, 0, w1 * 0.6, hi, lo))
    ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05)
    ctx.set_line_width(2.2)
    ctx.stroke()
    # Sculpted armor joint cop
    ctx.move_to(L * 0.45, -w2 * 0.65); ctx.line_to(L * 0.62, 0); ctx.line_to(L * 0.45, w2 * 0.65); ctx.line_to(L * 0.32, 0); ctx.close_path()
    ctx.set_source_rgb(*(trim if trim else hi)); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05); ctx.set_line_width(1.6); ctx.stroke()
    ctx.restore()

def draw_sword_slash(ctx, length, slash_alpha, col=(1.0, 0.94, 0.68)):
    if slash_alpha <= 0.04:
        return
    ctx.save()
    ctx.arc(0, 0, length * 1.12, -1.25, 0.45)
    ctx.arc_negative(0, 0, length * 0.52, 0.35, -1.15)
    ctx.close_path()
    gs = cairo.LinearGradient(0, -length, length, length * 0.4)
    gs.add_color_stop_rgba(0, 1.0, 0.99, 0.92, slash_alpha * 0.94)
    gs.add_color_stop_rgba(0.55, col[0], col[1], col[2], slash_alpha * 0.72)
    gs.add_color_stop_rgba(1, 1, 1, 1, 0.0)
    ctx.set_source(gs)
    ctx.fill()
    ctx.restore()

def get_kinematics(anim, t):
    phase = t * math.tau
    bob = math.sin(phase) * 3.6
    lunge = 0.0
    tilt = math.sin(phase) * 0.035
    swing = 0.0
    slash = 0.0
    guard = 0.0
    recoil = 0.0
    spin = phase

    if anim == "attack":
        if t < 0.30:
            u = ease_in_out(t / 0.30)
            lunge = -14 * u; tilt = -0.22 * u; swing = -1.45 * u; bob = 5 * u
        elif t < 0.58:
            u = ease_out_back((t - 0.30) / 0.28)
            lunge = -14 + 46 * u; tilt = -0.22 + 0.52 * u; swing = -1.45 + 2.35 * u
            bob = 5 - 10 * u
            slash = math.sin(((t - 0.30) / 0.28) * math.pi)
            spin = phase * 3.2
        else:
            u = ease_in_out((t - 0.58) / 0.42)
            lunge = 32 * (1 - u); tilt = 0.30 * (1 - u); swing = 0.90 * (1 - u); bob = -5 * (1 - u)
    elif anim == "guard":
        u = math.sin(t * math.pi)
        bob = 7 * u; lunge = -6 * u; tilt = -0.10 * u; guard = u
    elif anim == "hit":
        u = math.sin(t * math.pi)
        lunge = -20 * u; tilt = -0.26 * u; recoil = u; bob = -3 * u
    return phase, bob, lunge, tilt, swing, slash, guard, recoil, spin

# ==================== 1. HEROES (3 UNIQUE HIGH-DETAIL SILHOUETTES) ====================

def draw_hero_ironclad(ctx, anim, t, FW, FH):
    """Tall sculpted Gothic Vanguard Knight — tapered breastplate, flowing twin-tail cloak, pointed armet helm."""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.39 + lunge * sc, FH * 0.89)
    draw_shadow(ctx, 4 * sc, 2 * sc, 46 * sc)

    hi, lo, trim = (0.90, 0.93, 0.98), (0.28, 0.33, 0.42), (0.96, 0.78, 0.30)
    # Billowing double-layered crimson cape
    ctx.save()
    ctx.translate(-14 * sc, -112 * sc + bob * sc)
    w1, w2 = math.sin(phase) * 12 * sc, math.cos(phase + 1.0) * 15 * sc
    ctx.move_to(6 * sc, 0)
    ctx.curve_to(-32 * sc + w1, 34 * sc, -58 * sc + w2, 72 * sc, -50 * sc + w1, 102 * sc)
    ctx.line_to(-22 * sc + w2 * 0.6, 94 * sc)
    ctx.line_to(-4 * sc + w1 * 0.5, 104 * sc)
    ctx.curve_to(-6 * sc, 54 * sc, 4 * sc, 26 * sc, 16 * sc, 10 * sc)
    ctx.close_path()
    gc = cairo.LinearGradient(-50 * sc, 0, 16 * sc, 100 * sc)
    gc.add_color_stop_rgb(0, 0.84, 0.16, 0.14); gc.add_color_stop_rgb(1, 0.36, 0.05, 0.06)
    ctx.set_source(gc); ctx.fill_preserve()
    ctx.set_source_rgb(0.95, 0.78, 0.32); ctx.set_line_width(2.0); ctx.stroke()
    ctx.restore()

    # Athletic armored legs with knee cops & sabatons
    draw_tapered_limb(ctx, -8 * sc, -54 * sc + bob * sc, -22 * sc, -8 * sc, 18 * sc, 12 * sc, lo, (0.16, 0.19, 0.25))
    draw_tapered_limb(ctx, 10 * sc, -54 * sc + bob * sc, 24 * sc, -8 * sc, 20 * sc, 13 * sc, hi, lo, trim=trim)
    # Armored sabaton boots
    for bx, col in [(-30, lo), (14, hi)]:
        ctx.move_to(bx * sc, -12 * sc); ctx.line_to((bx + 26) * sc, -12 * sc); ctx.line_to((bx + 34) * sc, -2 * sc); ctx.line_to((bx - 2) * sc, -2 * sc); ctx.close_path()
        ctx.set_source_rgb(*col); ctx.fill_preserve()
        ctx.set_source_rgb(0.08, 0.06, 0.05); ctx.set_line_width(2.2); ctx.stroke()

    # Tapered V-waist Gothic torso
    ctx.save()
    ctx.translate(0, -56 * sc + bob * sc)
    ctx.rotate(tilt)
    # Layered waist tassets & heraldic ivory tabard
    ctx.move_to(-14 * sc, 0); ctx.line_to(16 * sc, 0); ctx.line_to(20 * sc, 30 * sc); ctx.line_to(1 * sc, 38 * sc); ctx.line_to(-18 * sc, 28 * sc); ctx.close_path()
    ctx.set_source_rgb(0.94, 0.90, 0.80); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(2.4); ctx.stroke()

    # Sculpted Fluted Cuirass (V-tapered silhouette!)
    ctx.move_to(-26 * sc, -56 * sc); ctx.line_to(28 * sc, -56 * sc); ctx.line_to(18 * sc, 2 * sc); ctx.line_to(-16 * sc, 2 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-26 * sc, -56 * sc, 28 * sc, 2 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05); ctx.set_line_width(2.6); ctx.stroke()
    # Gold chevron breastplate trim
    ctx.move_to(-18 * sc, -48 * sc); ctx.line_to(2 * sc, -20 * sc); ctx.line_to(22 * sc, -48 * sc)
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.4); ctx.stroke()

    # Sculpted Pointed Gothic Armet Helm with tall flowing crimson crest (ZERO EYES!)
    ctx.save()
    ctx.translate(4 * sc, -76 * sc)
    # Sweeping Plume Crest
    ctx.move_to(-4 * sc, -22 * sc); ctx.curve_to(-28 * sc, -38 * sc, -46 * sc + w1 * 0.4, -12 * sc, -38 * sc + w2 * 0.3, 12 * sc)
    ctx.curve_to(-24 * sc, -2 * sc, -14 * sc, -10 * sc, 4 * sc, -16 * sc); ctx.close_path()
    ctx.set_source_rgb(0.84, 0.16, 0.14); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.05, 0.04); ctx.set_line_width(2.0); ctx.stroke()
    # Pointed Beaked Steel Armet
    ctx.move_to(-18 * sc, 16 * sc); ctx.curve_to(-22 * sc, -16 * sc, -4 * sc, -26 * sc, 14 * sc, -18 * sc)
    ctx.line_to(26 * sc, -2 * sc); ctx.line_to(16 * sc, 16 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-20 * sc, -24 * sc, 26 * sc, 16 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05); ctx.set_line_width(2.5); ctx.stroke()
    # Brass brow trim + SOLID DARK VISOR SLIT ONLY
    ctx.move_to(-15 * sc, -8 * sc); ctx.line_to(21 * sc, -6 * sc); ctx.set_source_rgb(*trim); ctx.set_line_width(3.2); ctx.stroke()
    ctx.move_to(2 * sc, -3 * sc); ctx.line_to(23 * sc, -2 * sc); ctx.line_to(19 * sc, 3 * sc); ctx.line_to(2 * sc, 2 * sc); ctx.close_path()
    ctx.set_source_rgb(0.04, 0.04, 0.05); ctx.fill()
    ctx.restore()

    # Sword Arm & Ornate Greatsword
    ctx.save()
    ctx.translate(8 * sc, -46 * sc)
    ctx.rotate(-0.34 + swing)
    draw_tapered_limb(ctx, 0, 0, 32 * sc, 0, 15 * sc, 11 * sc, hi, lo, trim=trim)
    ctx.translate(32 * sc, 0)
    # Crossguard + Broadblade
    draw_rounded_rect(ctx, -5 * sc, -20 * sc, 10 * sc, 40 * sc, 4 * sc)
    ctx.set_source_rgb(*trim); ctx.fill_preserve(); ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(2.0); ctx.stroke()
    ctx.move_to(4 * sc, -8 * sc); ctx.line_to(72 * sc, -5 * sc); ctx.line_to(90 * sc, 0); ctx.line_to(72 * sc, 5 * sc); ctx.line_to(4 * sc, 8 * sc); ctx.close_path()
    ctx.set_source(metal_grad(0, -8 * sc, 0, 8 * sc, (0.98, 0.99, 1.0), (0.36, 0.42, 0.52))); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.08, 0.10); ctx.set_line_width(2.2); ctx.stroke()
    draw_sword_slash(ctx, 88 * sc, slash)
    ctx.restore()

    # Layered Sculpted Gothic Shoulder Pauldron
    ctx.move_to(-8 * sc, -58 * sc); ctx.curve_to(16 * sc, -66 * sc, 28 * sc, -44 * sc, 14 * sc, -30 * sc); ctx.line_to(-10 * sc, -36 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-10 * sc, -64 * sc, 24 * sc, -30 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(2.8); ctx.stroke()
    ctx.restore()

    # Royal Kite Tower Shield (foreground)
    ctx.save()
    ctx.translate((20 + guard * 20) * sc, (-70 - guard * 8 + bob * 0.7) * sc)
    ctx.move_to(-14 * sc, -38 * sc); ctx.line_to(22 * sc, -32 * sc); ctx.line_to(18 * sc, 22 * sc); ctx.line_to(0, 44 * sc); ctx.line_to(-16 * sc, 20 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-16 * sc, -38 * sc, 22 * sc, 44 * sc, (0.28, 0.54, 0.88), (0.10, 0.22, 0.44))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.0); ctx.stroke()
    draw_cogwheel(ctx, 4 * sc, -4 * sc, 11 * sc, 3 * sc, teeth=8, spokes=0, style="brass")
    if guard > 0.08:
        ctx.arc(16 * sc, 0, 46 * sc, -1.1, 1.1)
        ctx.set_source_rgba(1.0, 0.90, 0.48, guard * 0.85); ctx.set_line_width(6 * sc); ctx.stroke()
    ctx.restore()

    ctx.restore()
    if recoil > 0.25:
        ctx.save(); ctx.set_operator(cairo.OPERATOR_ATOP); ctx.set_source_rgba(1, 0.85, 0.6, recoil * 0.35); ctx.rectangle(0, 0, FW, FH); ctx.fill(); ctx.restore()

def draw_hero_arbalest(ctx, anim, t, FW, FH):
    """Sleek Crouched Emerald-Cloaked Siege Marksman with Hooded Visor & Repeating Clockwork Crossbow."""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.38 + lunge * 0.45 * sc, FH * 0.89)
    draw_shadow(ctx, 2 * sc, 2 * sc, 44 * sc)
    hi, lo, trim = (0.76, 0.64, 0.44), (0.34, 0.26, 0.16), (0.96, 0.82, 0.36)

    # Back quiver of steel bolts
    ctx.save(); ctx.translate(-22 * sc, -82 * sc + bob * sc); ctx.rotate(-0.35)
    draw_rounded_rect(ctx, -7 * sc, -26 * sc, 14 * sc, 46 * sc, 4 * sc)
    ctx.set_source_rgb(0.42, 0.24, 0.12); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2); ctx.stroke()
    ctx.restore()

    # Agile bent ranger stance legs
    draw_tapered_limb(ctx, -10 * sc, -46 * sc + bob * sc, -28 * sc, -6 * sc, 16 * sc, 11 * sc, lo, (0.18, 0.14, 0.10))
    draw_tapered_limb(ctx, 12 * sc, -46 * sc + bob * sc, 28 * sc, -6 * sc, 17 * sc, 11 * sc, hi, lo, trim=trim)

    # Flowing Emerald Hooded Mantle & Tunic
    ctx.save(); ctx.translate(0, -50 * sc + bob * sc); ctx.rotate(tilt + 0.10)
    w1 = math.sin(phase) * 9 * sc
    ctx.move_to(-18 * sc, -48 * sc); ctx.line_to(20 * sc, -48 * sc); ctx.line_to(16 * sc, 14 * sc); ctx.line_to(-28 * sc + w1, 20 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-24 * sc, -48 * sc, 20 * sc, 20 * sc, (0.20, 0.56, 0.42), (0.07, 0.24, 0.18))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(2.4); ctx.stroke()

    # Pointed Ranger Hood + Enclosed Bronze Face-Plate (ZERO EYES!)
    ctx.save(); ctx.translate(4 * sc, -66 * sc)
    ctx.move_to(-28 * sc, 10 * sc); ctx.curve_to(-22 * sc, -24 * sc, 6 * sc, -28 * sc, 20 * sc, -10 * sc); ctx.line_to(16 * sc, 16 * sc); ctx.line_to(-18 * sc, 16 * sc); ctx.close_path()
    ctx.set_source_rgb(0.14, 0.44, 0.32); ctx.fill_preserve(); ctx.set_source_rgb(0.06, 0.12, 0.08); ctx.set_line_width(2.4); ctx.stroke()
    # Enclosed brass visor mask inside hood
    ctx.move_to(0, -10 * sc); ctx.line_to(18 * sc, -8 * sc); ctx.line_to(15 * sc, 12 * sc); ctx.line_to(0, 12 * sc); ctx.close_path()
    ctx.set_source_rgb(*hi); ctx.fill()
    ctx.rectangle(4 * sc, -4 * sc, 13 * sc, 4 * sc); ctx.set_source_rgb(0.04, 0.04, 0.05); ctx.fill()
    ctx.restore()

    # Repeating Clockwork Heavy Arbalest aimed forward
    ctx.save(); ctx.translate(12 * sc, -30 * sc); ctx.rotate(swing * 0.22)
    draw_rounded_rect(ctx, -10 * sc, -7 * sc, 74 * sc, 14 * sc, 5 * sc)
    ctx.set_source_rgb(0.46, 0.26, 0.12); ctx.fill_preserve(); ctx.set_source_rgb(0.1, 0.06, 0.03); ctx.set_line_width(2.2); ctx.stroke()
    ctx.move_to(48 * sc, -34 * sc); ctx.curve_to(68 * sc, -10 * sc, 68 * sc, 10 * sc, 48 * sc, 34 * sc)
    ctx.set_source_rgb(*trim); ctx.set_line_width(7 * sc); ctx.stroke()
    draw_cogwheel(ctx, 20 * sc, 0, 11 * sc, 3 * sc, teeth=8, spokes=0, style="brass", angle=spin)
    if slash > 0.05:
        ctx.move_to(62 * sc, 0); ctx.line_to(148 * sc, 0)
        ctx.set_source_rgba(1.0, 0.94, 0.56, slash); ctx.set_line_width(7 * sc); ctx.stroke()
    ctx.restore()

    ctx.restore(); ctx.restore()

def draw_hero_artificer(ctx, anim, t, FW, FH):
    """Bulky Brass Clockwork Exosuit Engineer — Twin Steam Chimneys, Dorsal Gear & Piston Hammer."""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.39 + lunge * sc, FH * 0.89)
    draw_shadow(ctx, 2 * sc, 2 * sc, 52 * sc)
    hi, lo, trim = (0.95, 0.78, 0.38), (0.46, 0.30, 0.10), (1.0, 0.90, 0.54)

    # Dorsal Giant Gear + Twin Brass Steam Smokestacks
    draw_cogwheel(ctx, -22 * sc, -102 * sc + bob * sc, 30 * sc, 8 * sc, teeth=12, spokes=5, style="copper", angle=spin)
    for sx in [-26, -12]:
        draw_rounded_rect(ctx, sx * sc, -138 * sc + bob * sc, 10 * sc, 34 * sc, 3 * sc)
        ctx.set_source_rgb(0.40, 0.42, 0.46); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2); ctx.stroke()
        # Steam puff
        py = -146 * sc - ((t * 28) % 24) * sc
        ctx.arc((sx + 5) * sc, py, 7 * sc, 0, math.tau)
        ctx.set_source_rgba(1, 0.98, 0.92, 0.55); ctx.fill()

    draw_tapered_limb(ctx, -12 * sc, -48 * sc + bob * sc, -20 * sc, -6 * sc, 22 * sc, 16 * sc, lo, (0.24, 0.16, 0.08))
    draw_tapered_limb(ctx, 14 * sc, -48 * sc + bob * sc, 22 * sc, -6 * sc, 24 * sc, 17 * sc, hi, lo, trim=trim)

    ctx.save(); ctx.translate(0, -52 * sc + bob * sc); ctx.rotate(tilt)
    # Heavy Riveted Diving-Bell Brass Exo-Torso
    draw_rounded_rect(ctx, -32 * sc, -62 * sc, 66 * sc, 64 * sc, 22 * sc)
    ctx.set_source(metal_grad(-32 * sc, -62 * sc, 34 * sc, 2 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.02); ctx.set_line_width(3.0); ctx.stroke()
    # Chest Pressure Gauge Dial
    ctx.arc(8 * sc, -30 * sc, 14 * sc, 0, math.tau); ctx.set_source_rgb(0.98, 0.94, 0.82); ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.09, 0.03); ctx.set_line_width(2.5); ctx.stroke()
    ctx.move_to(8 * sc, -30 * sc); ctx.line_to(16 * sc, -38 * sc); ctx.set_source_rgb(0.82, 0.16, 0.10); ctx.set_line_width(2.8); ctx.stroke()

    # Enclosed Domed Brass Helm (ZERO EYES — horizontal riveted viewport grill!)
    ctx.arc(4 * sc, -76 * sc, 20 * sc, 0, math.tau)
    ctx.set_source(metal_grad(-16 * sc, -96 * sc, 24 * sc, -56 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.02); ctx.set_line_width(2.8); ctx.stroke()
    draw_rounded_rect(ctx, 2 * sc, -80 * sc, 19 * sc, 8 * sc, 3 * sc); ctx.set_source_rgb(0.05, 0.05, 0.06); ctx.fill()

    # Steam Hammer Arm
    ctx.save(); ctx.translate(10 * sc, -44 * sc); ctx.rotate(-0.35 + swing)
    draw_tapered_limb(ctx, 0, 0, 34 * sc, 0, 18 * sc, 14 * sc, hi, lo)
    ctx.translate(34 * sc, 0)
    draw_rounded_rect(ctx, -10 * sc, -5 * sc, 68 * sc, 10 * sc, 4 * sc); ctx.set_source_rgb(0.38, 0.24, 0.12); ctx.fill_preserve(); ctx.stroke()
    draw_rounded_rect(ctx, 48 * sc, -26 * sc, 34 * sc, 52 * sc, 8 * sc)
    ctx.set_source(metal_grad(48 * sc, -26 * sc, 82 * sc, 26 * sc, (0.76, 0.80, 0.86), (0.28, 0.30, 0.36))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.6); ctx.stroke()
    draw_sword_slash(ctx, 82 * sc, slash, col=(1.0, 0.82, 0.34))
    ctx.restore()

    ctx.restore(); ctx.restore()

# ==================== 2. 7 RADICALLY VARIED ENEMIES (ZERO CLONES!) ====================

def draw_enemy_pikeman(ctx, anim, t, FW, FH):
    """Tall, Lean, Conical-Helm Sandstone Desert Sentinel with Long Tattered Cloak & Polearm."""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.62 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)  # Face LEFT toward Hero
    draw_shadow(ctx, 0, 2 * sc, 40 * sc)
    hi, lo, trim = (0.78, 0.70, 0.56), (0.36, 0.30, 0.22), (0.86, 0.66, 0.26)

    # Tall Narrow Robed Silhouette (completely different from stocky Knight!)
    w1 = math.sin(phase) * 8 * sc
    ctx.move_to(-18 * sc, -118 * sc + bob * sc); ctx.line_to(16 * sc, -118 * sc + bob * sc)
    ctx.line_to(24 * sc, -4 * sc); ctx.line_to(-36 * sc + w1, -4 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-28 * sc, -118 * sc, 24 * sc, 0, (0.62, 0.34, 0.18), (0.26, 0.12, 0.08))); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.04); ctx.set_line_width(2.4); ctx.stroke()
    # Brass chest sash plates
    for sy in [-98, -76, -54]:
        draw_rounded_rect(ctx, -14 * sc, sy * sc + bob * sc, 30 * sc, 13 * sc, 4 * sc)
        ctx.set_source(metal_grad(-14 * sc, sy * sc, 16 * sc, sy * sc, hi, lo)); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.07, 0.04); ctx.set_line_width(1.8); ctx.stroke()

    # Tall Conical Spired Steel Helm (ZERO EYES!)
    ctx.save(); ctx.translate(2 * sc, -138 * sc + bob * sc); ctx.rotate(tilt)
    ctx.move_to(-16 * sc, 18 * sc); ctx.line_to(0, -34 * sc); ctx.line_to(18 * sc, 18 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-16 * sc, -34 * sc, 18 * sc, 18 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.04); ctx.set_line_width(2.4); ctx.stroke()
    ctx.rectangle(2 * sc, -2 * sc, 14 * sc, 5 * sc); ctx.set_source_rgb(0.05, 0.05, 0.06); ctx.fill()
    ctx.restore()

    # Long Crescent Glaive-Halberd
    ctx.save(); ctx.translate(6 * sc, -92 * sc + bob * sc); ctx.rotate(-0.22 + swing)
    draw_rounded_rect(ctx, -38 * sc, -3.5 * sc, 134 * sc, 7 * sc, 3 * sc)
    ctx.set_source_rgb(0.36, 0.22, 0.12); ctx.fill_preserve(); ctx.stroke()
    ctx.move_to(84 * sc, -4 * sc); ctx.line_to(122 * sc, 0); ctx.line_to(84 * sc, 4 * sc); ctx.close_path()
    ctx.set_source_rgb(0.92, 0.94, 0.98); ctx.fill_preserve(); ctx.stroke()
    ctx.move_to(72 * sc, 4 * sc); ctx.curve_to(78 * sc, 32 * sc, 104 * sc, 30 * sc, 102 * sc, 4 * sc); ctx.close_path()
    ctx.set_source_rgb(0.84, 0.88, 0.94); ctx.fill_preserve(); ctx.stroke()
    draw_sword_slash(ctx, 114 * sc, slash)
    ctx.restore()
    ctx.restore()

def draw_enemy_arbalest(ctx, anim, t, FW, FH):
    """NON-HUMANOID 3-Legged Articulated Brass Tripod Crossbow Walker!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * 0.4 * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 58 * sc)
    hi, lo, trim = (0.86, 0.66, 0.34), (0.40, 0.26, 0.10), (0.98, 0.84, 0.44)

    # 3 Articulated Mechanical Spider-Tripod Legs stepping subtly!
    walk = math.sin(phase) * 8 * sc
    for lx, kx, fx, col_h, col_l in [
        (-16, -42, -52 + walk, lo, (0.20, 0.14, 0.06)),
        (16, 44, 52 - walk, hi, lo),
        (0, -14, -10 - walk * 0.5, hi, lo),
    ]:
        draw_tapered_limb(ctx, lx * sc, -66 * sc + bob * sc, kx * sc, -38 * sc + bob * 0.5 * sc, 12 * sc, 9 * sc, col_h, col_l)
        draw_tapered_limb(ctx, kx * sc, -38 * sc + bob * 0.5 * sc, fx * sc, -2 * sc, 10 * sc, 7 * sc, col_h, col_l, trim=trim)

    # Rotating Armored Gun-Turret Pod (Pure Machine — ZERO face!)
    ctx.save(); ctx.translate(0, -78 * sc + bob * sc); ctx.rotate(tilt * 0.7)
    draw_cogwheel(ctx, -10 * sc, 0, 26 * sc, 8 * sc, teeth=10, spokes=4, style="iron", angle=spin)
    ctx.move_to(-32 * sc, -22 * sc); ctx.line_to(26 * sc, -30 * sc); ctx.line_to(38 * sc, 6 * sc); ctx.line_to(-26 * sc, 16 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-32 * sc, -30 * sc, 38 * sc, 16 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(2.8); ctx.stroke()
    # Twin Heavy Brass Arbalest Prod Arms & Bolt Rail
    ctx.move_to(32 * sc, -42 * sc); ctx.curve_to(62 * sc, -14 * sc, 62 * sc, 14 * sc, 32 * sc, 42 * sc)
    ctx.set_source_rgb(*trim); ctx.set_line_width(8 * sc); ctx.stroke()
    draw_rounded_rect(ctx, 18 * sc, -7 * sc, 64 * sc, 14 * sc, 4 * sc)
    ctx.set_source_rgb(0.32, 0.34, 0.38); ctx.fill_preserve(); ctx.stroke()
    if slash > 0.05:
        ctx.move_to(72 * sc, 0); ctx.line_to(156 * sc, 0)
        ctx.set_source_rgba(1.0, 0.90, 0.42, slash); ctx.set_line_width(8 * sc); ctx.stroke()
    ctx.restore(); ctx.restore()

def draw_enemy_automaton(ctx, anim, t, FW, FH):
    """NON-HUMANOID Giant Rolling Brass Gyro-Monowheel Saw-Automaton!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 54 * sc)

    # Colossal Spinning Outer Brass Wheel & Inner Counter-Spinning Saw Gear!
    wy = -62 * sc + bob * 0.5 * sc
    draw_cogwheel(ctx, 0, wy, 58 * sc, 36 * sc, teeth=18, spokes=6, style="brass", angle=spin * 1.4)
    draw_cogwheel(ctx, 0, wy, 38 * sc, 12 * sc, teeth=12, spokes=4, style="iron", angle=-spin * 2.0)

    # Central Armored Gyro-Housing + Twin Curved Scythe Blades
    ctx.save(); ctx.translate(0, wy); ctx.rotate(tilt)
    ctx.arc(0, 0, 22 * sc, 0, math.tau)
    ctx.set_source(metal_grad(-22 * sc, -22 * sc, 22 * sc, 22 * sc, (0.98, 0.86, 0.46), (0.48, 0.30, 0.10))); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.02); ctx.set_line_width(3); ctx.stroke()
    draw_rivet(ctx, 0, 0, r=7 * sc, style="iron")

    # Sweeping Articulated Brass Scythe Arm
    ctx.rotate(-0.4 + swing * 1.2)
    ctx.move_to(14 * sc, -10 * sc); ctx.curve_to(54 * sc, -38 * sc, 88 * sc, -18 * sc, 94 * sc, 14 * sc)
    ctx.curve_to(72 * sc, -2 * sc, 48 * sc, -6 * sc, 14 * sc, 6 * sc); ctx.close_path()
    ctx.set_source(metal_grad(14 * sc, -36 * sc, 94 * sc, 14 * sc, (0.98, 0.99, 1.0), (0.45, 0.50, 0.58))); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05); ctx.set_line_width(2.4); ctx.stroke()
    draw_sword_slash(ctx, 94 * sc, slash, col=(1.0, 0.86, 0.38))
    ctx.restore(); ctx.restore()

def draw_enemy_bulwark(ctx, anim, t, FW, FH):
    """Wide Hulking Iron Siege-Pavise Wall Fortress Warden!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * 0.75 * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 64 * sc)
    hi, lo, trim = (0.62, 0.68, 0.78), (0.20, 0.24, 0.32), (0.92, 0.74, 0.30)

    # Heavy Armored Legs behind the wall
    draw_tapered_limb(ctx, -28 * sc, -46 * sc + bob * sc, -34 * sc, -4 * sc, 24 * sc, 20 * sc, lo, (0.12, 0.14, 0.20))
    draw_tapered_limb(ctx, 6 * sc, -46 * sc + bob * sc, 8 * sc, -4 * sc, 24 * sc, 20 * sc, hi, lo)

    # Massive Broad-Shouldered Armored Body & Flat Citadel Helm (ZERO EYES!)
    ctx.save(); ctx.translate(-14 * sc, -58 * sc + bob * sc); ctx.rotate(tilt * 0.6)
    draw_rounded_rect(ctx, -38 * sc, -66 * sc, 74 * sc, 72 * sc, 14 * sc)
    ctx.set_source(metal_grad(-38 * sc, -66 * sc, 36 * sc, 6 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.4); ctx.stroke()
    # Flat Fortress Battlement Helm
    draw_rounded_rect(ctx, -16 * sc, -96 * sc, 36 * sc, 32 * sc, 6 * sc)
    ctx.set_source(metal_grad(-16 * sc, -96 * sc, 20 * sc, -64 * sc, hi, lo)); ctx.fill_preserve(); ctx.stroke()
    ctx.rectangle(0, -84 * sc, 18 * sc, 5 * sc); ctx.set_source_rgb(0.04, 0.04, 0.05); ctx.fill()

    # Flanged War Mace swinging over top of the shield wall!
    ctx.save(); ctx.translate(6 * sc, -58 * sc); ctx.rotate(-0.6 + swing)
    draw_rounded_rect(ctx, 0, -5 * sc, 72 * sc, 10 * sc, 4 * sc); ctx.set_source_rgb(0.36, 0.22, 0.12); ctx.fill_preserve(); ctx.stroke()
    ctx.arc(76 * sc, 0, 18 * sc, 0, math.tau); ctx.set_source_rgb(0.76, 0.80, 0.88); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(3); ctx.stroke()
    draw_sword_slash(ctx, 88 * sc, slash, col=(0.76, 0.88, 1.0))
    ctx.restore(); ctx.restore()

    # COLOSSAL FLOOR-TO-CROWN SPIKED IRON PAVISE SIEGE WALL IN FRONT!
    ctx.save(); ctx.translate(30 * sc, -64 * sc + bob * 0.5 * sc)
    ctx.move_to(-22 * sc, -64 * sc); ctx.line_to(20 * sc, -56 * sc); ctx.line_to(26 * sc, 58 * sc); ctx.line_to(-18 * sc, 62 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-22 * sc, -64 * sc, 26 * sc, 62 * sc, (0.44, 0.50, 0.62), (0.14, 0.17, 0.24))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(5.0); ctx.stroke()
    # Embossed steel cross & spikes
    ctx.move_to(2 * sc, -50 * sc); ctx.line_to(2 * sc, 50 * sc); ctx.move_to(-16 * sc, 0); ctx.line_to(20 * sc, 0)
    ctx.set_source_rgb(*trim); ctx.set_line_width(5.0); ctx.stroke()
    for sy in [-38, 0, 38]:
        ctx.move_to(22 * sc, (sy - 7) * sc); ctx.line_to(38 * sc, sy * sc); ctx.line_to(22 * sc, (sy + 7) * sc); ctx.close_path()
        ctx.set_source_rgb(0.90, 0.93, 0.98); ctx.fill_preserve(); ctx.set_source_rgb(0.10, 0.10, 0.12); ctx.set_line_width(2); ctx.stroke()
    ctx.restore(); ctx.restore()

def draw_enemy_hammer_golem(ctx, anim, t, FW, FH):
    """Massive Barrel-Chested Cast-Iron Furnace Boiler Golem with Glowing Grate & Twin Chimneys!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 62 * sc)
    hi, lo, trim = (0.58, 0.42, 0.32), (0.22, 0.15, 0.12), (0.96, 0.66, 0.22)

    # Hydraulic Piston Legs
    draw_tapered_limb(ctx, -20 * sc, -46 * sc + bob * sc, -26 * sc, -4 * sc, 24 * sc, 20 * sc, lo, (0.12, 0.08, 0.06))
    draw_tapered_limb(ctx, 20 * sc, -46 * sc + bob * sc, 26 * sc, -4 * sc, 24 * sc, 20 * sc, hi, lo, trim=trim)

    ctx.save(); ctx.translate(0, -64 * sc + bob * sc); ctx.rotate(tilt)
    # Twin Furnace Chimneys billowing embers
    for cx0 in [-24, 8]:
        draw_rounded_rect(ctx, cx0 * sc, -84 * sc, 16 * sc, 36 * sc, 4 * sc)
        ctx.set_source_rgb(0.24, 0.22, 0.24); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2.2); ctx.stroke()
    # Huge Rounded Cast-Iron Boiler Belly
    ctx.arc(0, -24 * sc, 46 * sc, 0, math.tau)
    ctx.set_source(metal_grad(-46 * sc, -70 * sc, 46 * sc, 22 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.06, 0.04); ctx.set_line_width(3.4); ctx.stroke()

    # Warm Glowing Brick-Furnace Hearth Grate in Belly!
    draw_rounded_rect(ctx, -16 * sc, -42 * sc, 42 * sc, 36 * sc, 8 * sc)
    gf = cairo.RadialGradient(6 * sc, -24 * sc, 4, 6 * sc, -24 * sc, 28 * sc)
    gf.add_color_stop_rgb(0, 1.0, 0.92, 0.46); gf.add_color_stop_rgb(0.6, 0.96, 0.46, 0.12); gf.add_color_stop_rgb(1, 0.45, 0.12, 0.04)
    ctx.set_source(gf); ctx.fill_preserve(); ctx.set_source_rgb(0.14, 0.10, 0.08); ctx.set_line_width(3); ctx.stroke()
    for gx in [-6, 4, 14]:
        ctx.move_to(gx * sc, -42 * sc); ctx.line_to(gx * sc, -6 * sc); ctx.set_line_width(3.5); ctx.stroke()

    # Massive Swinging Piston Anvil Fist!
    ctx.save(); ctx.translate(16 * sc, -32 * sc); ctx.rotate(-0.2 + swing * 1.15)
    draw_tapered_limb(ctx, 0, 0, 42 * sc, 0, 22 * sc, 18 * sc, hi, lo)
    draw_rounded_rect(ctx, 36 * sc, -22 * sc, 38 * sc, 44 * sc, 8 * sc)
    ctx.set_source(metal_grad(36 * sc, -22 * sc, 74 * sc, 22 * sc, (0.72, 0.75, 0.80), (0.26, 0.28, 0.32))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.4); ctx.stroke()
    draw_sword_slash(ctx, 78 * sc, slash, col=(1.0, 0.68, 0.22))
    ctx.restore(); ctx.restore(); ctx.restore()

def draw_enemy_ballista(ctx, anim, t, FW, FH):
    """Heavy Wheeled Timber-and-Brass Siege Ballista Artillery Carriage!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * 0.35 * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 68 * sc)
    trim = (0.94, 0.74, 0.30)

    # Angled Armored Ram-Prow Timber Chassis
    ctx.move_to(-58 * sc, -24 * sc); ctx.line_to(-52 * sc, -58 * sc); ctx.line_to(48 * sc, -58 * sc); ctx.line_to(68 * sc, -24 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-58 * sc, -58 * sc, 68 * sc, -24 * sc, (0.58, 0.36, 0.18), (0.26, 0.14, 0.07))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.4); ctx.stroke()
    # Two Large Spoked Iron-Rimmed Siege Wheels
    draw_cogwheel(ctx, -34 * sc, -24 * sc, 25 * sc, 8 * sc, teeth=12, spokes=5, style="iron", angle=spin)
    draw_cogwheel(ctx, 32 * sc, -24 * sc, 25 * sc, 8 * sc, teeth=12, spokes=5, style="iron", angle=spin)

    # Elevated Torsion Ballista Launcher & Iron Gun Shield
    ctx.save(); ctx.translate(0, -76 * sc + bob * 0.4 * sc); ctx.rotate(tilt * 0.5)
    draw_rounded_rect(ctx, -36 * sc, -14 * sc, 94 * sc, 22 * sc, 6 * sc)
    ctx.set_source(metal_grad(-36 * sc, -14 * sc, 58 * sc, 8 * sc, (0.64, 0.68, 0.74), (0.24, 0.26, 0.32))); ctx.fill_preserve(); ctx.stroke()
    ctx.move_to(36 * sc, -48 * sc); ctx.curve_to(68 * sc, -14 * sc, 68 * sc, 14 * sc, 36 * sc, 48 * sc)
    ctx.set_source_rgb(*trim); ctx.set_line_width(9 * sc); ctx.stroke()
    # Giant Steel Siege Spear Bolt
    ctx.move_to(20 * sc, 0); ctx.line_to(96 * sc, 0); ctx.set_source_rgb(0.98, 0.96, 0.88); ctx.set_line_width(6 * sc); ctx.stroke()
    ctx.move_to(84 * sc, -10 * sc); ctx.line_to(108 * sc, 0); ctx.line_to(84 * sc, 10 * sc); ctx.close_path(); ctx.fill()
    if slash > 0.05:
        ctx.move_to(96 * sc, 0); ctx.line_to(170 * sc, 0)
        ctx.set_source_rgba(1.0, 0.92, 0.48, slash); ctx.set_line_width(10 * sc); ctx.stroke()
    ctx.restore(); ctx.restore()

def draw_enemy_lancer(ctx, anim, t, FW, FH):
    """NON-HUMANOID Quad-Legged Frost-Iron Mechanical Strider Charger with Jousting Siege Lance!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 230.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 68 * sc)
    hi, lo, trim = (0.82, 0.90, 0.98), (0.30, 0.40, 0.56), (0.96, 0.82, 0.38)

    # 4 Articulated Mechanical Hydraulic Strider Legs (galloping cycle!)
    g1, g2 = math.sin(phase) * 14 * sc, math.cos(phase) * 14 * sc
    for bx, fx, col_h, col_l in [
        (-34, -46 + g1, lo, (0.16, 0.22, 0.34)),
        (-16, -22 - g2, hi, lo),
        (20, 28 + g2, lo, (0.16, 0.22, 0.34)),
        (36, 48 - g1, hi, lo),
    ]:
        draw_tapered_limb(ctx, bx * sc, -56 * sc + bob * sc, (bx + fx) * 0.5 * sc, -28 * sc, 13 * sc, 9 * sc, col_h, col_l)
        draw_tapered_limb(ctx, (bx + fx) * 0.5 * sc, -28 * sc, fx * sc, -2 * sc, 10 * sc, 7 * sc, col_h, col_l, trim=trim)

    # Armored Angular Strider Hull + High-Speed Jousting Lance
    ctx.save(); ctx.translate(0, -68 * sc + bob * sc); ctx.rotate(tilt * 0.6)
    ctx.move_to(-46 * sc, -18 * sc); ctx.line_to(38 * sc, -28 * sc); ctx.line_to(56 * sc, 2 * sc); ctx.line_to(36 * sc, 18 * sc); ctx.line_to(-42 * sc, 14 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-46 * sc, -28 * sc, 56 * sc, 18 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.4); ctx.stroke()
    # Enclosed Armored Lancer Turret Crest (ZERO EYES!)
    draw_rounded_rect(ctx, -12 * sc, -54 * sc, 36 * sc, 32 * sc, 10 * sc)
    ctx.set_source(metal_grad(-12 * sc, -54 * sc, 24 * sc, -22 * sc, hi, lo)); ctx.fill_preserve(); ctx.stroke()
    ctx.rectangle(6 * sc, -42 * sc, 16 * sc, 5 * sc); ctx.set_source_rgb(0.05, 0.05, 0.07); ctx.fill()
    # Massive Golden Spiral Jousting Lance
    ctx.save(); ctx.translate(22 * sc, -22 * sc); ctx.rotate(swing * 0.28)
    ctx.move_to(-18 * sc, -14 * sc); ctx.line_to(108 * sc, 0); ctx.line_to(-18 * sc, 14 * sc); ctx.close_path()
    ctx.set_source(metal_grad(0, -14 * sc, 0, 14 * sc, (1.0, 0.94, 0.64), (0.58, 0.40, 0.12))); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.07, 0.03); ctx.set_line_width(2.4); ctx.stroke()
    if slash > 0.05:
        ctx.move_to(52 * sc, 0); ctx.line_to(146 * sc, 0)
        ctx.set_source_rgba(1.0, 0.96, 0.66, slash); ctx.set_line_width(11 * sc); ctx.stroke()
    ctx.restore(); ctx.restore(); ctx.restore()

# ==================== 3. 6 MONUMENTAL UNIQUE ACT BOSSES ====================

def draw_boss_colossus(ctx, anim, t, FW, FH):
    """Act I Boss: Floating Segmented Sandstone & Golden-Ring Obelisk Titan!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 72 * sc)
    hi, lo, trim = (0.88, 0.78, 0.56), (0.44, 0.35, 0.20), (0.98, 0.82, 0.32)

    # Colossal Orbiting Brass Clockwork Halo Ring behind monolith!
    draw_cogwheel(ctx, 0, -124 * sc + bob * sc, 66 * sc, 44 * sc, teeth=20, spokes=6, style="brass", angle=spin)

    # Floating Levitating Lower Pedestal Stone
    ctx.move_to(-26 * sc, -66 * sc + bob * 0.6 * sc); ctx.line_to(26 * sc, -66 * sc + bob * 0.6 * sc); ctx.line_to(14 * sc, -18 * sc + bob * 0.6 * sc); ctx.line_to(-14 * sc, -18 * sc + bob * 0.6 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-26 * sc, -66 * sc, 26 * sc, -18 * sc, hi, lo)); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(3); ctx.stroke()

    # Towering Sculpted Sandstone-and-Brass Torso Monolith
    ctx.save(); ctx.translate(0, -126 * sc + bob * 1.3 * sc); ctx.rotate(tilt * 0.6)
    ctx.move_to(-44 * sc, -58 * sc); ctx.line_to(44 * sc, -58 * sc); ctx.line_to(30 * sc, 48 * sc); ctx.line_to(-30 * sc, 48 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-44 * sc, -58 * sc, 44 * sc, 48 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.0); ctx.stroke()
    # Enclosed Crowned Obelisk Capstone (ZERO EYES — solid dark carved slit!)
    ctx.move_to(-22 * sc, -60 * sc); ctx.line_to(0, -104 * sc); ctx.line_to(24 * sc, -60 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-22 * sc, -104 * sc, 24 * sc, -60 * sc, hi, lo)); ctx.fill_preserve(); ctx.stroke()
    ctx.rectangle(2 * sc, -78 * sc, 14 * sc, 6 * sc); ctx.set_source_rgb(0.06, 0.05, 0.04); ctx.fill()

    # Massive Floating Stone-and-Brass Hammer Gauntlet!
    ctx.save(); ctx.translate(36 * sc, -10 * sc); ctx.rotate(-0.3 + swing * 1.1)
    draw_rounded_rect(ctx, 8 * sc, -24 * sc, 54 * sc, 48 * sc, 10 * sc)
    ctx.set_source(metal_grad(8 * sc, -24 * sc, 62 * sc, 24 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.0); ctx.stroke()
    draw_sword_slash(ctx, 86 * sc, slash, col=(1.0, 0.86, 0.44))
    ctx.restore(); ctx.restore(); ctx.restore()

def draw_boss_juggernaut(ctx, anim, t, FW, FH):
    """Act II Boss: 6-Legged Armored Bronze Canyon Siege Crawler!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * 0.7 * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 88 * sc)
    hi, lo, trim = (0.90, 0.56, 0.26), (0.40, 0.20, 0.08), (1.0, 0.82, 0.36)

    # 6 Articulated Heavy Mechanical Crawler Legs
    for i, bx in enumerate([-54, -28, 0, 26, 50]):
        st = math.sin(phase + i * 1.2) * 10 * sc
        draw_tapered_limb(ctx, bx * sc, -58 * sc + bob * sc, (bx + 8) * sc, -28 * sc, 14 * sc, 10 * sc, hi if i % 2 == 0 else lo, lo)
        draw_tapered_limb(ctx, (bx + 8) * sc, -28 * sc, (bx + 12) * sc + st, -2 * sc, 11 * sc, 7 * sc, hi, lo, trim=trim)

    # Layered Bronze Armored Crawler Carapace
    ctx.save(); ctx.translate(0, -76 * sc + bob * sc); ctx.rotate(tilt * 0.5)
    ctx.move_to(-72 * sc, 16 * sc); ctx.curve_to(-66 * sc, -48 * sc, 36 * sc, -56 * sc, 72 * sc, -10 * sc); ctx.line_to(58 * sc, 24 * sc); ctx.line_to(-66 * sc, 24 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-72 * sc, -50 * sc, 72 * sc, 24 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.2); ctx.stroke()
    draw_cogwheel(ctx, -18 * sc, -14 * sc, 26 * sc, 8 * sc, teeth=12, spokes=5, style="brass", angle=spin)

    # Overhead Articulated Siege Halberd-Crane Arm!
    ctx.save(); ctx.translate(18 * sc, -38 * sc); ctx.rotate(-0.4 + swing * 1.15)
    draw_tapered_limb(ctx, 0, 0, 68 * sc, -10 * sc, 18 * sc, 12 * sc, hi, lo, trim=trim)
    ctx.move_to(56 * sc, -26 * sc); ctx.line_to(108 * sc, -4 * sc); ctx.line_to(62 * sc, 24 * sc); ctx.close_path()
    ctx.set_source_rgb(0.96, 0.90, 0.72); ctx.fill_preserve(); ctx.set_source_rgb(0.12, 0.06, 0.03); ctx.set_line_width(3); ctx.stroke()
    draw_sword_slash(ctx, 110 * sc, slash, col=(1.0, 0.74, 0.28))
    ctx.restore(); ctx.restore(); ctx.restore()

def draw_boss_furnace(ctx, anim, t, FW, FH):
    """Act III Boss: Walking Industrial Smelter Tower with Triple Glowing Hearths & Wrecking Anvil!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 78 * sc)
    hi, lo, trim = (0.50, 0.48, 0.52), (0.18, 0.16, 0.19), (0.98, 0.60, 0.16)

    draw_tapered_limb(ctx, -28 * sc, -58 * sc + bob * sc, -34 * sc, -4 * sc, 28 * sc, 22 * sc, lo, (0.10, 0.09, 0.11))
    draw_tapered_limb(ctx, 26 * sc, -58 * sc + bob * sc, 32 * sc, -4 * sc, 28 * sc, 22 * sc, hi, lo, trim=trim)

    ctx.save(); ctx.translate(0, -64 * sc + bob * sc); ctx.rotate(tilt * 0.5)
    # Triple Industrial Smokestacks
    for sx in [-36, -8, 20]:
        draw_rounded_rect(ctx, sx * sc, -148 * sc, 16 * sc, 48 * sc, 4 * sc)
        ctx.set_source_rgb(0.20, 0.18, 0.20); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2.5); ctx.stroke()
    # Massive Riveted Iron Furnace Tower Body
    draw_rounded_rect(ctx, -56 * sc, -108 * sc, 112 * sc, 114 * sc, 18 * sc)
    ctx.set_source(metal_grad(-56 * sc, -108 * sc, 56 * sc, 6 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.2); ctx.stroke()
    # Glowing Molten Forge Furnace Arch
    draw_rounded_rect(ctx, -26 * sc, -78 * sc, 62 * sc, 52 * sc, 12 * sc)
    gf = cairo.RadialGradient(6 * sc, -52 * sc, 6, 6 * sc, -52 * sc, 42 * sc)
    gf.add_color_stop_rgb(0, 1.0, 0.96, 0.54); gf.add_color_stop_rgb(0.6, 0.98, 0.46, 0.10); gf.add_color_stop_rgb(1, 0.42, 0.10, 0.03)
    ctx.set_source(gf); ctx.fill_preserve(); ctx.set_source_rgb(0.12, 0.09, 0.08); ctx.set_line_width(4); ctx.stroke()
    # Crane Wrecking Anvil Arm
    ctx.save(); ctx.translate(32 * sc, -84 * sc); ctx.rotate(-0.2 + swing * 1.15)
    draw_tapered_limb(ctx, 0, 0, 56 * sc, 10 * sc, 20 * sc, 14 * sc, hi, lo, trim=trim)
    draw_rounded_rect(ctx, 46 * sc, -20 * sc, 48 * sc, 56 * sc, 8 * sc)
    ctx.set_source(metal_grad(46 * sc, -20 * sc, 94 * sc, 36 * sc, (0.76, 0.78, 0.84), (0.24, 0.26, 0.30))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4); ctx.stroke()
    draw_sword_slash(ctx, 98 * sc, slash, col=(1.0, 0.58, 0.16))
    ctx.restore(); ctx.restore(); ctx.restore()

def draw_boss_glacier(ctx, anim, t, FW, FH):
    """Act IV Boss: Towering Frost-Iron Alpine Citadel Dreadnought with Battlement Shoulders & Ice-Steel Drill!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 78 * sc)
    hi, lo, trim = (0.82, 0.92, 1.0), (0.28, 0.44, 0.64), (0.94, 0.82, 0.40)

    draw_tapered_limb(ctx, -26 * sc, -58 * sc + bob * sc, -32 * sc, -4 * sc, 28 * sc, 22 * sc, lo, (0.14, 0.24, 0.38))
    draw_tapered_limb(ctx, 24 * sc, -58 * sc + bob * sc, 30 * sc, -4 * sc, 28 * sc, 22 * sc, hi, lo, trim=trim)

    ctx.save(); ctx.translate(0, -64 * sc + bob * sc); ctx.rotate(tilt * 0.5)
    # Castle Battlement Crenellations on Shoulders
    for bx in [-56, -34, 24, 46]:
        draw_rounded_rect(ctx, bx * sc, -126 * sc, 16 * sc, 28 * sc, 3 * sc)
        ctx.set_source_rgb(*hi); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2.6); ctx.stroke()
    # Heavy Angular Frost-Iron Citadel Hull
    ctx.move_to(-58 * sc, -104 * sc); ctx.line_to(58 * sc, -104 * sc); ctx.line_to(44 * sc, 8 * sc); ctx.line_to(-44 * sc, 8 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-58 * sc, -104 * sc, 58 * sc, 8 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(4.0); ctx.stroke()
    # Enclosed Keep Helm (ZERO EYES!)
    draw_rounded_rect(ctx, -18 * sc, -138 * sc, 40 * sc, 34 * sc, 8 * sc)
    ctx.set_source(metal_grad(-18 * sc, -138 * sc, 22 * sc, -104 * sc, hi, lo)); ctx.fill_preserve(); ctx.stroke()
    ctx.rectangle(4 * sc, -124 * sc, 18 * sc, 5 * sc); ctx.set_source_rgb(0.05, 0.06, 0.10); ctx.fill()

    # Rotating Spiral Siege Drill Lance!
    ctx.save(); ctx.translate(34 * sc, -56 * sc); ctx.rotate(swing * 0.32)
    ctx.move_to(0, -24 * sc); ctx.line_to(98 * sc, 0); ctx.line_to(0, 24 * sc); ctx.close_path()
    ctx.set_source(metal_grad(0, -24 * sc, 0, 24 * sc, (0.94, 0.98, 1.0), (0.34, 0.56, 0.80))); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.0); ctx.stroke()
    draw_sword_slash(ctx, 102 * sc, slash, col=(0.70, 0.92, 1.0))
    ctx.restore(); ctx.restore(); ctx.restore()

def draw_boss_arbiter(ctx, anim, t, FW, FH):
    """Act V Boss: Grand Cathedral Clockwork Astrolabe Construct — Giant Rotating Clock Halo & Swinging Pendulum!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 74 * sc)
    hi, lo, trim = (0.98, 0.84, 0.42), (0.50, 0.34, 0.10), (1.0, 0.94, 0.64)

    # Monumental Concentric Golden Horological Clock Halo!
    cy = -126 * sc + bob * sc
    draw_cogwheel(ctx, 0, cy, 82 * sc, 56 * sc, teeth=24, spokes=8, style="brass", angle=spin)
    draw_cogwheel(ctx, 0, cy, 52 * sc, 20 * sc, teeth=16, spokes=4, style="copper", angle=-spin * 1.5)

    # Swinging Golden Pendulum Tail below floating chassis
    ctx.save(); ctx.translate(0, cy + 20 * sc); ctx.rotate(math.sin(phase) * 0.38)
    ctx.move_to(0, 0); ctx.line_to(0, 82 * sc); ctx.set_source_rgb(*trim); ctx.set_line_width(6 * sc); ctx.stroke()
    ctx.arc(0, 86 * sc, 20 * sc, 0, math.tau); ctx.set_source(metal_grad(-20 * sc, 66 * sc, 20 * sc, 106 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.14, 0.08, 0.02); ctx.set_line_width(3); ctx.stroke()
    ctx.restore()

    # Floating Crowned Brass Astrolabe Core + Sweeping Clock-Hand Twin Blades!
    ctx.save(); ctx.translate(0, cy); ctx.rotate(tilt)
    ctx.move_to(0, -48 * sc); ctx.line_to(34 * sc, 0); ctx.line_to(0, 48 * sc); ctx.line_to(-34 * sc, 0); ctx.close_path()
    ctx.set_source(metal_grad(-34 * sc, -48 * sc, 34 * sc, 48 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.12, 0.07, 0.02); ctx.set_line_width(3.4); ctx.stroke()
    # Twin Sweeping Clock-Hand Sword Blades
    ctx.rotate(-0.3 + swing * 1.25)
    ctx.move_to(12 * sc, -10 * sc); ctx.line_to(108 * sc, 0); ctx.line_to(12 * sc, 10 * sc); ctx.close_path()
    ctx.set_source_rgb(1.0, 0.96, 0.78); ctx.fill_preserve(); ctx.set_source_rgb(0.12, 0.08, 0.03); ctx.set_line_width(2.6); ctx.stroke()
    draw_sword_slash(ctx, 110 * sc, slash, col=(1.0, 0.90, 0.42))
    ctx.restore(); ctx.restore()

def draw_boss_sovereign(ctx, anim, t, FW, FH):
    """Act VI Final Boss: Monumental Gilded Winged-Gear Sovereign Titan with Fanned Golden Pinion Wings & Greatsword!"""
    phase, bob, lunge, tilt, swing, slash, guard, recoil, spin = get_kinematics(anim, t)
    sc = FH / 260.0
    ctx.save()
    ctx.translate(FW * 0.60 - lunge * sc, FH * 0.89)
    ctx.scale(-1.0, 1.0)
    draw_shadow(ctx, 0, 2 * sc, 82 * sc)
    hi, lo, trim = (1.0, 0.90, 0.48), (0.56, 0.36, 0.08), (1.0, 0.97, 0.76)

    # Fanned Golden Mechanical Pinion Wings behind Sovereign!
    ctx.save(); ctx.translate(-12 * sc, -124 * sc + bob * sc)
    for k in range(5):
        ang = -2.4 + k * 0.34 + math.sin(phase + k * 0.3) * 0.07
        ctx.save(); ctx.rotate(ang)
        ctx.move_to(0, -7 * sc); ctx.line_to(96 * sc, -3 * sc); ctx.line_to(110 * sc, 0); ctx.line_to(96 * sc, 6 * sc); ctx.line_to(0, 7 * sc); ctx.close_path()
        ctx.set_source(metal_grad(0, -8 * sc, 110 * sc, 8 * sc, hi, lo)); ctx.fill_preserve()
        ctx.set_source_rgb(0.14, 0.08, 0.02); ctx.set_line_width(2.2); ctx.stroke()
        ctx.restore()
    draw_cogwheel(ctx, 0, 0, 32 * sc, 10 * sc, teeth=14, spokes=6, style="brass", angle=spin)
    ctx.restore()

    # Imperial Crimson Mantle
    ctx.move_to(-22 * sc, -128 * sc + bob * sc); ctx.line_to(-64 * sc, -6 * sc); ctx.line_to(8 * sc, -12 * sc); ctx.line_to(16 * sc, -124 * sc + bob * sc); ctx.close_path()
    ctx.set_source_rgb(0.72, 0.12, 0.14); ctx.fill_preserve(); ctx.set_source_rgb(*trim); ctx.set_line_width(2.6); ctx.stroke()

    draw_tapered_limb(ctx, -14 * sc, -62 * sc + bob * sc, -26 * sc, -6 * sc, 24 * sc, 16 * sc, lo, (0.28, 0.18, 0.04))
    draw_tapered_limb(ctx, 16 * sc, -62 * sc + bob * sc, 28 * sc, -6 * sc, 26 * sc, 17 * sc, hi, lo, trim=trim)

    ctx.save(); ctx.translate(0, -68 * sc + bob * sc); ctx.rotate(tilt)
    # Sculpted Gilded Sovereign Cuirass
    ctx.move_to(-36 * sc, -74 * sc); ctx.line_to(38 * sc, -74 * sc); ctx.line_to(24 * sc, 6 * sc); ctx.line_to(-24 * sc, 6 * sc); ctx.close_path()
    ctx.set_source(metal_grad(-36 * sc, -74 * sc, 38 * sc, 6 * sc, hi, lo)); ctx.fill_preserve()
    ctx.set_source_rgb(0.12, 0.07, 0.02); ctx.set_line_width(3.2); ctx.stroke()

    # Royal Sun-Crown Enclosed Helm (ZERO EYES!)
    ctx.save(); ctx.translate(4 * sc, -98 * sc)
    draw_rounded_rect(ctx, -22 * sc, -24 * sc, 46 * sc, 46 * sc, 12 * sc)
    ctx.set_source(metal_grad(-22 * sc, -24 * sc, 24 * sc, 22 * sc, hi, lo)); ctx.fill_preserve(); ctx.stroke()
    for sx in [-16, -2, 12]:
        ctx.move_to(sx * sc, -22 * sc); ctx.line_to((sx + 5) * sc, -44 * sc); ctx.line_to((sx + 10) * sc, -22 * sc); ctx.close_path()
        ctx.set_source_rgb(*trim); ctx.fill_preserve(); ctx.stroke()
    ctx.rectangle(2 * sc, -6 * sc, 20 * sc, 6 * sc); ctx.set_source_rgb(0.05, 0.04, 0.04); ctx.fill()
    ctx.restore()

    # Colossal Royal Sovereign Greatsword
    ctx.save(); ctx.translate(16 * sc, -56 * sc); ctx.rotate(-0.35 + swing * 1.1)
    draw_tapered_limb(ctx, 0, 0, 38 * sc, 0, 20 * sc, 14 * sc, hi, lo, trim=trim)
    ctx.translate(38 * sc, 0)
    draw_rounded_rect(ctx, -6 * sc, -28 * sc, 12 * sc, 56 * sc, 5 * sc); ctx.set_source_rgb(*trim); ctx.fill_preserve(); ctx.stroke()
    ctx.move_to(6 * sc, -12 * sc); ctx.line_to(94 * sc, -7 * sc); ctx.line_to(116 * sc, 0); ctx.line_to(94 * sc, 7 * sc); ctx.line_to(6 * sc, 12 * sc); ctx.close_path()
    ctx.set_source(metal_grad(0, -12 * sc, 0, 12 * sc, (1.0, 0.99, 0.92), (0.68, 0.54, 0.20))); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.07, 0.02); ctx.set_line_width(2.8); ctx.stroke()
    draw_sword_slash(ctx, 114 * sc, slash, col=(1.0, 0.88, 0.36))
    ctx.restore()

    ctx.restore(); ctx.restore()

DRAWERS = {
    "hero_ironclad": (draw_hero_ironclad, False),
    "hero_arbalest": (draw_hero_arbalest, False),
    "hero_artificer": (draw_hero_artificer, False),
    "enemy_pikeman": (draw_enemy_pikeman, False),
    "enemy_arbalest": (draw_enemy_arbalest, False),
    "enemy_automaton": (draw_enemy_automaton, False),
    "enemy_bulwark": (draw_enemy_bulwark, False),
    "enemy_hammer_golem": (draw_enemy_hammer_golem, False),
    "enemy_ballista": (draw_enemy_ballista, False),
    "enemy_lancer": (draw_enemy_lancer, False),
    "boss_colossus": (draw_boss_colossus, True),
    "boss_juggernaut": (draw_boss_juggernaut, True),
    "boss_furnace": (draw_boss_furnace, True),
    "boss_glacier": (draw_boss_glacier, True),
    "boss_arbiter": (draw_boss_arbiter, True),
    "boss_sovereign": (draw_boss_sovereign, True),
}

def gen_all_sprites():
    os.makedirs(OUT_SPRITES, exist_ok=True)
    manifest = {}
    for uid, (drawer, is_boss) in DRAWERS.items():
        is_hero = uid.startswith("hero_")
        # Compact GPU-friendly frame dimensions packed in a 4x3 grid atlas (max ~1024x768!)
        fw = 256 if is_boss else 224
        fh = 232 if is_boss else 200
        anims = [("idle", 12), ("attack", 12), ("hit", 8)]
        if is_hero:
            anims.append(("guard", 8))

        manifest[uid] = {"frameWidth": fw, "frameHeight": fh, "anims": {}}
        for aname, nframes in anims:
            cols = 4
            rows = math.ceil(nframes / cols)
            atlas = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 0))
            for f in range(nframes):
                t = f / float(nframes)
                surf, ctx = make_surface(fw, fh)
                drawer(ctx, aname, t, fw, fh)
                cx = (f % cols) * fw
                cy = (f // cols) * fh
                atlas.paste(surface_to_pil(surf), (cx, cy))
            fname = f"{uid}_{aname}.png"
            save_png(atlas, os.path.join(OUT_SPRITES, fname))
            manifest[uid]["anims"][aname] = {
                "file": f"./assets/sprites/{fname}",
                "frames": nframes,
                "cols": cols,
                "rows": rows
            }

    with open(os.path.join(OUT_SPRITES, "manifest.json"), "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, indent=2)
    print(f"Generated {len(DRAWERS)} radically varied high-detail units in compact 4x3 GPU atlases!")

if __name__ == "__main__":
    gen_all_sprites()
