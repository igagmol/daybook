# Daybook

Daybook es una app personal para el iPhone: lista de la compra, comidas de la semana, dinero (quién debe a quién), eventos, tareas y una nota. Funciona sin conexión y, cuando inicias sesión con Google, guarda una copia de tus datos en tu propio Google Drive.

**Dirección de la app:** https://igagmol.github.io/daybook/

---

## 1. Instalarla en el iPhone

1. Abre **Safari** en el iPhone (tiene que ser Safari).
2. Escribe la dirección `https://igagmol.github.io/daybook/` y espera a que cargue.
3. Pulsa el botón **Compartir** (el cuadrado con una flecha hacia arriba, abajo en el centro).
4. Desliza hacia abajo y pulsa **Añadir a pantalla de inicio**.
5. Comprueba que el nombre es **Daybook** y pulsa **Añadir** (arriba a la derecha).
6. A partir de ahora abre Daybook desde su icono, no desde Safari.

## 2. Compartirla con un amigo

1. Envíale la dirección `https://igagmol.github.io/daybook/`.
2. Tu amigo la instala igual que en el punto 1.
3. Al abrirla pulsa **Sign in with Google** y entra con **su propia** cuenta de Google.
4. Tendrá sus propios datos, totalmente separados de los tuyos, y en **su** Google Drive aparecerá su propia carpeta **Daily App**. Nadie ve los datos de nadie.

> Mientras el "client ID" de Google no esté puesto (ver punto 4), la app funciona en modo **perfil local**: sin inicio de sesión y con los datos solo en ese teléfono.

## 3. Cómo se actualiza la app

- Cuando hay una versión nueva, al abrir la app aparece abajo el aviso **Update available** con el botón **Reload**. Púlsalo y listo.
- También puedes forzarlo: pulsa el icono de persona (abajo en el centro) → **Check for updates**.
- Para los cambios en el código: cada vez que se cambian archivos de la app se ejecuta `node scripts/bump-version.mjs` (sube el número de versión en `config.js` y `sw.js`) y se hace push a `main`. GitHub Pages publica solo en 1–2 minutos.
- Si alguna vez la app se quedara "atascada" en una versión vieja: cierra la app (desliza hacia arriba desde abajo y quítala), y vuelve a abrirla.

## 4. Conseguir el "client ID" de Google (una sola vez)

Esto permite el botón **Sign in with Google** y la copia en Google Drive. Tardas unos 10 minutos. Hazlo en un ordenador.

### 4.1 Crear el proyecto

1. Entra en https://console.cloud.google.com/ con tu cuenta de Google. Si te pide aceptar condiciones, marca la casilla y pulsa **Aceptar y continuar**.
2. Arriba a la izquierda, junto al logo de Google Cloud, pulsa el **selector de proyecto** (pone "Selecciona un proyecto" o el nombre de otro proyecto).
3. En la ventana que se abre pulsa **Proyecto nuevo** (arriba a la derecha).
4. En **Nombre del proyecto** escribe `Daybook`. Deja "Ubicación" como está y pulsa **Crear**.
5. Espera unos segundos. Vuelve a pulsar el selector de proyecto y elige **Daybook** para que quede seleccionado.

### 4.2 Activar la API de Google Drive

1. Pulsa el menú **☰** (arriba a la izquierda) → **APIs y servicios** → **Biblioteca**.
2. En el buscador escribe `Google Drive API` y pulsa Intro.
3. Pulsa el resultado **Google Drive API**.
4. Pulsa el botón azul **Habilitar**.

### 4.3 Configurar la pantalla de consentimiento (lo que ve la gente al iniciar sesión)

1. Menú **☰** → **APIs y servicios** → **Pantalla de consentimiento de OAuth** (en algunas cuentas se llama **Google Auth Platform**).
2. Pulsa **Comenzar** (o **Get started**).
3. **Información de la aplicación**: en **Nombre de la aplicación** escribe `Daybook`; en **Correo electrónico de asistencia al usuario** elige tu correo. Pulsa **Siguiente**.
4. **Público**: elige **Externo**. Pulsa **Siguiente**.
5. **Información de contacto**: escribe tu correo. Pulsa **Siguiente**.
6. Marca la casilla de aceptar la política de datos de usuario y pulsa **Continuar** y luego **Crear**.

