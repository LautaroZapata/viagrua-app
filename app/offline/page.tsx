'use client'

export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="text-center max-w-sm mx-auto animate-fadeInUp">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <svg
                        className="w-10 h-10 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-2">Sin conexion</h1>
                <p className="text-muted-foreground text-sm mb-8">
                    No hay acceso a internet. Revisa tu conexion y volve a intentarlo.
                </p>

                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center h-11 px-8 rounded-[10px] bg-primary text-primary-foreground font-medium text-sm shadow-[0_4px_14px_rgba(255,122,0,0.25)] hover:bg-primary/90 transition"
                >
                    Reintentar
                </button>
            </div>
        </div>
    )
}
