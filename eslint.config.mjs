import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Defaults de eslint-config-next
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    // components/ui/** y hooks/use-mobile.ts son generados por el CLI de shadcn.
    // No los mantenemos a mano: divergir del upstream complica cada `shadcn add`
    // y las violaciones son de su boilerplate, no de codigo nuestro.
    files: ["components/ui/**", "hooks/use-mobile.ts"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },

  {
    // El prefijo _ ya se usa en el repo para marcar un argumento a proposito
    // sin usar (por ejemplo en los mocks de los tests).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: ["app/**", "lib/**"],
    rules: {
      // Desaconseja "fetch en useEffect + setState". Tiene razon, pero la
      // solucion no es un parche por archivo: es mover esas paginas a SWR o a
      // Server Components (Fase 2.3/2.4 del plan de endurecimiento). Queda como
      // warning para que el trabajo pendiente siga a la vista en vez de
      // silenciarse.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