### 4.4 Añadir los permisos (scopes)

1. En el menú de la izquierda pulsa **Acceso a los datos** (o **Data Access**).
2. Pulsa **Añadir o quitar permisos** (o **Add or remove scopes**).
3. En la lista marca estas tres casillas:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
4. Más abajo, en el cuadro **Añadir permisos manualmente**, pega esto:
   `https://www.googleapis.com/auth/drive.file`
   y pulsa **Añadir a la tabla**.
5. Pulsa **Actualizar** (abajo del panel) y después **Guardar**.

### 4.5 Crear el client ID

1. En el menú de la izquierda pulsa **Clientes** (o **Clients**). Si no lo ves: menú **☰** → **APIs y servicios** → **Credenciales** → **+ Crear credenciales** → **ID de cliente de OAuth**.
2. Pulsa **+ Crear cliente**.
3. En **Tipo de aplicación** elige **Aplicación web**.
4. En **Nombre** escribe `Daybook web`.
5. En **Orígenes autorizados de JavaScript** pulsa **+ Añadir URI** y escribe exactamente:
   `https://igagmol.github.io`
   (solo eso: sin `/daybook` y sin barra al final).
6. En **URIs de redirección autorizados** pulsa **+ Añadir URI** y escribe exactamente:
   `https://igagmol.github.io/daybook/`
   (con la barra final). Sirve para el plan B de inicio de sesión en el iPhone, ver el punto 7.
7. Pulsa **Crear**.
8. Aparece una ventana con el **ID de cliente** (algo como `123456789-abc...apps.googleusercontent.com`). Pulsa el icono de copiar a su lado.
9. **Pégalo en el chat de Claude.** No hace falta el "secreto de cliente": no lo pegues en ningún sitio.

### 4.6 ¿Hay que pasar la app de "Prueba" a "En producción"?

**Sí, si quieres que tus amigos puedan entrar sin añadirlos uno a uno.** Lo he comprobado en la documentación actual de Google (noviembre de 2026):

- En estado **Prueba** (Testing) solo pueden iniciar sesión las cuentas que añadas como **usuarios de prueba** (máximo 100), y su permiso **caduca a los 7 días**: tendrían que volver a pulsar "Reconnect" cada semana. La excepción de Google para apps que solo piden nombre y correo no aplica aquí, porque también pedimos `drive.file`.
- En estado **En producción** puede entrar cualquier cuenta de Google.
- `drive.file` es un permiso **no sensible** (Google lo recomienda precisamente porque la app solo ve los archivos que ella misma crea). Con permisos no sensibles no hace falta pasar la verificación de Google ni aparece la pantalla de "app no verificada". Lo único: hasta que no verifiques la "marca", en la pantalla de Google puede verse el dominio (`igagmol.github.io`) en lugar del nombre "Daybook". Es normal y no impide nada.

Cómo pasarla a producción:

1. Menú **☰** → **APIs y servicios** → **Pantalla de consentimiento de OAuth** (o **Google Auth Platform**) → **Público** (o **Audience**).
2. En **Estado de publicación** pulsa **Publicar aplicación** (o **Publish app**).
3. Pulsa **Confirmar**.

Si prefieres dejarla en Prueba: en esa misma página, en **Usuarios de prueba**, pulsa **+ Add users**, escribe el Gmail de cada amigo y pulsa **Guardar**.

## 5. Tus datos

- Los datos se guardan primero en el propio teléfono, así que la app abre al instante y funciona sin conexión.
- Con sesión iniciada, se copian a tu Google Drive en la carpeta **Daily App**, archivo `daily-app-data.json`. Se sincroniza al abrir la app, al volver a ella, unos 3 segundos después de cada cambio y con el botón **Sync now**.
- La app solo puede ver los archivos que ella misma crea en tu Drive (permiso `drive.file`), nada más.
- Si borras la carpeta o el archivo en Drive, la app los vuelve a crear con lo que hay en el teléfono. Nunca se pierden datos por eso.
- Casi nada se borra solo. Solo se borra lo que tú borras (deslizando a la izquierda, "Clear all", completando una tarea o borrando una receta). La única excepción son los **eventos pasados**: al día siguiente de su fecha se borran automáticamente.
- **Copia de seguridad manual:** icono de persona → **Export backup** (copia todo al portapapeles; guárdalo en Notas, por ejemplo). Para recuperarla: **Import backup**, pega el texto y confirma. Importar nunca borra nada, solo añade.
- **Sign out** no borra nada: los datos se quedan en el teléfono y vuelven al entrar de nuevo con la misma cuenta.

