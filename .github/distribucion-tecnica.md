Distribución técnica y arquitectura del sistema
Proyecto: Licorera Online
Versión: 1.0
Fecha: Noviembre de 2026
Estado: Arquitectura inicial — MVP

1. Objetivo
Definir la distribución técnica del sistema, sus aplicaciones, servicios, tecnologías, responsabilidades y mecanismos de comunicación.
La arquitectura busca establecer una base modular, mantenible y escalable, evitando complejidad innecesaria durante el desarrollo del MVP.
2. Arquitectura general
Se propone una arquitectura distribuida por dominios de negocio, compuesta por dos aplicaciones frontend, tres servicios backend y una plataforma administrada de infraestructura y servicios complementarios.
Componentes principales
Componente	Responsabilidad
Storefront	Tienda virtual para clientes.
Backoffice	Administración de la operación comercial.
Catalog Service	Productos, categorías y consulta del catálogo.
Commerce Service	Carrito, checkout y gestión de pedidos.
Inventory Service	Existencias y movimientos de inventario.
Supabase	PostgreSQL, autenticación y almacenamiento.
Reverse Proxy	Enrutamiento de solicitudes hacia los servicios.
Distribución lógica
                    CLIENTES
                       |
             +---------+---------+
             |                   |
        STOREFRONT           BACKOFFICE
        React + Vite         React + Vite
             |                   |
             +---------+---------+
                       |
                 REVERSE PROXY
                       |
          +------------+------------+
          |            |            |
       CATALOG      COMMERCE     INVENTORY
       SERVICE      SERVICE       SERVICE
          |            |            |
          +------------+------------+
                       |
              SUPABASE PLATFORM
                       |
          +------------+------------+
          |            |            |
       PostgreSQL   Auth         Storage
El diagrama representa la distribución lógica. La topología física y el despliegue quedan pendientes.
3. Aplicaciones frontend
Se desarrollarán dos aplicaciones independientes. Ambas compartirán la base tecnológica, pero tendrán objetivos, interfaces y flujos de trabajo diferentes.
3.1 Storefront
Responsabilidad: experiencia de compra para los clientes.
Tecnologías:
    • React.
    • TypeScript.
    • Vite.
    • Tailwind CSS.
    • React Router.
    • TanStack Query.
    • React Hook Form.
    • Zod.
    • Biblioteca de componentes UI: pendiente de selección.
Responsabilidades funcionales:
    • Exploración del catálogo.
    • Búsqueda, filtros y categorías.
    • Confirmación de mayoría de edad.
    • Selección y confirmación de ubicación.
    • Carrito de compras.
    • Checkout para usuarios registrados o invitados.
    • Selección del método de pago.
    • Confirmación y consulta del pedido.
3.2 Backoffice
Responsabilidad: administración interna del negocio.
Tecnologías:
    • React.
    • TypeScript.
    • Vite.
    • Tailwind CSS.
    • React Router.
    • TanStack Query.
    • React Hook Form.
    • Zod.
    • Biblioteca de componentes UI: pendiente de selección.
Responsabilidades funcionales:
    • Gestión de pedidos.
    • Administración de productos y categorías.
    • Control de inventario.
    • Gestión de usuarios y roles.
    • Administración de promociones y cupones.
    • Consulta de métricas operativas.
Las dos aplicaciones serán independientes. No compartirán lógica de negocio mediante dependencias directas; consumirán los servicios backend a través de sus contratos API.
4. Servicios backend
Se utilizará NestJS con TypeScript para construir servicios independientes, organizados por dominios de negocio.
4.1 Catalog Service
Dominio: catálogo comercial.
Responsabilidades:
    • CRUD de productos.
    • Gestión de categorías.
    • Consulta de productos.
    • Búsqueda y filtros.
    • Gestión de imágenes y recursos del catálogo.
    • Publicación y disponibilidad comercial de productos.
No será responsable de procesar pedidos ni administrar las existencias físicas.
4.2 Commerce Service
Dominio: operaciones comerciales.
Responsabilidades:
    • Gestión del carrito.
    • Checkout.
    • Creación de pedidos.
    • Gestión de estados del pedido.
    • Datos de contacto y entrega.
    • Métodos de pago disponibles.
    • Códigos de descuento y aplicación de promociones, cuando corresponda.
