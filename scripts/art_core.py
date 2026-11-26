"""
Shared painterly PBR shading, procedural textures (brushed brass, hammered iron,
walnut wood, sunlit parchment, obsidian slate, masonry stone), bevel normal lighting,
and PyCairo surface utilities for Gearbound bespoke art generation.
"""
import math
import os
import numpy as np
import cairo
from PIL import Image, ImageFilter, ImageEnhance
from scipy.ndimage import gaussian_filter

def make_surface(w: int, h: int):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    ctx = cairo.Context(surf)
    ctx.set_antialias(cairo.ANTIALIAS_BEST)
    return surf, ctx

def surface_to_pil(surf: cairo.ImageSurface) -> Image.Image:
    w, h = surf.get_width(), surf.get_height()
    buf = np.frombuffer(surf.get_data(), dtype=np.uint8).reshape((h, w, 4)).copy()
    # Cairo ARGB32 on little-endian is BGRA premultiplied
    a = buf[:, :, 3].astype(np.float32)
    mask = a > 0
    r = np.zeros_like(a)
    g = np.zeros_like(a)
    b = np.zeros_like(a)
    inv_a = np.where(mask, 255.0 / np.maximum(a, 1.0), 0.0)
    b = np.clip(buf[:, :, 0].astype(np.float32) * inv_a, 0, 255)
    g = np.clip(buf[:, :, 1].astype(np.float32) * inv_a, 0, 255)
    r = np.clip(buf[:, :, 2].astype(np.float32) * inv_a, 0, 255)
    rgba = np.stack([r, g, b, a], axis=-1).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")

def pil_to_surface(img: Image.Image) -> cairo.ImageSurface:
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    h, w, _ = rgba.shape
    a = rgba[:, :, 3:4].astype(np.float32) / 255.0
    bgra = np.zeros_like(rgba)
    bgra[:, :, 0] = np.clip(rgba[:, :, 2] * a[:, :, 0], 0, 255).astype(np.uint8)
    bgra[:, :, 1] = np.clip(rgba[:, :, 1] * a[:, :, 0], 0, 255).astype(np.uint8)
    bgra[:, :, 2] = np.clip(rgba[:, :, 0] * a[:, :, 0], 0, 255).astype(np.uint8)
    bgra[:, :, 3] = rgba[:, :, 3]
    surf = cairo.ImageSurface.create_for_data(memoryview(bgra.tobytes()), cairo.FORMAT_ARGB32, w, h)
    # Copy into owned buffer so memoryview isn't GC'd
    owned = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    c = cairo.Context(owned)
    c.set_source_surface(surf, 0, 0)
    c.paint()
    return owned

def fbm_noise(h: int, w: int, octaves=4, seed=42, scale_x=1.0, scale_y=1.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), dtype=np.float32)
    amp = 1.0
    tot = 0.0
    for i in range(octaves):
        gh = max(2, int((h / (2 ** (octaves - i + 1))) * scale_y))
        gw = max(2, int((w / (2 ** (octaves - i + 1))) * scale_x))
        grid = rng.random((gh, gw), dtype=np.float32)
        up = np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
        acc += up * amp
        tot += amp
        amp *= 0.52
    return (acc / tot).astype(np.float32)

def apply_surface_grain(img: Image.Image, strength=0.08, seed=11, brushed_h=False, warm_tint=None) -> Image.Image:
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    h, w, _ = arr.shape
    if brushed_h:
        n = fbm_noise(h, w, octaves=3, seed=seed, scale_x=0.18, scale_y=2.8)
    else:
        n = fbm_noise(h, w, octaves=4, seed=seed, scale_x=1.0, scale_y=1.0)
    delta = (n - 0.5) * 2.0 * strength * 255.0
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + delta, 0, 255)
    if warm_tint is not None:
        tr, tg, tb, ta = warm_tint
        arr[:, :, 0] = np.clip(arr[:, :, 0] * (1 - ta) + tr * ta, 0, 255)
        arr[:, :, 1] = np.clip(arr[:, :, 1] * (1 - ta) + tg * ta, 0, 255)
        arr[:, :, 2] = np.clip(arr[:, :, 2] * (1 - ta) + tb * ta, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), mode="RGBA")

