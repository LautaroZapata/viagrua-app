import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
                    borderRadius: '40px',
                }}
            >
                <div
                    style={{
                        color: 'white',
                        fontSize: 72,
                        fontWeight: 700,
                        letterSpacing: '-0.04em',
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    VG
                </div>
            </div>
        ),
        size,
    )
}