Reglas importantes:
    • Un carrito no representa un pedido confirmado.
    • Los pedidos deben conservar una copia histórica del nombre, precio y demás datos comerciales relevantes de los productos comprados.
    • El checkout debe admitir compras como invitado, sin exigir una cuenta.
    • El servicio será responsable de coordinar las operaciones necesarias para confirmar una compra.
4.3 Inventory Service
Dominio: inventario.
Responsabilidades:
    • Existencias por producto.
    • Actualización de cantidades.
    • Registro de movimientos de inventario.
    • Validación de disponibilidad.
    • Ajustes manuales.
    • Coordinación de reservas o descuentos de existencias durante el proceso de compra.
Las operaciones de inventario deben protegerse contra ventas simultáneas que puedan producir existencias negativas.
5. Autenticación y almacenamiento
Se utilizará Supabase como plataforma administrada para los servicios complementarios.
5.1 Supabase Auth
Responsabilidades:
    • Registro de usuarios.
    • Inicio y cierre de sesión.
    • Gestión de sesiones.
    • Emisión de JWT.
    • Recuperación de acceso.
No se desarrollará un microservicio independiente de identidad para el MVP.
NestJS verificará los JWT recibidos y aplicará las reglas de autorización correspondientes a cada operación.
Los perfiles, roles y permisos propios de la aplicación se administrarán en el esquema de datos de la aplicación.
Importante: los pedidos de invitados podrán existir sin una relación obligatoria con un usuario autenticado.
5.2 Supabase Storage
Se utilizará para almacenar:
    • Imágenes de productos.
    • Recursos gráficos del storefront.
    • Recursos administrativos.
    • Documentos privados, si posteriormente se requieren.
Los recursos públicos y privados tendrán políticas de acceso diferenciadas.
Las credenciales privilegiadas de Supabase nunca estarán expuestas en el frontend.
6. Persistencia y base de datos
Motor: PostgreSQL administrado por Supabase.
ORM: Drizzle ORM.
Se propone utilizar un único proyecto de Supabase y organizar la propiedad de los datos mediante esquemas PostgreSQL independientes por dominio.
Nombre de plataforma/proyecto: LicoresYaaa. En PostgreSQL local autogestionado se usará `licoresyaaa` como nombre de la base compartida. En Supabase, se conservará el nombre técnico de base de datos configurado por la plataforma (`postgres`); `LicoresYaaa` será el nombre del proyecto, no un schema.
Distribución de esquemas
Esquema	Propietario	Contenido
auth	Supabase	Identidades y autenticación administradas por Supabase.
catalog	Catalog Service	Productos y categorías.
commerce	Commerce Service	Carritos y pedidos.
inventory	Inventory Service	Existencias y movimientos.
promotions	Por definir	Cupones y promociones, si se separan.
app	Aplicación	Perfiles, roles y permisos propios.
Los esquemas auth y storage administrados por Supabase no serán modificados directamente por los servicios.
Reglas de persistencia
    1. Cada servicio será propietario de sus tablas y migraciones.
    2. Cada servicio administrará su propia configuración de Drizzle.
    3. No se compartirán modelos ORM entre servicios.
    4. Las referencias entre dominios se realizarán mediante identificadores.
    5. No se permitirán escrituras directas de un servicio sobre las tablas de otro.
    6. Se utilizarán roles de base de datos con permisos restringidos por esquema.
    7. Las operaciones críticas deberán mantener la integridad transaccional dentro de su dominio.
La separación por esquemas representa una separación lógica de responsabilidades, no una independencia física de bases de datos.
7. Comunicación entre componentes
Para el MVP se utilizará comunicación HTTP REST síncrona.
Contratos API
    • REST como mecanismo de comunicación.
    • JSON como formato de intercambio.
    • OpenAPI / Swagger para documentar los endpoints.
    • DTOs para validar entradas y estructurar respuestas.
    • Clientes TypeScript generados desde los contratos OpenAPI cuando resulte conveniente.
Comunicación entre servicios
Los servicios podrán consumir endpoints de otros servicios cuando una operación lo requiera.
Ejemplo: durante el checkout, Commerce consulta la disponibilidad en Inventory y coordina la confirmación del pedido.
No se utilizarán consultas SQL directas entre dominios para obtener información de otro servicio.
Evolución futura
La arquitectura podrá incorporar comunicación basada en eventos para procesos asíncronos, como:
    • Notificaciones de pedidos.
    • Cambios de estado.
    • Actualizaciones de inventario.
    • Integraciones externas.