def apply_pbr_bevel(img: Image.Image, bevel_radius=4.5, light_strength=0.45, shadow_strength=0.40) -> Image.Image:
    """Adds genuine heightfield bevel lighting along opaque shapes' edges for rich 3D metallic relief."""
    arr = np.array(img.convert("RGBA"), dtype=np.float32)
    alpha = arr[:, :, 3] / 255.0
    height = gaussian_filter(alpha, sigma=bevel_radius)
    gy, gx = np.gradient(height)
    # Light from top-left (-0.7, -0.7)
    dot = (-gx * 0.72 - gy * 0.72)
    hi = np.clip(dot * 12.0, 0, 1) * light_strength * 255.0
    lo = np.clip(-dot * 12.0, 0, 1) * shadow_strength * 255.0
    mask = alpha > 0.05
    for c, tint in enumerate([1.05, 0.98, 0.85]):
        arr[:, :, c] = np.where(mask, np.clip(arr[:, :, c] + hi * tint - lo, 0, 255), arr[:, :, c])
    return Image.fromarray(arr.astype(np.uint8), mode="RGBA")

def draw_rounded_rect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()

def draw_rivet(ctx, cx, cy, r=6.0, style="brass"):
    # Shadow
    ctx.save()
    ctx.arc(cx + r * 0.18, cy + r * 0.25, r * 1.12, 0, math.tau)
    ctx.set_source_rgba(0.06, 0.04, 0.02, 0.55)
    ctx.fill()
    # Body
    grad = cairo.RadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
    if style == "brass":
        grad.add_color_stop_rgb(0.0, 0.99, 0.92, 0.66)
        grad.add_color_stop_rgb(0.45, 0.80, 0.60, 0.24)
        grad.add_color_stop_rgb(1.0, 0.34, 0.22, 0.07)
    elif style == "iron":
        grad.add_color_stop_rgb(0.0, 0.72, 0.74, 0.78)
        grad.add_color_stop_rgb(0.5, 0.38, 0.40, 0.45)
        grad.add_color_stop_rgb(1.0, 0.14, 0.15, 0.18)
    else:
        grad.add_color_stop_rgb(0.0, 0.98, 0.78, 0.55)
        grad.add_color_stop_rgb(0.5, 0.72, 0.40, 0.22)
        grad.add_color_stop_rgb(1.0, 0.30, 0.14, 0.06)
    ctx.arc(cx, cy, r, 0, math.tau)
    ctx.set_source(grad)
    ctx.fill()
    # Rim
    ctx.arc(cx, cy, r, 0, math.tau)
    ctx.set_source_rgba(0.12, 0.08, 0.04, 0.75)
    ctx.set_line_width(max(1.0, r * 0.18))
    ctx.stroke()
    # Specular pinpoint
    ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.24, 0, math.tau)
    ctx.set_source_rgba(1.0, 0.98, 0.88, 0.85)
    ctx.fill()
    ctx.restore()

