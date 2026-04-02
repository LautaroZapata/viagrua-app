import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
                    borderRadius: '6px',
                }}
            >
                <div
                    style={{
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
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
