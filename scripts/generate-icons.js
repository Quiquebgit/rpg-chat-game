/**
 * Genera iconos PWA (192x192 y 512x512) desde favicon.svg.
 * Uso: node scripts/generate-icons.js
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const svgBuffer = readFileSync(resolve(root, 'public/favicon.svg'))

// El SVG original es 48x46 — lo renderizamos sobre fondo oscuro para PWA
const sizes = [192, 512]

for (const size of sizes) {
  // Padding: 20% para zona segura maskable
  const iconSize = Math.round(size * 0.7)
  const padding = Math.round((size - iconSize) / 2)

  // Redimensionar SVG al tamaño del icono
  const icon = await sharp(svgBuffer, { density: 300 })
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // Componer sobre fondo oscuro redondeado (para maskable)
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 15, g: 10, b: 30, alpha: 255 }, // #0f0a1e — tono oscuro del tema
    },
  })
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(resolve(root, `public/icons/icon-${size}.png`))

  console.log(`✓ icon-${size}.png generado`)
}
