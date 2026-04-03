export default function GastosLoading() {
    return (
        <div className="page-bg min-h-screen">
            {/* Navbar skeleton */}
            <nav className="navbar sticky top-0 z-50">
                <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg skeleton" />
                        <div className="w-24 h-5 rounded skeleton" />
                    </div>
                </div>
            </nav>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto animate-fadeIn">
                {/* Summary cards skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card p-4">
                            <div className="w-16 h-3 rounded skeleton mb-2" />
                            <div className="w-24 h-7 rounded skeleton" />
                        </div>
                    ))}
                </div>

                {/* Form skeleton */}
                <div className="card p-4 sm:p-6 mb-6">
                    <div className="w-32 h-5 rounded skeleton mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="h-11 rounded-xl skeleton" />
                        <div className="h-11 rounded-xl skeleton" />
                        <div className="h-11 rounded-xl skeleton" />
                        <div className="h-11 rounded-xl skeleton" />
                    </div>
                </div>

                {/* List skeleton */}
                <div className="card p-4 sm:p-6">
                    <div className="w-40 h-5 rounded skeleton mb-4" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                                <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                                <div className="flex-1">
                                    <div className="w-28 h-4 rounded skeleton mb-2" />
                                    <div className="w-20 h-3 rounded skeleton" />
                                </div>
                                <div className="w-16 h-5 rounded skeleton" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
