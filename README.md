# Agendip

Sistema de turnos para consultorios y centros de salud (Ziel Soft).

```
Agendia/
├── database/   Scripts MySQL (compatibles con MySQL 5.0 en adelante)
├── back/       API REST: Node + Express + mysql2
└── front/      Web app: React + Vite (+ Capacitor para el APK de Android)
```

## 1. Base de datos

Se ejecutan los scripts en orden:

```bash
mysql -u root -p < database/01_estructura.sql    # crea la base "agendia" y todas las tablas
mysql -u root -p < database/02_datos_demo.sql    # opcional: organización de prueba
```

- `01_estructura.sql` se puede volver a ejecutar sin perder datos (usa `CREATE TABLE IF NOT EXISTS`).
- `03_migracion_obras_sociales.sql` es solo para bases creadas antes de que existieran las obras sociales con planes. Se ejecuta una vez, después de `01_estructura.sql`, y pasa el texto de obra social de cada paciente a la nueva tabla.
- `04_migracion_membresias.sql` es solo para bases creadas antes de que un usuario pudiera trabajar en varios consultorios. Se ejecuta una vez: pasa el rol, el profesional vinculado y el permiso de sobreturno de cada usuario a su acceso (membresía) en la organización.
- `06_migracion_historia_clinica.sql` es solo para bases creadas antes de la historia clínica. Se ejecuta una vez: agrega la opción de historia compartida o privada en la organización y las tablas de antecedentes, evoluciones y aclaraciones. En Railway, cambiar `USE agendia;` por `USE railway;`.
- `07_migracion_signos_vitales.sql` va después de la 06 (también una sola vez): agrega a las evoluciones peso, talla, perímetro cefálico, temperatura, tensión arterial, frecuencias cardíaca y respiratoria y saturación.
- `05_migracion_cuentas.sql` es solo para bases creadas antes de «Mi cuenta» y «Recuperar contraseña». Se ejecuta una vez: agrega la versión de sesión de cada usuario (cambiar la contraseña cierra las otras sesiones) y la tabla de links de recuperación.
- Con los datos demo se ingresa con **admin@agendip.com** / **admin123**. Cambie esa contraseña después de entrar.
- Sin datos demo, use «Crear cuenta» en la pantalla de ingreso: se crea la organización con su usuario administrador.

Por compatibilidad con MySQL 5.0, el script:

- usa `utf8`, porque `utf8mb4` no existe en esa versión. La API quita los emojis antes de guardar.
- tiene una sola columna `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` por tabla.
- no usa columnas JSON, triggers ni eventos.

## 2. Backend

```bash
cd back
npm install
# Editar .env: DB_PASSWORD y un JWT_SECRET largo y aleatorio
npm run dev        # desarrollo (nodemon)
npm start          # producción
```

La API queda en `http://localhost:3001/api`. Las variables están documentadas en `.env.example`.

### Superadministrador

El superadministrador ve todas las organizaciones (panel «Superadmin»): sus datos de uso, el plan, el límite de profesionales, la baja o reactivación, el alta de organizaciones nuevas con su administrador, y puede entrar a cualquiera como administrador. No hay forma de volverse superadmin desde la aplicación; se asigna desde el servidor:

```bash
npm run superadmin -- persona@mail.com          # la hace superadmin
npm run superadmin -- persona@mail.com quitar   # le quita el permiso
npm run superadmin                              # lista los superadmins
```

## 3. Frontend

```bash
cd front
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para publicar en cualquier hosting estático
```

Si la API no está en `localhost:3001`, cree `front/.env` con `VITE_API_URL=http://<servidor>:3001/api`.

## 4. APK de Android (Capacitor)

La APK trae adentro el front compilado y se conecta a la API publicada. Se necesitan el Android SDK y Java 21.

```bash
cd front
# PowerShell: $env:VITE_API_URL="https://<dominio-de-railway>/api"; npm run build
VITE_API_URL=https://<dominio-de-railway>/api npm run build
npx cap add android      # solo la primera vez (la carpeta android/ no se versiona)
npx capacitor-assets generate --android   # ícono y pantalla de inicio (desde front/assets/)
npx cap sync
cd android
./gradlew assembleDebug  # genera app/build/outputs/apk/debug/app-debug.apk
```

- La primera vez, cree `front/android/local.properties` con `sdk.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk`.
- No compile la APK con la API en `localhost`: en el celular, eso apunta al propio celular.
- Agregue `https://localhost`, el origen de la app, a `CORS_ORIGIN` del backend.
- Cada cambio del front requiere generar e instalar una APK nueva.

## 5. Publicación (Railway + Cloudflare Pages)

**Base y backend en Railway**

