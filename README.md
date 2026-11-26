# LicoresYaaa Inventory

Servicio de inventario de LicoresYaaa. Administra las cantidades físicas y reservadas por variante y ubicación, así como la trazabilidad de sus cambios. Los pedidos, pagos y precios pertenecen a otros servicios.

## Alcance

- Consulta de balances y disponibilidad, calculada como cantidad física menos cantidad reservada.
- Reserva, liberación y despacho de existencias por pedido.
- Registro de entradas, ajustes e historial de movimientos.
- Registro de devoluciones con cantidades recibidas y cantidades reintegrables.
- Escrituras transaccionales y claves de idempotencia para las operaciones implementadas.

Inventory es responsable del esquema PostgreSQL `inventory`. Las variantes, pedidos y actores de otros dominios se representan mediante identificadores lógicos, sin claves foráneas entre servicios. El cliente de Catalog está implementado, pero los flujos de stock aún no lo utilizan para validar variantes.

## Tecnologías y estructura

El proyecto utiliza Node.js, TypeScript, NestJS, PostgreSQL, Drizzle ORM y Drizzle Kit. Los contratos HTTP se validan con `class-validator` y `class-transformer`, se documentan con Swagger/OpenAPI y se prueban con Vitest y Supertest.

```text
src/
  common/                   Guardas y contexto de seguridad interna
  infrastructure/database/ Conexión y esquema Drizzle de inventory
  modules/
    catalog-client/         Cliente HTTP interno de Catalog
    stock-balance/          Consultas de balances y disponibilidad
    stock-movement/         Entradas, ajustes y movimientos
    stock-reservation/      Reservas, liberaciones y despachos
    stock-return/           Devoluciones
drizzle/                   Migraciones y metadatos de Drizzle
test/                      Pruebas HTTP de extremo a extremo
.github/                   Documentos técnicos del proyecto
```

## Requisitos previos

- Node.js compatible con las dependencias del proyecto y `pnpm`.
- PostgreSQL accesible y una base de datos creada para el entorno local.
- URL y credencial de servicio de Catalog para la configuración del cliente.

## Instalación y configuración local

Desde la raíz del repositorio:

```powershell
pnpm install
Copy-Item .env.example .env
```

Configura las variables de `.env` para tu entorno. No incluyas credenciales reales en el repositorio. Después ejecuta las migraciones y arranca el servicio:

```powershell
pnpm run db:migrate
pnpm run start:dev
```

Por defecto, la aplicación escucha en el puerto `3000`. Las variables de entorno del proceso también pueden proporcionarse mediante el entorno de ejecución.

### Variables de entorno

| Variable | Propósito |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL del servicio. El ejemplo local utiliza la base compartida `licoresyaaa`. |
| `INTERNAL_API_TOKEN` | Credencial bearer que protege las rutas internas. Si falta, las solicitudes internas son rechazadas. |
| `CATALOG_API_URL` | URL base HTTP o HTTPS de Catalog; es obligatoria al iniciar Inventory. |
| `CATALOG_SERVICE_TOKEN` | Token de servicio enviado a Catalog; debe coincidir con `CATALOG_SERVICE_API_TOKEN` de Catalog y tener al menos 32 caracteres sin espacios. |
| `CATALOG_TIMEOUT_MS` | Tiempo máximo de espera de Catalog en milisegundos; opcional, de 1 a 30000. Valor predeterminado: 5000. |
| `PORT` | Puerto HTTP de Inventory; opcional, con valor predeterminado `3000`. |
| `POSTGRES_TEST_DATABASE_URL` | Conexión opcional a una base PostgreSQL dedicada y desechable para pruebas de concurrencia. Debe estar disponible como variable del proceso al ejecutar las pruebas. |

