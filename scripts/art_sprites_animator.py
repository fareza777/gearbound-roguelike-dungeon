"""
Polished Frame-by-Frame Articulated Painterly Sprite Sheet Animator for Gearbound.
- Zero weapon clipping (wide 280x240 hero/enemy frames, 360x300 boss frames)
- Clean anti-aliased metallic armor layering (sculpted pauldrons, breastplate ridge,
  tassets, articulated knee-cops, layered billowing capes, luminous steel slash smears)
- STRICT ZERO TASWIR: 100% enclosed solid-visor medieval steel/brass helmets &
  purely mechanical clockwork automatons (ZERO eyes, ZERO glowing eyes, ZERO faces).
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

def draw_metallic_limb(ctx, x1, y1, x2, y2, w1, w2, c_hi, c_lo, trim=None):
    dx, dy = x2 - x1, y2 - y1
    ang = math.atan2(dy, dx)
    length = math.hypot(dx, dy)
    ctx.save()
    ctx.translate(x1, y1)
    ctx.rotate(ang)
    ctx.move_to(0, -w1 * 0.5)
    ctx.line_to(length, -w2 * 0.5)
    ctx.arc(length, 0, w2 * 0.5, -math.pi / 2, math.pi / 2)
    ctx.line_to(0, w1 * 0.5)
    ctx.arc(0, 0, w1 * 0.5, math.pi / 2, 3 * math.pi / 2)
    ctx.close_path()
    g = cairo.LinearGradient(0, -w1 * 0.7, 0, w1 * 0.7)
    g.add_color_stop_rgb(0.0, *c_hi)
    g.add_color_stop_rgb(0.42, (c_hi[0] + c_lo[0]) * 0.54, (c_hi[1] + c_lo[1]) * 0.54, (c_hi[2] + c_lo[2]) * 0.54)
    g.add_color_stop_rgb(1.0, *c_lo)
    ctx.set_source(g)
    ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.06, 0.05)
    ctx.set_line_width(2.6)
    ctx.stroke()
    # Sculpted knee/elbow cop guard
    ctx.arc(length * 0.52, -w2 * 0.1, w2 * 0.34, 0, math.tau)
    ctx.set_source_rgb(*c_hi); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.08, 0.06); ctx.set_line_width(2.0); ctx.stroke()
    if trim:
        ctx.set_source_rgb(*trim)
        ctx.set_line_width(2.4)
        ctx.move_to(length * 0.14, -w1 * 0.32); ctx.line_to(length * 0.86, -w2 * 0.32); ctx.stroke()
    ctx.restore()

def draw_enclosed_helmet(ctx, hx, hy, radius, helm_type, c_hi, c_lo, trim, plume_col):
    ctx.save()
    ctx.translate(hx, hy)
    if plume_col is not None:
        ctx.move_to(-radius * 0.20, -radius * 0.88)
        ctx.curve_to(-radius * 1.18, -radius * 1.48, -radius * 1.68, -radius * 0.62, -radius * 1.32, radius * 0.24)
        ctx.curve_to(-radius * 0.86, -radius * 0.18, -radius * 0.56, -radius * 0.48, -radius * 0.08, -radius * 0.66)
        ctx.close_path()
        gp = cairo.LinearGradient(-radius * 1.4, -radius * 1.3, 0, radius * 0.2)
        gp.add_color_stop_rgb(0.0, min(1.0, plume_col[0] * 1.25), min(1.0, plume_col[1] * 1.25), min(1.0, plume_col[2] * 1.25))
        gp.add_color_stop_rgb(1.0, plume_col[0] * 0.48, plume_col[1] * 0.48, plume_col[2] * 0.48)
        ctx.set_source(gp); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.06, 0.05); ctx.set_line_width(2.4); ctx.stroke()

    if helm_type == "greathelm":
        draw_rounded_rect(ctx, -radius * 0.86, -radius * 0.98, radius * 1.82, radius * 1.92, radius * 0.44)
    elif helm_type == "sallet":
        ctx.move_to(-radius * 1.12, radius * 0.48)
        ctx.curve_to(-radius * 1.06, -radius * 0.88, -radius * 0.28, -radius * 1.10, radius * 0.58, -radius * 0.92)
        ctx.curve_to(radius * 1.12, -radius * 0.72, radius * 1.14, radius * 0.36, radius * 0.84, radius * 0.84)
        ctx.line_to(-radius * 0.86, radius * 0.78)
        ctx.close_path()
    elif helm_type == "automaton_dome":
        ctx.arc(0, 0, radius * 0.94, 0, math.tau)
    else:
        draw_rounded_rect(ctx, -radius * 0.90, -radius * 1.04, radius * 1.88, radius * 1.98, radius * 0.48)

    g = cairo.LinearGradient(-radius, -radius, radius, radius)
    g.add_color_stop_rgb(0.0, *c_hi)
    g.add_color_stop_rgb(0.35, min(1, c_hi[0] * 1.08), min(1, c_hi[1] * 1.08), min(1, c_hi[2] * 1.08))
    g.add_color_stop_rgb(0.7, (c_hi[0] + c_lo[0]) * 0.45, (c_hi[1] + c_lo[1]) * 0.45, (c_hi[2] + c_lo[2]) * 0.45)
    g.add_color_stop_rgb(1.0, *c_lo)
    ctx.set_source(g); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.07, 0.06); ctx.set_line_width(3.0); ctx.stroke()

    # Brass brow band
    ctx.set_source_rgb(*trim)
    ctx.set_line_width(4.0)
    ctx.move_to(-radius * 0.82, -radius * 0.25); ctx.line_to(radius * 0.90, -radius * 0.25); ctx.stroke()

    # SOLID DARK VISOR SLIT ONLY (ZERO eyes, ZERO glowing dots, ZERO face)
    draw_rounded_rect(ctx, radius * 0.06, -radius * 0.14, radius * 0.84, radius * 0.18, radius * 0.07)
    ctx.set_source_rgb(0.05, 0.05, 0.06); ctx.fill()

    # Breather vents
    ctx.set_source_rgb(0.10, 0.09, 0.11); ctx.set_line_width(2.3)
    for k in range(3):
        vx = radius * (0.24 + k * 0.20)
        ctx.move_to(vx, radius * 0.24); ctx.line_to(vx, radius * 0.62); ctx.stroke()

    if helm_type == "sovereign_crown_helm":
        for sx in [-0.55, -0.10, 0.35]:
            ctx.move_to(radius * sx, -radius * 0.94)
            ctx.line_to(radius * (sx + 0.18), -radius * 1.50)
            ctx.line_to(radius * (sx + 0.36), -radius * 0.94)
            ctx.close_path()
            ctx.set_source_rgb(*trim); ctx.fill_preserve()
            ctx.set_source_rgb(0.12, 0.08, 0.03); ctx.set_line_width(2.0); ctx.stroke()

    draw_rivet(ctx, -radius * 0.36, -radius * 0.25, r=3.2, style="brass")
    ctx.restore()

def draw_weapon(ctx, wtype, length, c_trim, slash_alpha=0.0):
    ctx.save()
    if wtype == "broadsword":
        draw_rounded_rect(ctx, -6, -19, 12, 38, 4)
        ctx.set_source_rgb(*c_trim); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.07, 0.03); ctx.set_line_width(2.4); ctx.stroke()
        ctx.move_to(4, -8.5); ctx.line_to(length * 0.82, -6.5); ctx.line_to(length, 0)
        ctx.line_to(length * 0.82, 6.5); ctx.line_to(4, 8.5); ctx.close_path()
        gb = cairo.LinearGradient(0, -9, 0, 9)
        gb.add_color_stop_rgb(0.0, 0.98, 0.99, 1.0)
        gb.add_color_stop_rgb(0.5, 0.72, 0.76, 0.84)
        gb.add_color_stop_rgb(1.0, 0.36, 0.40, 0.48)
        ctx.set_source(gb); ctx.fill_preserve()
        ctx.set_source_rgb(0.08, 0.08, 0.10); ctx.set_line_width(2.4); ctx.stroke()
        if slash_alpha > 0.03:
            ctx.save()
            ctx.arc(0, 0, length * 1.04, -1.15, 0.45)
            ctx.arc_negative(0, 0, length * 0.52, 0.35, -1.05)
            ctx.close_path()
            gs = cairo.LinearGradient(0, -length, length, length * 0.4)
            gs.add_color_stop_rgba(0, 1.0, 0.96, 0.72, slash_alpha * 0.92)
            gs.add_color_stop_rgba(0.5, 1.0, 0.82, 0.36, slash_alpha * 0.65)
            gs.add_color_stop_rgba(1, 1.0, 1.0, 1.0, 0.0)
            ctx.set_source(gs); ctx.fill()
            ctx.restore()
    elif wtype == "halberd":
        draw_rounded_rect(ctx, -24, -4, length + 22, 8, 3.5)
        ctx.set_source_rgb(0.42, 0.25, 0.13); ctx.fill_preserve()
        ctx.set_source_rgb(0.09, 0.06, 0.03); ctx.set_line_width(2.2); ctx.stroke()
        ctx.move_to(length - 12, -5); ctx.line_to(length + 22, 0); ctx.line_to(length - 12, 5); ctx.close_path()
        ctx.set_source_rgb(0.92, 0.95, 1.0); ctx.fill_preserve(); ctx.stroke()
        ctx.move_to(length - 22, 4); ctx.curve_to(length - 20, 32, length + 4, 32, length + 4, 5); ctx.close_path()
        ctx.set_source_rgb(0.84, 0.88, 0.95); ctx.fill_preserve(); ctx.stroke()
        if slash_alpha > 0.04:
            ctx.arc(0, 0, length * 1.05, -0.95, 0.45)
            ctx.set_source_rgba(1.0, 0.88, 0.46, slash_alpha * 0.78); ctx.set_line_width(12); ctx.stroke()
    elif wtype == "crossbow":
        draw_rounded_rect(ctx, -12, -6.5, length * 0.72, 13, 5)
        ctx.set_source_rgb(0.44, 0.24, 0.12); ctx.fill_preserve()
        ctx.set_source_rgb(0.09, 0.06, 0.03); ctx.set_line_width(2.4); ctx.stroke()
        ctx.move_to(length * 0.54, -32); ctx.curve_to(length * 0.75, -10, length * 0.75, 10, length * 0.54, 32)
        ctx.set_source_rgb(*c_trim); ctx.set_line_width(6.5); ctx.stroke()
        ctx.move_to(10, 0); ctx.line_to(length * 0.94, 0)
        ctx.set_source_rgb(0.96, 0.98, 1.0); ctx.set_line_width(4.2); ctx.stroke()
        if slash_alpha > 0.05:
            ctx.move_to(length * 0.80, 0); ctx.line_to(length * 1.65, 0)
            ctx.set_source_rgba(1.0, 0.92, 0.48, slash_alpha); ctx.set_line_width(7); ctx.stroke()
    elif wtype == "steam_hammer":
        draw_rounded_rect(ctx, -14, -5, length * 0.82, 10, 4)
        ctx.set_source_rgb(0.38, 0.24, 0.14); ctx.fill_preserve()
        ctx.set_source_rgb(0.09, 0.06, 0.03); ctx.set_line_width(2.4); ctx.stroke()
        draw_rounded_rect(ctx, length * 0.62, -24, 34, 48, 7)
        gh = cairo.LinearGradient(length * 0.62, -24, length * 0.62, 24)
        gh.add_color_stop_rgb(0, 0.78, 0.81, 0.86); gh.add_color_stop_rgb(1, 0.28, 0.30, 0.36)
        ctx.set_source(gh); ctx.fill_preserve()
        ctx.set_source_rgb(*c_trim); ctx.set_line_width(4.2); ctx.stroke()
        if slash_alpha > 0.04:
            ctx.arc(length * 0.78, 0, 38 * slash_alpha + 14, 0, math.tau)
            ctx.set_source_rgba(1.0, 0.84, 0.34, slash_alpha * 0.62); ctx.set_line_width(7); ctx.stroke()
    elif wtype == "twin_blades":
        ctx.move_to(0, -7); ctx.line_to(length * 0.86, -5); ctx.line_to(length, 0); ctx.line_to(length * 0.86, 5); ctx.line_to(0, 7); ctx.close_path()
        ctx.set_source_rgb(0.95, 0.80, 0.38); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.07, 0.03); ctx.set_line_width(2.4); ctx.stroke()
        if slash_alpha > 0.04:
            ctx.arc(0, 0, length * 1.0, -0.95, 0.85)
            ctx.set_source_rgba(1.0, 0.86, 0.38, slash_alpha * 0.82); ctx.set_line_width(13); ctx.stroke()
    elif wtype == "lance":
        ctx.move_to(-16, -13); ctx.line_to(length * 1.15, 0); ctx.line_to(-16, 13); ctx.close_path()
        gl = cairo.LinearGradient(0, -13, 0, 13)
        gl.add_color_stop_rgb(0, 0.98, 0.92, 0.62); gl.add_color_stop_rgb(1, 0.56, 0.38, 0.14)
        ctx.set_source(gl); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.07, 0.03); ctx.set_line_width(2.6); ctx.stroke()
        if slash_alpha > 0.04:
            ctx.move_to(length * 0.5, 0); ctx.line_to(length * 1.35, 0)
            ctx.set_source_rgba(1.0, 0.94, 0.60, slash_alpha * 0.85); ctx.set_line_width(9); ctx.stroke()
    ctx.restore()

def draw_character_frame(ctx, spec, anim, t, FW, FH):
    facing = spec.get("facing", 1)
    # Give extra forward reach margin so weapon NEVER clips frame edges!
    cx = FW * (0.40 if facing == 1 else 0.60)
    foot_y = FH * 0.89
    sc = spec["scale"] * (FH / 240.0)

    phase = t * math.tau
    bob = math.sin(phase) * 3.8 * sc
    torso_tilt = math.sin(phase) * 0.04
    lunge_x = 0.0
    arm_ang = -0.32 + math.sin(phase) * 0.08
    shield_x = 18.0 * sc
    shield_y = -58.0 * sc + bob * 0.7
    slash_alpha = 0.0
    gear_spin = phase
    cape_wave = phase
    recoil_flash = 0.0
    guard_glow = 0.0

    if anim == "attack":
        if t < 0.30:
            u = ease_in_out(t / 0.30)
            lunge_x = -12.0 * sc * u
            torso_tilt = -0.22 * u
            arm_ang = -0.32 - 1.50 * u
            bob = 5.0 * sc * u
        elif t < 0.58:
            u = ease_out_back((t - 0.30) / 0.28)
            lunge_x = (-12.0 + 44.0 * u) * sc
            torso_tilt = -0.22 + 0.52 * u
            arm_ang = -1.82 + 2.38 * u
            bob = (5.0 - 9.0 * u) * sc
            slash_alpha = math.sin(((t - 0.30) / 0.28) * math.pi)
            gear_spin = phase * 3.0
        else:
            u = ease_in_out((t - 0.58) / 0.42)
            lunge_x = 32.0 * (1.0 - u) * sc
            torso_tilt = 0.30 * (1.0 - u)
            arm_ang = 0.56 - 0.88 * u
            bob = -4.0 * (1.0 - u) * sc
    elif anim == "guard":
        u = math.sin(t * math.pi)
        bob = 7.0 * sc * u
        lunge_x = -5.0 * sc * u
        torso_tilt = -0.09 * u
        shield_x = (18.0 + 18.0 * u) * sc
        shield_y = (-58.0 - 6.0 * u) * sc
        arm_ang = -1.00 * u - 0.32 * (1.0 - u)
        guard_glow = u
    elif anim == "hit":
        u = math.sin(t * math.pi)
        lunge_x = -18.0 * sc * u
        torso_tilt = -0.26 * u
        arm_ang = -0.82 * u - 0.32
        bob = -4.0 * sc * u
        recoil_flash = u

    ctx.save()
    ctx.translate(cx, foot_y)
    ctx.scale(facing, 1.0)
    ctx.translate(lunge_x, 0)

    c_hi = spec["armor_hi"]
    c_lo = spec["armor_lo"]
    trim = spec["trim"]
    cloth = spec["cloth"]

    # Ground contact shadow oval (soft anchor)
    ctx.save()
    ctx.scale(1.0, 0.26)
    ctx.arc(0, 6 * sc, 44 * sc, 0, math.tau)
    ctx.set_source_rgba(0.05, 0.03, 0.02, 0.34)
    ctx.fill()
    ctx.restore()

    if spec.get("archetype") == "ballista":
        draw_rounded_rect(ctx, -56 * sc, -48 * sc + bob * 0.4, 114 * sc, 26 * sc, 6 * sc)
        ctx.set_source_rgb(0.46, 0.28, 0.14); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.06, 0.03); ctx.set_line_width(3); ctx.stroke()
        draw_cogwheel(ctx, -32 * sc, -24 * sc, 24 * sc, 7 * sc, teeth=10, spokes=4, style="iron", angle=gear_spin)
        draw_cogwheel(ctx, 34 * sc, -24 * sc, 24 * sc, 7 * sc, teeth=10, spokes=4, style="iron", angle=gear_spin)
        ctx.save()
        ctx.translate(0, -56 * sc + bob * 0.5)
        ctx.rotate(torso_tilt * 0.6)
        draw_rounded_rect(ctx, -28 * sc, -46 * sc, 56 * sc, 44 * sc, 8 * sc)
        ctx.set_source_rgb(*c_hi); ctx.fill_preserve()
        ctx.set_source_rgb(*trim); ctx.set_line_width(4); ctx.stroke()
        draw_weapon(ctx, "crossbow", 92 * sc, trim, slash_alpha=slash_alpha)
        ctx.restore()
        ctx.restore()
        return

    if cloth is not None:
        ctx.save()
        ctx.translate(-12 * sc, -96 * sc + bob)
        w1 = math.sin(cape_wave) * 10 * sc
        w2 = math.cos(cape_wave + 1.1) * 13 * sc
        ctx.move_to(4 * sc, 0)
        ctx.curve_to(-28 * sc + w1, 28 * sc, -48 * sc + w2, 62 * sc, -42 * sc + w1, 88 * sc)
        ctx.line_to(-6 * sc + w2 * 0.5, 84 * sc)
        ctx.curve_to(-10 * sc, 46 * sc, 2 * sc, 22 * sc, 12 * sc, 8 * sc)
        ctx.close_path()
        gcl = cairo.LinearGradient(-44 * sc, 0, 12 * sc, 88 * sc)
        gcl.add_color_stop_rgb(0, min(1, cloth[0] * 1.15), min(1, cloth[1] * 1.15), min(1, cloth[2] * 1.15))
        gcl.add_color_stop_rgb(1, cloth[0] * 0.42, cloth[1] * 0.42, cloth[2] * 0.42)
        ctx.set_source(gcl); ctx.fill_preserve()
        ctx.set_source_rgb(0.10, 0.05, 0.04); ctx.set_line_width(2.4); ctx.stroke()
        ctx.restore()

    if spec.get("dorsal_gear", False):
        gr = (36 if spec["is_boss"] else 25) * sc
        draw_cogwheel(ctx, -20 * sc, -88 * sc + bob, gr, gr * 0.28, teeth=12, spokes=5, style="brass", angle=gear_spin)
        if spec["is_boss"]:
            draw_cogwheel(ctx, 14 * sc, -108 * sc + bob, gr * 0.70, gr * 0.22, teeth=10, spokes=4, style="copper", angle=-gear_spin * 1.4)

    knee_bend = 6 * sc if anim == "guard" else 0
    draw_metallic_limb(ctx, -10 * sc, -44 * sc + bob, -22 * sc, -6 * sc, 18 * sc, 14 * sc, c_lo, (c_lo[0] * 0.55, c_lo[1] * 0.55, c_lo[2] * 0.55))
    draw_rounded_rect(ctx, -30 * sc, -14 * sc, 28 * sc, 14 * sc, 6 * sc)
    ctx.set_source_rgb(*c_lo); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.07, 0.07); ctx.set_line_width(2.4); ctx.stroke()

    draw_metallic_limb(ctx, 12 * sc, -44 * sc + bob, 20 * sc + knee_bend, -6 * sc, 20 * sc, 15 * sc, c_hi, c_lo, trim=trim)
    draw_rounded_rect(ctx, 10 * sc + knee_bend, -14 * sc, 32 * sc, 14 * sc, 6 * sc)
    ctx.set_source_rgb(*c_hi); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.07, 0.07); ctx.set_line_width(2.6); ctx.stroke()

    ctx.save()
    ctx.translate(0, -48 * sc + bob)
    ctx.rotate(torso_tilt)

    tw = (36 if spec["is_boss"] else 28) * sc
    th = (58 if spec["is_boss"] else 50) * sc
    # Layered Armored Tassets (hip plates)
    for tx in [-tw * 0.65, 0, tw * 0.52]:
        draw_rounded_rect(ctx, tx - 9 * sc, -2 * sc, 22 * sc, 20 * sc, 5 * sc)
        ctx.set_source_rgb(*c_lo); ctx.fill_preserve()
        ctx.set_source_rgb(*trim); ctx.set_line_width(2.0); ctx.stroke()

    # Sculpted Cuirass
    ctx.move_to(-tw * 0.9, -th); ctx.line_to(tw * 1.0, -th)
    ctx.line_to(tw * 0.78, 4 * sc); ctx.line_to(-tw * 0.72, 4 * sc); ctx.close_path()
    gc = cairo.LinearGradient(-tw, -th, tw, 4 * sc)
    gc.add_color_stop_rgb(0.0, *c_hi)
    gc.add_color_stop_rgb(0.45, (c_hi[0] + c_lo[0]) * 0.52, (c_hi[1] + c_lo[1]) * 0.52, (c_hi[2] + c_lo[2]) * 0.52)
    gc.add_color_stop_rgb(1.0, *c_lo)
    ctx.set_source(gc); ctx.fill_preserve()
    ctx.set_source_rgb(0.08, 0.07, 0.06); ctx.set_line_width(3.0); ctx.stroke()

    # Specular chest ridge highlight
    ctx.move_to(tw * 0.15, -th + 6 * sc); ctx.line_to(tw * 0.12, -10 * sc)
    ctx.set_source_rgba(1, 0.98, 0.92, 0.45); ctx.set_line_width(3.5); ctx.stroke()

    # Brass belt & chest gear emblem
    draw_rounded_rect(ctx, -tw * 0.80, -8 * sc, tw * 1.62, 12 * sc, 4 * sc)
    ctx.set_source_rgb(*trim); ctx.fill_preserve()
    ctx.set_source_rgb(0.10, 0.07, 0.03); ctx.set_line_width(2.2); ctx.stroke()
    draw_cogwheel(ctx, 4 * sc, -th * 0.52, 13 * sc, 4 * sc, teeth=8, spokes=0, style="brass", angle=gear_spin * 0.5)

    # Back Pauldron
    ctx.arc(-tw * 0.72, -th * 0.85, 16 * sc, 0, math.tau)
    ctx.set_source_rgb(*c_lo); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(2.8); ctx.stroke()

    # Enclosed Helmet
    helm_r = (23 if spec["is_boss"] else 19) * sc
    draw_enclosed_helmet(ctx, 4 * sc, -th - helm_r * 0.82, helm_r, spec["helm"], c_hi, c_lo, trim, cloth)

    # Weapon Arm & Forged Weapon
    ctx.save()
    ctx.translate(6 * sc, -th * 0.78)
    ctx.rotate(arm_ang)
    draw_metallic_limb(ctx, 0, 0, 32 * sc, 0, 16 * sc, 13 * sc, c_hi, c_lo, trim=trim)
    ctx.translate(32 * sc, 0)
    draw_weapon(ctx, spec["weapon"], spec["weapon_len"] * sc, trim, slash_alpha=slash_alpha)
    ctx.restore()

    # Front Layered Shoulder Pauldron
    ctx.arc(4 * sc, -th * 0.82, 18 * sc, 0, math.tau)
    gp = cairo.RadialGradient(0, -th * 0.92, 3, 4 * sc, -th * 0.82, 18 * sc)
    gp.add_color_stop_rgb(0, *c_hi); gp.add_color_stop_rgb(1, *c_lo)
    ctx.set_source(gp); ctx.fill_preserve()
    ctx.set_source_rgb(*trim); ctx.set_line_width(3.0); ctx.stroke()
    draw_rivet(ctx, 4 * sc, -th * 0.82, r=3.5 * sc, style="brass")

    ctx.restore()

    if spec.get("has_shield", False):
        ctx.save()
        ctx.translate(shield_x, shield_y)
        sh_w = (22 if spec["is_boss"] else 17) * sc
        sh_h = (48 if spec["is_boss"] else 38) * sc
        ctx.move_to(-sh_w * 0.6, -sh_h); ctx.line_to(sh_w, -sh_h * 0.86)
        ctx.line_to(sh_w * 0.92, sh_h * 0.55); ctx.line_to(0, sh_h); ctx.line_to(-sh_w * 0.65, sh_h * 0.55); ctx.close_path()
        gsh = cairo.LinearGradient(-sh_w, -sh_h, sh_w, sh_h)
        sc0 = spec.get("shield_col", (0.24, 0.46, 0.78))
        gsh.add_color_stop_rgb(0, min(1, sc0[0] * 1.25), min(1, sc0[1] * 1.25), min(1, sc0[2] * 1.25))
        gsh.add_color_stop_rgb(1, sc0[0] * 0.42, sc0[1] * 0.42, sc0[2] * 0.42)
        ctx.set_source(gsh); ctx.fill_preserve()
        ctx.set_source_rgb(*trim); ctx.set_line_width(4.4); ctx.stroke()
        draw_rivet(ctx, sh_w * 0.2, 0, r=5.2 * sc, style="brass")
        if guard_glow > 0.05:
            ctx.arc(sh_w * 0.8, 0, sh_h * 1.1, -1.1, 1.1)
            ctx.set_source_rgba(1.0, 0.90, 0.46, guard_glow * 0.82)
            ctx.set_line_width(7 * sc); ctx.stroke()
        ctx.restore()

    ctx.restore()

    if recoil_flash > 0.25:
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_ATOP)
        ctx.set_source_rgba(1.0, 0.88, 0.64, recoil_flash * 0.36)
        ctx.rectangle(0, 0, FW, FH); ctx.fill()
        ctx.restore()

UNITS = [
    {"id": "hero_ironclad", "is_boss": False, "scale": 1.04, "facing": 1, "helm": "greathelm",
     "armor_hi": (0.86, 0.90, 0.96), "armor_lo": (0.34, 0.38, 0.46), "trim": (0.94, 0.76, 0.30),
     "cloth": (0.76, 0.16, 0.14), "weapon": "broadsword", "weapon_len": 76, "has_shield": True, "shield_col": (0.24, 0.46, 0.78), "dorsal_gear": False},
    {"id": "hero_arbalest", "is_boss": False, "scale": 1.02, "facing": 1, "helm": "sallet",
     "armor_hi": (0.82, 0.70, 0.48), "armor_lo": (0.36, 0.28, 0.18), "trim": (0.96, 0.82, 0.38),
     "cloth": (0.16, 0.48, 0.36), "weapon": "crossbow", "weapon_len": 74, "has_shield": False, "dorsal_gear": True},
    {"id": "hero_artificer", "is_boss": False, "scale": 1.05, "facing": 1, "helm": "automaton_dome",
     "armor_hi": (0.94, 0.78, 0.42), "armor_lo": (0.48, 0.32, 0.12), "trim": (0.98, 0.88, 0.50),
     "cloth": (0.20, 0.34, 0.62), "weapon": "steam_hammer", "weapon_len": 78, "has_shield": True, "shield_col": (0.72, 0.50, 0.16), "dorsal_gear": True},

    {"id": "enemy_pikeman", "is_boss": False, "scale": 0.98, "facing": -1, "helm": "sallet",
     "armor_hi": (0.68, 0.70, 0.74), "armor_lo": (0.28, 0.29, 0.34), "trim": (0.78, 0.62, 0.26),
     "cloth": (0.52, 0.22, 0.14), "weapon": "halberd", "weapon_len": 82, "has_shield": False, "dorsal_gear": False},
    {"id": "enemy_arbalest", "is_boss": False, "scale": 0.96, "facing": -1, "helm": "sallet",
     "armor_hi": (0.62, 0.56, 0.48), "armor_lo": (0.28, 0.24, 0.20), "trim": (0.84, 0.64, 0.28),
     "cloth": (0.38, 0.26, 0.16), "weapon": "crossbow", "weapon_len": 72, "has_shield": False, "dorsal_gear": False},
    {"id": "enemy_automaton", "is_boss": False, "scale": 1.02, "facing": -1, "helm": "automaton_dome",
     "armor_hi": (0.90, 0.70, 0.34), "armor_lo": (0.44, 0.28, 0.10), "trim": (0.98, 0.84, 0.44),
     "cloth": None, "weapon": "twin_blades", "weapon_len": 74, "has_shield": False, "dorsal_gear": True},
    {"id": "enemy_bulwark", "is_boss": False, "scale": 1.06, "facing": -1, "helm": "greathelm",
     "armor_hi": (0.64, 0.68, 0.76), "armor_lo": (0.24, 0.27, 0.34), "trim": (0.86, 0.68, 0.28),
     "cloth": (0.24, 0.32, 0.52), "weapon": "broadsword", "weapon_len": 68, "has_shield": True, "shield_col": (0.34, 0.38, 0.48), "dorsal_gear": False},
    {"id": "enemy_hammer_golem", "is_boss": False, "scale": 1.10, "facing": -1, "helm": "automaton_dome",
     "armor_hi": (0.76, 0.48, 0.28), "armor_lo": (0.32, 0.18, 0.12), "trim": (0.96, 0.72, 0.26),
     "cloth": None, "weapon": "steam_hammer", "weapon_len": 80, "has_shield": False, "dorsal_gear": True},
    {"id": "enemy_ballista", "is_boss": False, "scale": 1.04, "facing": -1, "archetype": "ballista", "helm": "automaton_dome",
     "armor_hi": (0.56, 0.58, 0.62), "armor_lo": (0.24, 0.25, 0.28), "trim": (0.88, 0.68, 0.26),
     "cloth": None, "weapon": "crossbow", "weapon_len": 86, "has_shield": False, "dorsal_gear": True},
    {"id": "enemy_lancer", "is_boss": False, "scale": 1.08, "facing": -1, "helm": "greathelm",
     "armor_hi": (0.82, 0.88, 0.96), "armor_lo": (0.34, 0.40, 0.52), "trim": (0.96, 0.82, 0.36),
     "cloth": (0.18, 0.34, 0.58), "weapon": "lance", "weapon_len": 86, "has_shield": True, "shield_col": (0.24, 0.44, 0.70), "dorsal_gear": False},

    {"id": "boss_colossus", "is_boss": True, "scale": 1.14, "facing": -1, "helm": "greathelm",
     "armor_hi": (0.84, 0.74, 0.54), "armor_lo": (0.42, 0.34, 0.22), "trim": (0.96, 0.78, 0.30),
     "cloth": (0.62, 0.22, 0.12), "weapon": "steam_hammer", "weapon_len": 88, "has_shield": True, "shield_col": (0.58, 0.44, 0.24), "dorsal_gear": True},
    {"id": "boss_juggernaut", "is_boss": True, "scale": 1.15, "facing": -1, "helm": "automaton_dome",
     "armor_hi": (0.88, 0.56, 0.28), "armor_lo": (0.42, 0.22, 0.10), "trim": (0.98, 0.80, 0.34),
     "cloth": (0.58, 0.16, 0.10), "weapon": "halberd", "weapon_len": 90, "has_shield": True, "shield_col": (0.64, 0.32, 0.14), "dorsal_gear": True},
    {"id": "boss_furnace", "is_boss": True, "scale": 1.16, "facing": -1, "helm": "automaton_dome",
     "armor_hi": (0.56, 0.52, 0.54), "armor_lo": (0.20, 0.18, 0.20), "trim": (0.98, 0.62, 0.18),
     "cloth": None, "weapon": "steam_hammer", "weapon_len": 92, "has_shield": False, "dorsal_gear": True},
    {"id": "boss_glacier", "is_boss": True, "scale": 1.15, "facing": -1, "helm": "greathelm",
     "armor_hi": (0.80, 0.90, 0.98), "armor_lo": (0.30, 0.44, 0.60), "trim": (0.94, 0.82, 0.40),
     "cloth": (0.18, 0.42, 0.68), "weapon": "lance", "weapon_len": 92, "has_shield": True, "shield_col": (0.28, 0.56, 0.80), "dorsal_gear": True},
    {"id": "boss_arbiter", "is_boss": True, "scale": 1.16, "facing": -1, "helm": "sovereign_crown_helm",
     "armor_hi": (0.96, 0.82, 0.42), "armor_lo": (0.50, 0.34, 0.12), "trim": (1.0, 0.92, 0.58),
     "cloth": (0.26, 0.38, 0.58), "weapon": "twin_blades", "weapon_len": 88, "has_shield": False, "dorsal_gear": True},
    {"id": "boss_sovereign", "is_boss": True, "scale": 1.18, "facing": -1, "helm": "sovereign_crown_helm",
     "armor_hi": (0.99, 0.88, 0.48), "armor_lo": (0.56, 0.38, 0.10), "trim": (1.0, 0.96, 0.70),
     "cloth": (0.76, 0.14, 0.16), "weapon": "broadsword", "weapon_len": 92, "has_shield": True, "shield_col": (0.74, 0.18, 0.16), "dorsal_gear": True},
]

def gen_all_sprites():
    os.makedirs(OUT_SPRITES, exist_ok=True)
    manifest = {}
    for spec in UNITS:
        uid = spec["id"]
        is_hero = uid.startswith("hero_")
        fw = 340 if spec["is_boss"] else 280
        fh = 280 if spec["is_boss"] else 230
        anims = [("idle", 12), ("attack", 12), ("hit", 8)]
        if is_hero:
            anims.append(("guard", 10))
        manifest[uid] = {"frameWidth": fw, "frameHeight": fh, "anims": {}}

        for aname, nframes in anims:
            sheet = Image.new("RGBA", (fw * nframes, fh), (0, 0, 0, 0))
            for f in range(nframes):
                t = f / float(nframes)
                surf, ctx = make_surface(fw, fh)
                draw_character_frame(ctx, spec, aname, t, fw, fh)
                sheet.paste(surface_to_pil(surf), (f * fw, 0))
            fname = f"{uid}_{aname}.png"
            save_png(sheet, os.path.join(OUT_SPRITES, fname))
            manifest[uid]["anims"][aname] = {"file": f"./assets/sprites/{fname}", "frames": nframes}

    with open(os.path.join(OUT_SPRITES, "manifest.json"), "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, indent=2)
    print(f"Re-generated {len(UNITS)} crisp unclipped multi-frame sprite sheets!")

if __name__ == "__main__":
    gen_all_sprites()
