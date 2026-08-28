import { useMemo } from 'react'
import { View, Image, StyleSheet } from 'react-native'
import Svg, { Rect, G } from 'react-native-svg'
import * as QRCodeLib from 'qrcode'

interface Props {
  value: string
  size: number
  dotColor?: string
  finderColor?: string
  backgroundColor?: string
  logoUrl?: string
  logoSize?: number
}

const QUIET = 1  // quiet-zone modules on each side

function isFinderZone(r: number, c: number, n: number): boolean {
  return (
    (r < 7 && c < 7) ||          // top-left
    (r < 7 && c >= n - 7) ||     // top-right
    (r >= n - 7 && c < 7)        // bottom-left
  )
}

export function StyledQRCode({
  value,
  size,
  dotColor        = '#111111',
  finderColor     = '#14B946',
  backgroundColor = '#FFFFFF',
  logoUrl,
  logoSize,
}: Props) {
  const logoSizePx = logoSize ?? size * 0.18
  const ecl = logoUrl ? 'H' : 'M'   // high error correction when logo covers center
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeLib.create(value, { errorCorrectionLevel: ecl })
      return { data: qr.modules.data, n: qr.modules.size }
    } catch {
      return null
    }
  }, [value, ecl])

  if (!matrix) return null

  const { data, n } = matrix
  const m = size / (n + QUIET * 2)   // pixels per module
  const q = QUIET * m                 // quiet-zone offset in pixels
  const pad = m * 0.12               // gap between neighbouring dots

  // Three finder-pattern anchor corners
  const finderAnchors = [
    { r: 0,     c: 0     },   // top-left
    { r: 0,     c: n - 7 },   // top-right
    { r: n - 7, c: 0     },   // bottom-left
  ]

  const logoPad    = logoSizePx * 0.18            // white padding around logo
  const logoBoxSz  = logoSizePx + logoPad * 2     // total white box size
  const logoOffset = (size - logoBoxSz) / 2        // center offset

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* White background */}
        <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />

        {/* ── Data modules (skip finder zones) ── */}
        {Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (_, c) => {
            if (!data[r * n + c]) return null
            if (isFinderZone(r, c, n)) return null
            const x = q + c * m
            const y = q + r * m
            return (
              <Rect
                key={`d-${r}-${c}`}
                x={x + pad}
                y={y + pad}
                width={m - pad * 2}
                height={m - pad * 2}
                rx={m * 0.25}
                fill={dotColor}
              />
            )
          })
        )}

        {/* ── Finder patterns — green rounded squares ── */}
        {finderAnchors.map(({ r, c }) => {
          const x  = q + c * m
          const y  = q + r * m
          const fp = 7 * m

          return (
            <G key={`f-${r}-${c}`}>
              <Rect x={x} y={y} width={fp} height={fp} rx={m * 1.6} fill={finderColor} />
              <Rect x={x + m} y={y + m} width={5 * m} height={5 * m} rx={m * 0.9} fill={backgroundColor} />
              <Rect x={x + 2 * m} y={y + 2 * m} width={3 * m} height={3 * m} rx={m * 0.6} fill={finderColor} />
            </G>
          )
        })}

        {/* White box behind logo */}
        {logoUrl && (
          <Rect
            x={logoOffset}
            y={logoOffset}
            width={logoBoxSz}
            height={logoBoxSz}
            rx={logoBoxSz * 0.22}
            fill={backgroundColor}
          />
        )}
      </Svg>

      {/* Logo image overlaid on center */}
      {logoUrl && (
        <Image
          source={{ uri: logoUrl }}
          style={[
            StyleSheet.absoluteFill,
            {
              top:    logoOffset + logoPad,
              left:   logoOffset + logoPad,
              width:  logoSizePx,
              height: logoSizePx,
              borderRadius: logoSizePx * 0.18,
              position: 'absolute',
            },
          ]}
          resizeMode="contain"
        />
      )}
    </View>
  )
}
