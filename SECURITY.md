# Seguridad

Uni corre en tu propia computadora o en tu propia cuenta. Su autor no tiene un servidor y no ve tus datos.

## Reportar una vulnerabilidad

Por favor **no abras un issue público**. Usa el
[reporte privado de vulnerabilidades](https://github.com/GiamSoo23/Uni/security/advisories/new)
de GitHub e incluye cómo reproducir el problema. Uni lo mantiene una sola persona, así que la respuesta puede tardar unos días.

## Que el repo sea público no da acceso a tu app

- **El código es público, tus llaves no.** Las llaves y credenciales viven en `apps/web/.env.local` en tu máquina. `.gitignore` las excluye y gitleaks revisa todo el historial en cada pull request.
- **La app solo escucha en tu computadora.** `npm run dev` y `npm start` usan `127.0.0.1`, así que nadie en tu misma red Wi-Fi puede abrirla.
- **Los forks no reciben secretos.** GitHub Actions no entrega los secretos del repo a pull requests que vienen de forks, y los workflows no usan `pull_request_target`.

## Modelo de seguridad

| Activo                             | Dónde vive                       | Cómo se protege                                                                |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Datos de Simplify                  | `apps/web/.cache/`               | Datos públicos. Se validan con Zod y los links que no son http(s) se descartan |
| Llave de Claude (fase 4)           | `.env.local`                     | Solo la lee el servidor. Nunca llega al navegador ni a los logs                |
| Service account de Google (fase 2) | Un JSON fuera del repo           | Solo tiene acceso al Sheet que compartes con ella                              |
| Tu resume y tu Sheet               | Tu máquina y tu cuenta de Google | Nunca entran al repo                                                           |

## Antes de publicar la web en internet

Hoy la app no tiene login porque solo escucha en `127.0.0.1`. Antes de desplegarla:

- **Login obligatorio**, restringido a una lista de emails permitidos. Cada server action verifica la sesión, incluido "Sync ahora".
- **Tope de gasto en Claude:** un límite mensual en la consola de Anthropic, más un máximo de llamadas por sync dentro de la app.
- **Espera mínima entre syncs manuales**, para que nadie pueda dispararlos en bucle.

## Qué se prueba

- gitleaks revisa todo el historial de git en cada pull request y en cada push a `main`.
- Los tests de `packages/core` cubren la validación de datos externos, incluido el rechazo de links `javascript:`.
