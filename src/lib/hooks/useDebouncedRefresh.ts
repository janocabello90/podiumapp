import { useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// Programa un router.refresh() con retardo: agrupa varios guardados seguidos (p. ej. notas por
// prueba al ir rellenándolas) en UN solo refresco. Así los datos guardados quedan reflejados en
// el árbol del servidor (y al volver a entrar en la página se ven, sin recargar a mano), pero sin
// re-consultar el servidor en cada pulsación.
export function useDebouncedRefresh(delay = 1500) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.refresh(), delay)
  }, [router, delay])
}
