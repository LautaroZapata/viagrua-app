import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSize = parseInt(searchParams.get('size') || '192', 10)
    const isMaskable = searchParams.get('maskable') === '1'

    // Only allow defined sizes
    const size = [96, 192, 512].includes(rawSize) ? rawSize : 192

    // Maskable icons need extra padding so content stays inside the safe zone
    // (circle inscribed in the square, ~80% of icon size)
    const padding = isMaskable ? Math.round(size * 0.12) : 0
    const fontSize = Math.round((size - padding * 2) * 0.38)
    const borderRadius = isMaskable ? 0 : Math.round(size * 0.2)

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(135deg, #FF8C42 0%, #FF7A00 100%)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius,
                }}
            >
                {/* Inner rounded container with slight padding */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: padding,
                    }}
                >
                    <div
                        style={{
                            color: 'white',
                            fontSize,
                            fontWeight: 700,
                            letterSpacing: '-0.04em',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            lineHeight: 1,
                        }}
                    >
                        VG
                    </div>
                </div>
            </div>
        ),
        {
            width: size,
            height: size,
        },
    )
}
