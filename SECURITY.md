# Seguridad

Uni corre en tu propia computadora o en tu propia cuenta. Su autor no tiene un servidor y no ve tus datos.

## Reportar una vulnerabilidad

Por favor **no abras un issue público**. Usa el
[reporte privado de vulnerabilidades](https://github.com/GiamSoo23/Uni/security/advisories/new)
de GitHub e incluye cómo reproducir el problema. Uni lo mantiene una sola persona, así que la respuesta puede tardar unos días.

## Que el repo sea público no da acceso a tu app

- **El código es público, tus llaves no.** En local viven en `apps/web/.env.local`, y en Vercel en las variables de entorno del proyecto. `.gitignore` las excluye y gitleaks revisa todo el historial en cada pull request.
- **En línea, solo entra el dueño.** El deployment en Vercel usa Vercel Authentication en **todos** los deployments, incluido producción. Quien no inicie sesión con una cuenta con acceso al proyecto no llega a la app ni a "Sync ahora". Ver [docs/DEPLOY.md](docs/DEPLOY.md).
- **En local, solo tu computadora.** `npm run dev` y `npm start` usan `127.0.0.1`, así que nadie en tu misma red Wi-Fi puede abrirla.
- **Los forks no reciben secretos.** GitHub Actions no entrega los secretos del repo a pull requests que vienen de forks, y los workflows no usan `pull_request_target`.

## Modelo de seguridad

| Activo                         | Dónde vive                                 | Cómo se protege                                                                |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| Datos de Simplify              | `apps/web/.cache/` o `/tmp` en Vercel      | Datos públicos. Se validan con Zod y los links que no son http(s) se descartan |
| La app en línea                | Vercel                                     | Vercel Authentication en todos los deployments                                 |
| Llave de Claude (M5)           | `.env.local` o variables de entorno Vercel | Solo la lee el servidor. Nunca llega al navegador ni a los logs                |
| Service account de Google (M3) | Variables de entorno, nunca un archivo     | Solo tiene acceso al Sheet que compartes con ella                              |
| Tu resume y tu Sheet           | Tu máquina y tu cuenta de Google           | Nunca entran al repo                                                           |

## Antes de gastar dinero (M6)

- **Tope de gasto en Claude:** un límite mensual en la consola de Anthropic, más un máximo de llamadas por sync dentro de la app.
- **Espera mínima entre syncs manuales**, como segunda barrera detrás del login.
- Si la app llega a tener más de un usuario, hará falta un login propio con lista de emails permitidos, verificado en cada server action.

## Qué se prueba

- gitleaks revisa todo el historial de git en cada pull request y en cada push a `main`.
- Los tests de `packages/core` cubren la validación de datos externos, incluido el rechazo de links `javascript:`.