## 6. Recetas, compra automática y aviso de eventos

### Recetas con ingredientes
1. En **Meals** pulsa **Manage recipes** y luego el **+** (o elige **New recipe** al añadir una comida).
2. Escribe el **nombre** de la receta.
3. Debajo, en **Add an ingredient**, escribe un ingrediente y pulsa **Intro** o el **+**. Mientras escribes aparecen como sugerencia todos los ingredientes que ya has usado en otras recetas: pulsa uno para añadirlo.
4. Para quitar un ingrediente de la receta pulsa la **✕** a su derecha. Pulsa **Save**.

Todos los ingredientes forman un catálogo común (para las sugerencias). Puedes verlo en **Manage recipes** → **Ingredients**; deslizando a la izquierda quitas una sugerencia (por ejemplo, una errata), pero las recetas que ya la usan la conservan.

**Recetas antiguas:** el texto de notas de cada receta se ha convertido en ingredientes automáticamente, **un ingrediente por cada línea** (se quitan guiones, números de lista y el punto final).

### Mandar ingredientes a la compra
1. En **Meals** elige el día y pulsa la receta planificada (o añádela: al elegirla se abre sola).
2. Aparecen sus ingredientes, cada uno con un **interruptor con un carrito**.
3. Activa el carrito en los que tienes que comprar: aparecen en **Shopping** al instante. Si lo desactivas, se quitan.
4. Si el mismo ingrediente viene de varias comidas, en **Shopping** sale una sola vez con **×2**, **×3**…
5. Cuando lo compras y lo borras de **Shopping**, el interruptor de esa comida vuelve a apagarse. Si quitas la comida del día (o borras la receta), sus ingredientes también salen de la compra.

### Punto en Eventos
En la pantalla principal, el botón **Events** muestra:
- un **punto rojo** si hay un evento **hoy**;
- un **punto amarillo** si hay un evento **mañana o pasado mañana**;
- nada en otro caso. El rojo tiene prioridad. Si borras el evento, el punto se actualiza al momento.

## 7. Inicio de sesión dentro de la app del iPhone (lo que he averiguado)

- La app usa primero la ventana emergente oficial de Google (Google Identity Services).
- En apps añadidas a la pantalla de inicio de iOS, las ventanas emergentes a veces fallan o se quedan en blanco. Por eso he añadido un **plan B**: si la ventana no se abre, o se cierra sin devolver la sesión dentro de la app instalada, la app abre la página de Google en la propia app y vuelve a Daybook al terminar (flujo "redirect" de OAuth 2.0 para aplicaciones web del lado del cliente). Google lo sigue documentando (página actualizada en octubre de 2026), aunque lo marca como "legado" y recomienda su librería nueva. Para que funcione hace falta la **URI de redirección** del paso 4.5.6.
- El permiso de Google dura 1 hora y no se guarda en el teléfono. Al abrir la app se intenta renovar en silencio; en el iPhone eso normalmente no es posible sin que pulses algo, así que verás **Sync paused** en la hoja de cuenta y el botón **Reconnect**. Tus datos siguen funcionando igual mientras tanto, y los cambios se suben al pulsar **Reconnect**.
- Esto **solo se puede probar en tu iPhone real**. Si al iniciar sesión ves algo raro, descríbelo en el chat y lo arreglo.

## 8. Para desarrolladores

- Sin frameworks ni paso de compilación: HTML + CSS + JavaScript (módulos ES). Se sirve tal cual desde la raíz de la rama `main`.
- `config.js`: versión y `GOOGLE_CLIENT_ID`.
- `js/merge.js`: lógica de fusión (pura, con tests). `js/sync.js`: Google Drive. `js/auth.js`: inicio de sesión. `js/store.js`: localStorage.
- Tests unitarios: `npm test` (usa `node --test`, sin dependencias).
- Tests de interfaz: `npm run test:ui` (Playwright con emulación de iPhone; usa WebKit si está instalado, si no Chromium). Las capturas quedan en `tests/e2e/screenshots/`.
- Iconos: el original está en `icons-src/icon.svg`; los PNG se generan con `npm run icons` (usa `@resvg/resvg-js`).
- Antes de cada push que cambie la app: `node scripts/bump-version.mjs`.

