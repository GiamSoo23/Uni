# Changelog

Los cambios importantes de Uni. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

- Bandeja web con los roles abiertos del repo de Simplify, con link directo para aplicar.
- Filtros por temporada, categoría, región, fecha de publicación, texto y elegibilidad.
- Sincronización semanal con caché local y ETag, y botón "Sync ahora".
- Si GitHub falla, la app sigue mostrando la última copia buena.

- Deploy en Vercel: la caché usa `/tmp` y Node queda fijado en 24.x. Guía en `docs/DEPLOY.md`.

### Seguridad

- En línea, Vercel Authentication protege todos los deployments: solo entra el dueño.
- En local, la app solo escucha en `127.0.0.1`.
- gitleaks revisa todo el historial en cada pull request.