def draw_cogwheel(ctx, cx, cy, outer_r, inner_r, teeth=12, spokes=5, style="brass", angle=0.0):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    root_r = outer_r * 0.84
    step = math.tau / teeth

    # Outer toothed silhouette
    ctx.new_path()
    for i in range(teeth):
        a0 = i * step
        a1 = a0 + step * 0.20
        a2 = a0 + step * 0.34
        a3 = a0 + step * 0.66
        a4 = a0 + step * 0.80
        pts = [
            (math.cos(a0) * root_r, math.sin(a0) * root_r),
            (math.cos(a1) * root_r, math.sin(a1) * root_r),
            (math.cos(a2) * outer_r, math.sin(a2) * outer_r),
            (math.cos(a3) * outer_r, math.sin(a3) * outer_r),
            (math.cos(a4) * root_r, math.sin(a4) * root_r),
        ]
        if i == 0:
            ctx.move_to(*pts[0])
            for p in pts[1:]:
                ctx.line_to(*p)
        else:
            for p in pts:
                ctx.line_to(*p)
    ctx.close_path()

    # Metallic gradient
    grad = cairo.LinearGradient(-outer_r, -outer_r, outer_r, outer_r)
    if style == "brass":
        grad.add_color_stop_rgb(0.0, 0.96, 0.84, 0.46)
        grad.add_color_stop_rgb(0.32, 0.78, 0.57, 0.20)
        grad.add_color_stop_rgb(0.65, 0.92, 0.76, 0.36)
        grad.add_color_stop_rgb(1.0, 0.44, 0.28, 0.08)
    elif style == "iron":
        grad.add_color_stop_rgb(0.0, 0.56, 0.59, 0.64)
        grad.add_color_stop_rgb(0.35, 0.30, 0.32, 0.36)
        grad.add_color_stop_rgb(0.68, 0.46, 0.49, 0.54)
        grad.add_color_stop_rgb(1.0, 0.16, 0.17, 0.20)
    else:  # copper
        grad.add_color_stop_rgb(0.0, 0.94, 0.66, 0.46)
        grad.add_color_stop_rgb(0.4, 0.68, 0.36, 0.20)
        grad.add_color_stop_rgb(0.7, 0.86, 0.54, 0.34)
        grad.add_color_stop_rgb(1.0, 0.36, 0.16, 0.08)
    ctx.set_source(grad)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.10, 0.07, 0.03, 0.88)
    ctx.set_line_width(max(1.8, outer_r * 0.025))
    ctx.stroke()

    # Cutout windows between spokes (use OPERATOR_CLEAR so gear is truly transparent inside!)
    rim_r = root_r * 0.76
    hub_r = max(inner_r * 1.45, outer_r * 0.28)
    if spokes > 0 and rim_r > hub_r + 6:
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_CLEAR)
        sp_step = math.tau / spokes
        gap = sp_step * 0.22
        for s in range(spokes):
            sa = s * sp_step + gap
            ea = (s + 1) * sp_step - gap
            ctx.new_path()
            ctx.arc(0, 0, rim_r, sa, ea)
            ctx.arc_negative(0, 0, hub_r, ea, sa)
            ctx.close_path()
            ctx.fill()
        ctx.restore()

        # Inner cutout stroke borders for crisp bevel
        sp_step = math.tau / spokes
        gap = sp_step * 0.22
        for s in range(spokes):
            sa = s * sp_step + gap
            ea = (s + 1) * sp_step - gap
            ctx.new_path()
            ctx.arc(0, 0, rim_r, sa, ea)
            ctx.arc_negative(0, 0, hub_r, ea, sa)
            ctx.close_path()
            ctx.set_source_rgba(0.12, 0.08, 0.04, 0.75)
            ctx.set_line_width(max(1.4, outer_r * 0.02))
            ctx.stroke()

    # Beveled inner track ring
    ctx.arc(0, 0, root_r * 0.88, 0, math.tau)
    ctx.set_source_rgba(1.0, 0.94, 0.72, 0.42)
    ctx.set_line_width(max(1.2, outer_r * 0.018))
    ctx.stroke()

    # Hub collar & center axle hole
    ctx.arc(0, 0, hub_r, 0, math.tau)
    ctx.set_source(grad)
    ctx.fill_preserve()
    ctx.set_source_rgba(0.12, 0.08, 0.04, 0.85)
    ctx.set_line_width(max(1.5, outer_r * 0.022))
    ctx.stroke()

    # Rivets around hub
    for s in range(max(4, spokes)):
        ra = s * (math.tau / max(4, spokes))
        draw_rivet(ctx, math.cos(ra) * (hub_r * 0.68), math.sin(ra) * (hub_r * 0.68), r=max(2.5, outer_r * 0.036), style="iron" if style == "brass" else "brass")

    # Center hex nut / axle bore
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_CLEAR)
    ctx.arc(0, 0, inner_r * 0.65, 0, math.tau)
    ctx.fill()
    ctx.restore()
    ctx.arc(0, 0, inner_r * 0.65, 0, math.tau)
    ctx.set_source_rgba(0.12, 0.08, 0.04, 0.9)
    ctx.set_line_width(max(1.8, outer_r * 0.024))
    ctx.stroke()

    ctx.restore()

def draw_filigree_corner(ctx, x, y, size, flip_x=1, flip_y=1, color=(0.86, 0.68, 0.30, 0.9)):
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(flip_x, flip_y)
    ctx.set_source_rgba(*color)
    ctx.set_line_width(max(1.8, size * 0.07))
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    # L-bracket with scroll curl
    ctx.move_to(0, size * 0.85)
    ctx.line_to(0, size * 0.14)
    ctx.curve_to(0, 0, size * 0.14, 0, size * 0.85, 0)
    ctx.stroke()
    # Inner flourish scroll
    ctx.set_line_width(max(1.3, size * 0.05))
    ctx.move_to(size * 0.18, size * 0.62)
    ctx.curve_to(size * 0.18, size * 0.22, size * 0.22, size * 0.18, size * 0.62, size * 0.18)
    ctx.stroke()
    # Diamond stud
    ctx.move_to(size * 0.28, size * 0.12)
    ctx.line_to(size * 0.38, size * 0.22)
    ctx.line_to(size * 0.28, size * 0.32)
    ctx.line_to(size * 0.18, size * 0.22)
    ctx.close_path()
    ctx.fill()
    ctx.restore()

def save_png(img: Image.Image, path: str, resize_to=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if resize_to is not None:
        img = img.resize(resize_to, Image.LANCZOS)
    img.save(path, "PNG", optimize=True)
