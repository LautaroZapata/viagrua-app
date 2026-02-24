"use client";
import { useState } from "react";

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
  const [plan, setPlan] = useState("mensual");

  const handlePagar = async () => {
    // Aquí deberías implementar la lógica real de pago o mostrar un mensaje
    alert('Funcionalidad de pago implementada en el flujo real.');
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
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
      <button
        className="btn-primary w-full py-3 text-lg"
        onClick={handlePagar}
      >
        Ir al pago
      </button>
    </div>
  );
}
