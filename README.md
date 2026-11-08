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

## 3. Frontend

```bash
cd front
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para publicar en cualquier hosting estático
```

Si la API no está en `localhost:3001`, cree `front/.env` con `VITE_API_URL=http://<servidor>:3001/api`.

## 4. APK de Android (Capacitor)

`capacitor.config.json` ya está creado. Se necesita Android Studio instalado.

```bash
cd front
npm i @capacitor/core @capacitor/android
npm i -D @capacitor/cli
# En front/.env: VITE_API_URL=http://<IP o dominio del servidor>:3001/api
#   (no use "localhost": en el celular apunta al propio celular)
npm run build
npx cap add android      # solo la primera vez
npx cap sync
npx cap open android     # en Android Studio: Build > Build APK(s)
```

`capacitor.config.json` permite HTTP sin cifrar (`cleartext`) para poder probar contra un servidor de la red local. En producción conviene publicar la API con HTTPS.

## Decisiones tomadas (sección 10 de la descripción funcional)

| Tema | Decisión inicial | Dónde se cambia |
|---|---|---|
| Organizaciones | Multi-organización desde el inicio: todos los datos se separan por `organizacion_id` | — |
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

- Envío real de emails (SMTP con nodemailer) y recordatorios automáticos programados. Las plantillas y la tabla `notificaciones` ya están listas.
- Arrastrar y soltar turnos en la grilla, que hoy se reprograman desde la ficha del turno.
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
