# Deploy privado en Vercel

Uni corre en Vercel (plan Hobby, gratis) y solo la puede abrir el dueño del proyecto. La protección la da **Vercel Authentication**: quien no inicie sesión con una cuenta de Vercel que tenga acceso al proyecto ve una pantalla de login y nunca llega a la app, ni a "Sync ahora".

Desde septiembre de 2026, Vercel Authentication protege todos los deployments, incluido el de producción, sin costo en cualquier plan ([changelog](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)).

## Pasos (una sola vez)

1. Entra a [vercel.com/signup](https://vercel.com/signup) con **Continue with GitHub**, usando la cuenta dueña del repo.
2. **Add New… → Project** e importa `GiamSoo23/Uni`. Si no aparece, dale acceso a la GitHub App de Vercel sobre ese repo.
3. En la configuración del import:
   - **Root Directory:** `apps/web`. Vercel detecta Next.js y los npm workspaces, así que instala desde la raíz y `@uni/core` queda disponible.
   - No hace falta ninguna variable de entorno. `UNI_SYNC_MAX_AGE_HOURS` es opcional (por defecto 168, una semana).
4. **Deploy.**
5. **Antes de compartir la URL con nadie:** en el proyecto, **Settings → Deployment Protection → Vercel Authentication**, activa y elige **All Deployments**. Guarda.
6. Comprueba en una ventana privada que la URL de producción pide login.

## Cómo funciona en Vercel

- Cada push a `main` despliega producción, y cada PR crea un deployment de preview, también protegido.
- La copia de `listings.json` vive en `/tmp/uni-cache`, porque es la única carpeta con permiso de escritura. Se pierde cuando Vercel recicla la instancia, y la siguiente visita la vuelve a descargar (~13 MB, unos segundos).
- "Sync ahora" refresca la instancia que atiende la petición. Si Vercel tiene varias instancias activas, otra puede mostrar la copia anterior hasta su propio refresco.

## Qué no cubre esta protección

- **El código** sigue siendo público en GitHub. Eso no da acceso a la app ni a sus variables de entorno.
- **Llaves de Claude y Google** (fases siguientes): van en **Settings → Environment Variables** de Vercel, nunca en el repo.
- Si algún día la app tiene más usuarios, hará falta un login propio con lista de emails permitidos. Para un solo usuario, Vercel Authentication basta.
