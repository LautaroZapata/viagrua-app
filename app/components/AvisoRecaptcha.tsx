/**
 * Aviso legal de reCAPTCHA.
 *
 * No es decorativo: los terminos de Google permiten esconder el badge flotante
 * solo si en su lugar aparece esta leyenda con los dos links. Se esconde porque
 * el badge es un recuadro fijo en la esquina que se monta encima del formulario
 * en pantallas de celular, que es donde esta app se usa. El CSS que lo oculta
 * esta en globals.css, buscar .grecaptcha-badge.
 *
 * Si no hay site key configurada, reCAPTCHA no corre y el aviso no va.
 */
export function AvisoRecaptcha({ className = '' }: { className?: string }) {
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return null

  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      Protegido por reCAPTCHA. Aplican la{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground transition-colors"
      >
        Política de Privacidad
      </a>{' '}
      y los{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground transition-colors"
      >
        Términos del Servicio
      </a>{' '}
      de Google.
    </p>
  )
}
