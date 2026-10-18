// Adapted from Herald OS, MIT; see LICENSE.
import type { WallpaperTint } from './theme';
const RIBBONS = Array.from({ length: 11 }, (_, i) => ({
  y: 0.12 + (i / 11) * 0.8,
  amp: 0.07 + (i % 3) * 0.04,
  freq: 0.9 + (i % 4) * 0.3,
  speed: 0.1 + (i % 5) * 0.03,
  width: 26 + (i % 3) * 30,
  hue: 214 + (i % 4) * 5,
  light: 52 + (i % 3) * 9,
  alpha: 0.3 + (i % 2) * 0.16,
  phase: i * 1.7
}))

const OCEAN_STOPS: WallpaperTint['stops'] = ['#1240c8', '#0a2a96', '#04113f']
const OCEAN_HUE = 214

/** The drawn wallpaper's tint for the current theme (null keeps the ocean blues). */


/**
 * Draw one frame of the wallpaper at phase `t` onto `ctx`, covering `width` x `height` canvas pixels.
 * `scale` is canvas pixels per CSS pixel (the animated component renders at 0.5); ribbon widths are
 * expressed in CSS pixels so the picture looks the same at any resolution. `tint` recolours it for
 * the theme; light themes draw darker ribbons over the field instead of adding light. Pure: no DOM,
 * no state.
 */
export function drawWallpaperFrame(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, scale = 1, tint: WallpaperTint | null = null): void {
  const w = width
  const h = height
  const stops = tint?.stops ?? OCEAN_STOPS
  const light = tint?.light ?? false
  const hueShift = tint ? tint.hue - OCEAN_HUE : 0
  const sat = tint ? Math.round(tint.saturation * 95) : 95
  const satHigh = Math.min(100, sat + 5)

  const base = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.8)
  base.addColorStop(0, stops[0])
  base.addColorStop(0.45, stops[1])
  base.addColorStop(1, stops[2])
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'

  const tracePath = (r: (typeof RIBBONS)[number]) => {
    ctx.beginPath()
    const steps = 56

    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * w
      const nx = (s / steps) * r.freq * Math.PI * 2
      const y =
        h * r.y +
        Math.sin(nx + t * r.speed + r.phase) * h * r.amp +
        Math.sin(nx * 0.5 - t * r.speed * 0.7 + r.phase * 2) * h * r.amp * 0.6 +
        Math.cos(nx * 1.7 + t * r.speed * 0.4) * h * 0.012

      if (s === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
  }

  for (const r of RIBBONS) {
    const hue = r.hue + hueShift
    const l = light ? r.light - 22 : r.light
    const alpha = light ? r.alpha * 0.4 : r.alpha

    // Wide soft body.
    tracePath(r)
    const glow = ctx.createLinearGradient(0, 0, w, 0)
    glow.addColorStop(0, `hsla(${hue}, ${sat}%, ${l}%, 0)`)
    glow.addColorStop(0.3, `hsla(${hue}, ${sat}%, ${l + 10}%, ${alpha * 0.5})`)
    glow.addColorStop(0.7, `hsla(${hue + 6}, ${sat}%, ${l + 16}%, ${alpha * 0.45})`)
    glow.addColorStop(1, `hsla(${hue}, ${sat}%, ${l}%, 0)`)
    ctx.strokeStyle = glow
    ctx.lineWidth = r.width * scale * 2.2 * (1 + 0.15 * Math.sin(t * 0.3 + r.phase))
    ctx.stroke()

    // Bright silk highlight.
    tracePath(r)
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, `hsla(${hue}, ${satHigh}%, ${l + 10}%, 0)`)
    grad.addColorStop(0.35, `hsla(${hue}, ${satHigh}%, ${l + 26}%, ${alpha})`)
    grad.addColorStop(0.62, `hsla(${hue + 8}, ${satHigh}%, ${l + 34}%, ${alpha * 1.1})`)
    grad.addColorStop(1, `hsla(${hue}, ${satHigh}%, ${l + 10}%, 0)`)
    ctx.strokeStyle = grad
    ctx.lineWidth = r.width * scale * 0.55 * (1 + 0.2 * Math.sin(t * 0.3 + r.phase))
    ctx.stroke()
  }

  ctx.globalCompositeOperation = 'source-over'
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.max(w, h) * 0.85)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, tint?.vignette ?? 'rgba(0,4,30,0.4)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

/**
 * A local wallpaper (a path or file:// URL) as a data: URL read through main. Pages served over
 * http (the dev server) cannot load local files, and a bare path would resolve against the page.
 */
