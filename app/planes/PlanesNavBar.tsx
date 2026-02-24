"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PlanesNavBar() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Simula obtener el usuario desde localStorage (ajusta según tu auth real)
    const email = window.localStorage.getItem("email");
    if (email) setUser({ email });
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem("email");
    setUser(null);
    router.push("/login");
  };

  return (
    <nav className="w-full flex items-center justify-between px-4 py-3 bg-blue-700 text-white mb-8 rounded-xl shadow">
      <div className="font-bold text-lg">ViaGrua</div>
      {user ? (
        <div className="flex items-center gap-4">
          <span className="text-sm bg-blue-900/60 px-3 py-1 rounded-lg">{user.email}</span>
          <button
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-semibold transition"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      ) : (
        <button
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-semibold transition"
          onClick={() => router.push("/login")}
        >
          Iniciar sesión
        </button>
      )}
    </nav>
  );
}