El token de Catalog y `INTERNAL_API_TOKEN` son credenciales entre servicios: no deben exponerse al navegador.

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm run start` | Iniciar la aplicación. |
| `pnpm run start:dev` | Iniciar la aplicación con observación de cambios. |
| `pnpm run start:debug` | Iniciar la aplicación en modo de depuración con observación de cambios. |
| `pnpm run build` | Compilar la aplicación en `dist/`. |
| `pnpm run start:prod` | Ejecutar la aplicación compilada. |
| `pnpm run lint` | Analizar código fuente y pruebas con Oxlint. |
| `pnpm run format` | Aplicar Prettier a los archivos TypeScript de `src/` y `test/`. |
| `pnpm run test` | Ejecutar las pruebas unitarias y las pruebas PostgreSQL habilitadas. |
| `pnpm run test:watch` | Ejecutar Vitest en modo de observación. |
| `pnpm run test:cov` | Ejecutar las pruebas con cobertura. |
| `pnpm run test:debug` | Ejecutar las pruebas en modo de depuración. |
| `pnpm run test:e2e` | Ejecutar las pruebas HTTP de extremo a extremo. |
| `pnpm run test:concurrency` | Ejecutar la suite PostgreSQL de concurrencia e idempotencia. |
| `pnpm run db:generate` | Generar migraciones Drizzle a partir de cambios en el esquema TypeScript. |
| `pnpm run db:migrate` | Aplicar las migraciones pendientes. |

La suite de concurrencia se omite si `POSTGRES_TEST_DATABASE_URL` no está definida. Aplica migraciones y elimina registros de prueba: utiliza exclusivamente una base de pruebas dedicada, nunca una base de desarrollo compartida o de producción.

## Migraciones

Drizzle Kit lee la configuración de `drizzle.config.ts`, las definiciones de `src/infrastructure/database/schema/` y el historial de `drizzle/`. Las migraciones iniciales crean el esquema `inventory` y sus tablas, tipos, restricciones e índices.

Para un cambio de esquema, genera y revisa una migración nueva antes de aplicarla:

```powershell
pnpm run db:generate
pnpm run db:migrate
```

No edites migraciones que ya hayan sido aplicadas. La existencia previa de un objeto no garantiza que su definición coincida con el modelo; revisa cualquier diferencia antes de aplicar cambios sobre una base existente. La configuración actual no establece un historial de migraciones independiente por servicio: su coordinación en una base compartida está pendiente de confirmar.

## API interna

La documentación Swagger está disponible en `http://localhost:3000/docs` y el documento OpenAPI en `http://localhost:3000/docs-json`, ajustando el puerto si se configuró `PORT`.

Las rutas de stock requieren `Authorization: Bearer <INTERNAL_API_TOKEN>` y el permiso correspondiente en `X-Actor-Permissions`, separado por comas. Las entradas, ajustes, liberaciones, despachos y devoluciones requieren además `X-Actor-Id` con el UUID v4 del responsable.

| Método | Ruta | Permiso |
| --- | --- | --- |
| `GET` | `/internal/v1/stock/availability` | `inventory.stock.read` |
| `GET` | `/internal/v1/stock/balances` | `inventory.stock.read` |
| `GET` | `/internal/v1/stock/variants/:variantId` | `inventory.stock.read` |
| `POST` | `/internal/v1/stock/reservations` | `inventory.stock.reserve` |
| `POST` | `/internal/v1/stock/reservations/:orderId/release` | `inventory.stock.release` |
| `POST` | `/internal/v1/stock/reservations/:orderId/dispatch` | `inventory.stock.dispatch` |
| `GET` | `/internal/v1/stock/reservations/orders/:orderId` | `inventory.stock.read` |
| `POST` | `/internal/v1/stock/movements/entries` | `inventory.stock.adjust` |
| `POST` | `/internal/v1/stock/movements/adjustments` | `inventory.stock.adjust` |
| `GET` | `/internal/v1/stock/movements` | `inventory.movements.read` |
| `POST` | `/internal/v1/stock/returns` | `inventory.stock.return` |
| `GET` | `/internal/v1/stock/returns/orders/:orderId` | `inventory.stock.read` |

El servicio confía en que el llamador interno valide la identidad y resuelva los permisos antes de enviar el contexto del actor. Inventory verifica el token y los permisos recibidos, pero no verifica directamente el JWT de Supabase ni la existencia del actor. Las rutas y credenciales internas deben mantenerse fuera del acceso directo de navegadores.

## Integraciones y mantenimiento

- Commerce puede consumir los contratos HTTP internos para coordinar operaciones sin escribir directamente las tablas de Inventory.
- `CatalogClientModule` expone el cliente por el token `CATALOG_CLIENT`. Consulta `GET /internal/v1/variants/:id`, valida las respuestas y permite resolver variantes inactivas; los casos de uso de stock todavía no invocan este cliente.
- El esquema incluye ubicaciones, pero no hay una ruta implementada para crearlas. Debe existir una ubicación antes de registrar balances que la referencien.
- Los movimientos se registran mediante inserciones y los repositorios implementados no exponen actualización ni eliminación de movimientos. La protección mediante permisos de base de datos debe configurarse en el entorno de despliegue.