No se incorporará Kafka, RabbitMQ u otro broker durante el MVP sin una necesidad funcional concreta.
8. Enrutamiento y acceso a servicios
Se utilizará un Reverse Proxy para centralizar el acceso HTTP a los servicios backend.
Ejemplo de distribución:
/api/catalog/*      → Catalog Service
/api/commerce/*     → Commerce Service
/api/inventory/*    → Inventory Service
El Reverse Proxy tendrá responsabilidades de enrutamiento y configuración de entrada.
No contendrá reglas de negocio ni reemplazará las responsabilidades de autorización de los servicios.
No se desarrollará un API Gateway personalizado durante la primera etapa.
9. Organización de repositorios
Se utilizará una estrategia Multi-Repo: cada aplicación y servicio tendrá su propio repositorio.
Repositorio	Tipo
liquor-storefront	Frontend
liquor-backoffice	Frontend
liquor-catalog	Backend
liquor-commerce-service	Backend
liquor-inventory	Backend
Los contratos API se documentarán y mantendrán junto a cada servicio.
Un repositorio independiente para contratos compartidos podrá evaluarse cuando existan necesidades reales de reutilización.
10. Seguridad y control de acceso
Principios iniciales:
    • Autenticación mediante Supabase Auth.
    • Verificación de JWT en los servicios backend.
    • Autorización basada en roles y permisos.
    • Validación de datos en los endpoints.
    • Variables de entorno para credenciales y configuraciones.
    • Restricción de permisos por esquema en PostgreSQL.
    • Políticas RLS cuando exista acceso directo autorizado a Supabase.
    • Protección de credenciales privilegiadas.
    • Registro de operaciones administrativas relevantes.
Las reglas de negocio y autorización no dependerán exclusivamente de controles implementados en el frontend.
11. Alcance técnico del MVP
Incluido
    • Storefront.
    • Backoffice.
    • Catálogo.
    • Gestión de pedidos.
    • Carrito y checkout.
    • Compra como invitado.
    • Inventario.
    • Autenticación administrativa.
    • Gestión básica de usuarios y roles.
    • PostgreSQL y Supabase.
    • Comunicación REST.
    • Reverse Proxy.
Fuera del alcance inicial
    • Microservicio independiente de identidad.
    • Microservicio independiente de analítica.
    • Sistema automatizado de logística y asignación de domiciliarios.
    • Broker de eventos.
    • API Gateway personalizado.
    • Arquitectura multi-base de datos física.
    • Cotizaciones.
    • Integraciones complejas de pagos en línea.
La operación logística de domicilios se gestionará manualmente durante el MVP, fuera del sistema.
12. Decisiones técnicas y pendientes
Decisión	Estado
Arquitectura distribuida por dominios	Aprobada
Multi-Repo	Aprobada
React + Vite + TypeScript	Aprobada
Tailwind CSS	Aprobada
NestJS	Aprobada
PostgreSQL mediante Supabase	Aprobada
Supabase Auth y Storage	Aprobada
Drizzle ORM	Aprobada
REST	Propuesta para MVP
OpenAPI / Swagger	Propuesta para MVP
Reverse Proxy	Propuesta para MVP
Biblioteca de componentes UI	Pendiente
Proveedor de despliegue	Pendiente
Infraestructura de ejecución	Pendiente
Estrategia de CI/CD	Pendiente
Modelo de datos	Pendiente
Política de copias de seguridad	Pendiente
13. Criterios de evolución
La arquitectura deberá evolucionar según necesidades verificables del negocio y no por anticipación tecnológica.
Se considerará separar nuevos servicios cuando exista:
    • Una responsabilidad de negocio claramente diferenciada.
    • Necesidad de escalar independientemente.
    • Requerimientos de despliegue o disponibilidad distintos.
    • Complejidad funcional que justifique su separación.
El objetivo es mantener la independencia de los dominios sin introducir infraestructura que no aporte valor al MVP.

Documento de referencia: Arquitectura y distribución técnica — Licorera Online.
Siguiente etapa de ingeniería: diseño del modelo de datos, definición de entidades, relaciones, restricciones, índices y flujos transaccionales del MVP.