1. Cree un proyecto en Railway y agregue una base **MySQL**.
2. Agregue un servicio desde el repo de GitHub, con *Root Directory* `back`. Railway detecta Node y usa `npm start`.
3. En el servicio, configure estas variables:
   - Variables de la base: referencie las de la base MySQL (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`). El backend las usa solo, sin `DB_*`.
   - `NODE_ENV=production`
   - `JWT_SECRET`: al menos 32 caracteres aleatorios. Se genera con el comando que figura en `.env.example`.
   - `CORS_ORIGIN=https://<su-dominio-de-cloudflare>`
   - `APP_URL=https://<su-dominio-de-cloudflare>`
   - `RESEND_API_KEY` y `MAIL_FROM`
4. Genere un dominio público para el servicio (*Settings → Networking*).
5. Cree las tablas y el superadministrador, una sola vez. Puede hacerlo desde la consola del servicio, o localmente con `back/.env` apuntando a la URL pública de la base:

   ```bash
   npm run db:instalar
   npm run superadmin -- su@email.com "Su nombre"   # imprime una contraseña inicial
   ```

   No ejecute `02_datos_demo.sql` en producción.

En producción el backend no arranca si `JWT_SECRET` es débil o si `CORS_ORIGIN` es `*`. Tiene límites de intentos en ingreso, registro y recuperación de contraseña. Los horarios usan `APP_TZ` (por defecto Buenos Aires), sin importar la zona del servidor.

**Emails:** la recuperación de contraseña usa [Resend](https://resend.com) por HTTP, porque Railway bloquea SMTP en los planes básicos. Sin `RESEND_API_KEY` el email solo se muestra en el log. Para mandar a cualquier dirección hay que verificar un dominio propio en Resend y usarlo en `MAIL_FROM`.

**Frontend en Cloudflare Pages**

1. Cree un proyecto en *Workers & Pages* conectado al repo, con esta configuración:
   - *Root directory*: `front`
   - *Build command*: `npm run build`
   - *Output directory*: `dist`
2. Agregue la variable `VITE_API_URL=https://<dominio-de-railway>/api`. Se lee al compilar, así que si cambia hay que volver a publicar.
3. `front/public/_redirects` hace que las rutas (`/agenda`, `/restablecer`, etc.) funcionen al recargar la página.

## Decisiones tomadas (sección 10 de la descripción funcional)

| Tema | Decisión inicial | Dónde se cambia |
|---|---|---|
| Organizaciones | Multi-organización desde el inicio: todos los datos se separan por `organizacion_id`, en una sola base | Superadmin |
| Usuarios | Una cuenta (email y contraseña) puede trabajar en varios consultorios, con un rol distinto en cada uno. Si trabaja en más de uno, elige en cuál al ingresar y puede cambiar desde el menú. El admin de un consultorio no puede cambiar el nombre, el email ni la contraseña de una cuenta que también se usa en otro | Usuarios |
| Pacientes | Compartidos entre los profesionales de la misma organización | — |
| Roles | `admin` (todo), `recepcion` (turnos y pacientes de todos), `profesional` (solo su agenda) | Usuarios |
| Sobreturnos | Los puede dar el admin, o cualquier usuario con el permiso «Puede dar sobreturnos» | Usuarios |
| WhatsApp | Link manual `wa.me` con el mensaje de la plantilla. Cada envío queda registrado en el historial | Configuración > Mensajes |
| Reserva online y pagos | No incluidos en esta versión | — |

## Lógica de disponibilidad

El horario de un profesional para un día se arma así:

1. Se parte del **horario habitual** de ese día de la semana, que puede tener varias franjas.
2. Si hay un **horario especial** para la fecha, reemplaza al habitual.
3. Se restan los **feriados, vacaciones, licencias, días libres y bloqueos**:
   - Pueden cubrir el día completo o un rango de horas.
   - Pueden aplicar a un profesional o a toda la organización.

Un turno nuevo debe caer dentro de ese horario y no superponerse con otro turno activo, salvo que se marque como **sobreturno** y el usuario tenga permiso. Las reservas se validan dentro de una transacción con bloqueo, así que dos recepcionistas no pueden tomar el mismo horario al mismo tiempo.

## Pendiente para próximas etapas

- Backups automáticos de la base en producción.
- Recordatorios de turnos por email, programados automáticamente (el envío por Resend ya existe para recuperar contraseña). Las plantillas y la tabla `notificaciones` ya están listas.
- Turnos recurrentes (tabla `turnos_series`) y la pantalla de lista de espera (tabla `lista_espera`).
- Exportación de reportes a Excel o PDF.
- Varias sedes (tabla `sedes`), reserva online y cobros.
- Historia clínica (Ley 26.529):
  - Evoluciones inalterables con fecha y profesional; se corrigen con notas aclaratorias.
  - Antecedentes del paciente.
  - Adjuntos.
  - Acceso solo para profesionales.
  - Exportación a PDF.
  - Falta definir si la historia es compartida entre profesionales o propia de cada uno.
