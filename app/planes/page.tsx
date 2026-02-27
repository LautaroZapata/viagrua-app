"use client";
import { useState, useRef } from "react";
// @ts-ignore
import ReCAPTCHA from "react-google-recaptcha";
import PlanesNavBar from "./PlanesNavBar";

const PLANES = [
  {
    id: "mensual",
    nombre: "Plan Mensual",
    precio: 10,
    descripcion: "Acceso completo por 1 mes",
    beneficios: [
      "Gestión de traslados ilimitada",
      "Soporte prioritario",
      "Actualizaciones automáticas"
    ]
  },
  {
    id: "anual",
    nombre: "Plan Anual",
    precio: 20,
    descripcion: "Acceso completo por 1 año (2 meses bonificados)",
    beneficios: [
      "Gestión de traslados ilimitada",
      "Soporte prioritario",
      "Actualizaciones automáticas",
      "2 meses gratis"
    ]
  }
];


export default function SeleccionaPlan() {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [plan, setPlan] = useState("mensual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaValid, setCaptchaValid] = useState(false);

  const handlePagar = async () => {
    setLoading(true);
    setError(null);
    let recaptchaToken = null;
    const recaptchaAction = 'checkout';
    if (recaptchaRef.current) {
      recaptchaToken = await recaptchaRef.current.executeAsync({ action: recaptchaAction });
      if (!recaptchaToken) {
        setError('No se pudo validar el reCAPTCHA.');
        setLoading(false);
        return;
      }
      setCaptchaValid(true);
    }
    try {
      // Obtener email del usuario (ajustar según tu auth)
      const email = window.localStorage.getItem('email');
      const userId = window.localStorage.getItem('user_id');
      if (!email || !userId) {
        setError('No se encontró el email o user_id del usuario.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email, user_id: userId, recaptchaToken, recaptchaAction })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear preferencia de pago');
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError('No se pudo obtener el enlace de pago.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
      if (recaptchaRef.current) recaptchaRef.current.reset();
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <PlanesNavBar />
      <div className="p-6 bg-white rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-6 text-center">Elegí tu plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {PLANES.map(p => (
            <div key={p.id} className={`border rounded-lg p-5 ${plan === p.id ? 'border-blue-500' : 'border-gray-200'}`}
                 onClick={() => setPlan(p.id)}
                 style={{ cursor: 'pointer' }}>
              <h3 className="text-lg font-semibold mb-2">{p.nombre}</h3>
              <p className="text-2xl font-bold text-blue-600 mb-2">${p.precio}</p>
              <p className="text-gray-500 mb-2">{p.descripcion}</p>
              <ul className="text-sm text-gray-700 list-disc pl-5 mb-2">
                {p.beneficios.map(b => <li key={b}>{b}</li>)}
              </ul>
              {plan === p.id && <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Seleccionado</span>}
            </div>
          ))}
        </div>
        {/* Reemplaza el sitekey por tu clave real de reCAPTCHA v2 invisible. Puedes usar process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY si lo configuras en Vercel o .env.local */}
        <ReCAPTCHA
          sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "TU_SITE_KEY_RECAPTCHA"}
          size="invisible"
          ref={recaptchaRef}
        />
        <button
          className="btn-primary w-full py-3 text-lg disabled:opacity-60"
          onClick={handlePagar}
          disabled={loading}
        >
          {loading ? 'Redirigiendo...' : 'Ir al pago'}
        </button>
        {error && <div className="mt-4 text-red-600 text-center">{error}</div>}
      </div>
    </div>
  );
}