## 9. Assumptions (suposiciones que he tomado)

Donde la especificación no decía nada, elegí lo más simple:

1. **Fondo de tarjetas, filas y hojas en blanco** (`#FFFFFF`, el mismo blanco del texto de los botones principales), sobre el fondo azul 50. Las sombras usan el azul 900 con transparencia.
2. **Botón de Google**: usa los colores oficiales de Google (blanco, borde gris `#747775`, texto `#1F1F1F` y el logo G a color), porque lo exigen sus normas de marca. Es la única excepción a la paleta, aparte del dinero. No se usa la fuente Roboto porque no se permiten fuentes externas.
3. **Cada panel tiene título** (el nombre de la sección) junto al botón de volver.
4. **Tareas:** la fecha límite viene rellenada con la fecha de hoy y la prioridad con **3**; ambas se pueden cambiar. Las tareas no se borran deslizando, solo completándolas (la especificación de Tareas no menciona deslizar).
5. **Dinero:** importe, concepto y la elección "They owe me / I owe" son obligatorios. Se acepta coma o punto decimal. Formato `€12.50`. Tras añadir una entrada, la hoja se cierra (solo en Compra se queda abierta).
6. **Eventos:** el "+" de abajo pone por defecto la fecha de hoy; el "+" de la hoja de un día pone ese día. Los eventos sin hora van primero en su día. En el calendario, los días de otros meses se muestran atenuados y también se pueden pulsar.
7. **Comidas:** al borrar una receta se cuentan todas sus comidas planificadas (también las de días pasados) y se quitan todas. El "+" de "Manage recipes" está arriba a la derecha de esa hoja.
8. **Estado de sincronización:** además de "Synced just now", "Sync paused" y "Offline", se muestra "Synced 5 min ago" (según el tiempo pasado), "Syncing…", "Not synced yet" y "Couldn’t sync, will retry" (errores 403/429/5xx, con reintentos espaciados). En modo perfil local no se muestra la fila de sincronización ni "Sign out".
9. **Reconnect con otra cuenta:** si en "Reconnect" eliges una cuenta de Google distinta, la app cambia a los datos de esa cuenta (los de la anterior siguen guardados en el teléfono).
10. **Adopción del perfil local:** solo la primera cuenta que inicia sesión en un teléfono adopta los datos del perfil local (se fusionan, sin perder nada). Los datos locales originales se conservan también en el teléfono.
11. **Importar copia:** las marcas de borrado que vengan dentro de la copia se ignoran, para que importar nunca borre nada. La nota sigue la regla "gana la más reciente".
12. **Clave de datos:** `daybook:v1:<sub>:data` y `daybook:v1:<sub>:meta` por cuenta; el perfil local usa `daybook:v1:local:data`. La cuenta recordada está en `daybook:v1:account`.
13. **Fechas en inglés** dentro de la app (por ejemplo "Thu 19 Nov", "Saturday 28 November"), porque la interfaz está en inglés.
14. **Avatar:** se carga la foto de Google de la cuenta; si no carga, se muestra un icono de persona.
15. **Tests de interfaz con Chromium**: en este entorno no se pudo descargar WebKit, así que los tests se ejecutaron en Chromium con emulación de iPhone 15 Pro. El script usa WebKit automáticamente cuando está instalado.
16. **Ingredientes:** el catálogo es una colección nueva (`ingredients`) cuyo id sale del nombre (`ing:arroz`), así dos teléfonos que añaden o migran el mismo ingrediente no crean duplicados al sincronizar. Cada receta guarda su lista `ingredients: [{ id, name }]`. Mayúsculas y espacios no cuentan ("Tomate" = "tomate").
17. **Compra desde comidas:** cada ingrediente enviado es un elemento de Shopping vinculado a esa comida (`mealId`, `ingredientId`); el interruptor está encendido mientras ese elemento exista. En la lista se agrupan por nombre; deslizar borra el grupo entero.
18. **Eventos pasados:** se borran al abrir la app, al volver a ella y si se queda abierta a medianoche (se comprueba cada minuto).
