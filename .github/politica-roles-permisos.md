Política de roles y permisos
Proyecto: Licorera Online
Documento: Política de control de acceso y autorización
Versión: 1.0
Fecha: Noviembre de 2026
Estado: Propuesta para implementación del MVP

1. Objetivo
Establecer las reglas de acceso, autorización y administración de usuarios dentro de la plataforma Licorera Online.
La política define:
    • Los roles disponibles en el sistema.
    • Las responsabilidades de cada rol.
    • Los permisos sobre los diferentes módulos.
    • Las restricciones de acceso a información y operaciones.
    • Los mecanismos de asignación y revocación de permisos.
    • Los criterios de seguridad y trazabilidad.
El objetivo es garantizar que cada usuario pueda ejecutar únicamente las operaciones necesarias para cumplir sus responsabilidades.
2. Alcance
Esta política aplica a las funcionalidades administrativas del Backoffice y a los servicios backend que gestionan los datos del negocio.
Comprende los siguientes dominios:
Dominio	Funcionalidades
Catálogo	Productos, marcas, categorías y presentaciones.
Inventario	Existencias, movimientos y ajustes.
Comercio	Pedidos, pagos y entregas.
Usuarios	Perfiles y administración de acceso.
Promociones	Cupones, descuentos y beneficios.
Analítica	Métricas e indicadores operativos.
También define la separación entre clientes registrados, clientes invitados y usuarios administrativos.
La logística de domiciliarios se gestionará manualmente fuera del sistema durante el MVP. Por tanto, no se contempla inicialmente un rol de domiciliario.
3. Principios de autorización
La autorización se regirá por los siguientes principios:
3.1 Mínimo privilegio
Cada usuario tendrá exclusivamente los permisos necesarios para desarrollar sus funciones.
3.2 Denegación por defecto
Toda operación estará denegada salvo que exista un permiso explícito que la autorice.
3.3 Separación de responsabilidades
Las operaciones administrativas sensibles estarán restringidas a los roles autorizados.
3.4 Autorización en backend
La interfaz podrá ocultar o deshabilitar funcionalidades según los permisos del usuario, pero la autorización definitiva siempre será responsabilidad de NestJS.
3.5 Independencia de los dominios
Cada servicio será responsable de validar los permisos correspondientes a sus operaciones y de proteger sus propios recursos.
3.6 Trazabilidad
Las operaciones administrativas relevantes deberán registrar quién ejecutó la acción, qué recurso modificó y cuándo ocurrió.
4. Clasificación de usuarios
Se establecen dos categorías principales.
4.1 Clientes
Son las personas que utilizan el Storefront para consultar productos y realizar compras.
Se contemplan dos modalidades:
Cliente registrado
    • Puede autenticarse mediante Supabase Auth.
    • Puede realizar compras.
    • Puede consultar su propio historial de pedidos.
    • Puede administrar los datos de su perfil.
    • Puede consultar su información de compra y entrega.
Cliente invitado
    • Puede explorar el catálogo.
    • Puede realizar compras sin crear una cuenta.
    • Puede proporcionar sus datos de contacto y entrega.
    • Puede consultar su pedido mediante un mecanismo seguro de seguimiento, si se habilita.
Los clientes no reciben roles administrativos por registrarse en la tienda.
4.2 Usuarios administrativos
Son usuarios autorizados para acceder al Backoffice y ejecutar operaciones internas.
Se establecen tres roles iniciales:
    • ADMIN
    • MANAGER
    • OPERATOR
5. Definición de roles administrativos
5.1 ADMIN — Administrador
Objetivo: administrar integralmente la plataforma y controlar el acceso de los usuarios administrativos.
Responsabilidades:
    • Administración de usuarios internos.
    • Asignación y revocación de roles.
    • Configuración del catálogo.
    • Administración del inventario.
    • Supervisión de pedidos y pagos.
    • Administración de promociones.
    • Consulta de métricas.
    • Supervisión general de las operaciones.
Es el rol con mayor nivel de autorización.
Restricciones y controles:
    • Sus acciones administrativas deben quedar auditadas.
    • No debe utilizarse como cuenta de operación cotidiana cuando otro rol tenga permisos suficientes.
    • La asignación de privilegios administrativos debe ser excepcional y controlada.
5.2 MANAGER — Gerente
Objetivo: administrar y supervisar la operación comercial.
Responsabilidades:
    • Gestionar productos y categorías.
    • Consultar y administrar pedidos.
    • Supervisar pagos.
    • Gestionar existencias y ajustes de inventario.
    • Administrar promociones y descuentos.
    • Consultar métricas operativas.
    • Supervisar las actividades del equipo operativo.
Restricciones:
    • No puede asignar roles administrativos.
    • No puede modificar los permisos de otros usuarios.
    • No puede administrar la configuración de seguridad de la plataforma.
    • No puede crear ni eliminar administradores.
5.3 OPERATOR — Operador
Objetivo: ejecutar las actividades operativas diarias.
Responsabilidades:
    • Consultar pedidos.
    • Actualizar estados operativos de los pedidos.
    • Consultar productos y existencias.
    • Registrar entradas, salidas y ajustes autorizados de inventario.
    • Consultar información necesaria para preparar y entregar pedidos.
    • Registrar información operativa de entrega.
Restricciones:
    • No puede administrar usuarios ni roles.
    • No puede crear o eliminar productos.
    • No puede modificar precios.
    • No puede administrar promociones.
    • No puede consultar métricas financieras o información administrativa restringida.
    • No puede aprobar pagos por transferencia, salvo que una delegación específica sea definida posteriormente.
6. Matriz de roles y permisos
La siguiente matriz establece los permisos iniciales del MVP.
Módulo / Operación	ADMIN	MANAGER	OPERATOR
Catálogo			
Consultar productos	Sí	Sí	Sí
Crear productos	Sí	Sí	No
Editar productos	Sí	Sí	No
Desactivar productos	Sí	Sí	No
Gestionar categorías	Sí	Sí	No
Gestionar marcas	Sí	Sí	No
Gestionar presentaciones y SKU	Sí	Sí	No
Modificar precios	Sí	Sí	No
Gestionar imágenes	Sí	Sí	No
Inventario			
Consultar existencias	Sí	Sí	Sí
Consultar movimientos	Sí	Sí	Sí
Registrar entradas	Sí	Sí	Sí
Registrar salidas	Sí	Sí	Sí
Registrar ajustes	Sí	Sí	Sí
Consultar ubicaciones	Sí	Sí	Sí
Administrar ubicaciones	Sí	Sí	No
Pedidos			
Consultar pedidos	Sí	Sí	Sí
Consultar detalles de pedidos	Sí	Sí	Sí
Actualizar estados operativos	Sí	Sí	Sí
Cancelar pedidos	Sí	Sí	No
Consultar datos de entrega	Sí	Sí	Sí
Modificar datos de contacto	Sí	Sí	No
Pagos			
Consultar pagos	Sí	Sí	Sí
Registrar pagos en efectivo	Sí	Sí	Sí
Revisar comprobantes	Sí	Sí	No
Aprobar transferencias	Sí	Sí	No
Rechazar transferencias	Sí	Sí	No
Registrar devoluciones	Sí	Sí	No
Promociones			
Consultar promociones	Sí	Sí	Sí
Crear promociones	Sí	Sí	No
Editar promociones	Sí	Sí	No
Desactivar promociones	Sí	Sí	No
Gestionar cupones	Sí	Sí	No
Usuarios			
Consultar usuarios internos	Sí	No	No
Crear usuarios internos	Sí	No	No
Desactivar usuarios internos	Sí	No	No
Asignar roles	Sí	No	No
Consultar perfiles de clientes	Sí	Sí	No
Modificar roles y permisos	Sí	No	No
Analítica			
Consultar métricas operativas	Sí	Sí	No
Consultar métricas comerciales	Sí	Sí	No
Consultar métricas financieras	Sí	Sí	No
Seguridad			
Consultar auditoría	Sí	No	No
Administrar configuración de seguridad	Sí	No	No
La matriz representa los permisos máximos de cada rol. La autorización siempre estará sujeta a las reglas de propiedad, estado y alcance de cada recurso.
7. Catálogo de permisos
Para implementar la matriz, se utilizarán identificadores de permisos independientes de los nombres de los roles.
Se propone la siguiente nomenclatura:
dominio.recurso.acción
Ejemplos:
Permiso	Descripción
catalog.products.read	Consultar productos.
catalog.products.create	Crear productos.
catalog.products.update	Actualizar productos.
catalog.products.deactivate	Desactivar productos.
inventory.stock.read	Consultar existencias.
inventory.stock.adjust	Ajustar inventario.
inventory.movements.read	Consultar movimientos.
commerce.orders.read	Consultar pedidos.
commerce.orders.update_status	Actualizar estados de pedidos.
commerce.orders.cancel	Cancelar pedidos.
commerce.payments.review	Revisar comprobantes.
commerce.payments.approve	Aprobar pagos.
promotions.coupons.manage	Administrar cupones.
users.internal.read	Consultar usuarios internos.
users.internal.manage	Administrar usuarios internos.
access.roles.assign	Asignar roles.
access.permissions.manage	Administrar permisos.
analytics.operational.read	Consultar métricas operativas.
analytics.financial.read	Consultar métricas financieras.
audit.logs.read	Consultar auditoría.
Los permisos deben ser específicos y atómicos. No se recomienda utilizar permisos ambiguos como admin.all o manager.access.
8. Modelo de persistencia de roles y permisos
El esquema app será responsable de almacenar la información de autorización.
Tablas propuestas:
profiles
Relaciona la identidad de Supabase Auth con los datos de aplicación.
Campo	Tipo
id	UUID, PK y referencia a auth.users.id
full_name	VARCHAR(160)
phone	VARCHAR(30), NULL
created_at	TIMESTAMPTZ
updated_at	TIMESTAMPTZ
roles
Almacena los roles disponibles.
Campo	Tipo
id	UUID, PK
name	VARCHAR(50), UNIQUE
description	TEXT
is_system	BOOLEAN
created_at	TIMESTAMPTZ
updated_at	TIMESTAMPTZ
Registros iniciales:
    • ADMIN
    • MANAGER
    • OPERATOR
permissions
Almacena el catálogo de permisos.
Campo	Tipo
id	UUID, PK
code	VARCHAR(120), UNIQUE
description	TEXT
domain	VARCHAR(50)
created_at	TIMESTAMPTZ
user_roles
Relaciona usuarios con roles.
Campo	Tipo
user_id	UUID, FK a profiles.id
role_id	UUID, FK a roles.id
assigned_by	UUID, NULL
created_at	TIMESTAMPTZ
Clave primaria compuesta: (user_id, role_id).
role_permissions
Relaciona roles con permisos.
Campo	Tipo
role_id	UUID, FK a roles.id
permission_id	UUID, FK a permissions.id
created_at	TIMESTAMPTZ
Clave primaria compuesta: (role_id, permission_id).
audit_logs
Registro de operaciones administrativas relevantes.
Campo	Tipo
id	UUID, PK
actor_user_id	UUID, NULL
action	VARCHAR(120)
resource_type	VARCHAR(80)
resource_id	UUID, NULL
metadata	JSONB
created_at	TIMESTAMPTZ
Los registros de auditoría serán de solo inserción para los roles operativos. El acceso estará restringido.
metadata contendrá únicamente información necesaria para la trazabilidad. No almacenará contraseñas, tokens ni datos de autenticación.
9. Reglas de asignación y administración
    1. Todo usuario administrativo debe tener una identidad válida en Supabase Auth.
    2. El acceso al Backoffice requiere un rol administrativo asignado.
    3. Un usuario sin roles administrativos no podrá acceder a funcionalidades administrativas.
    4. Los clientes registrados no recibirán automáticamente roles administrativos.
    5. La asignación de roles estará restringida a ADMIN.
    6. Los cambios de roles deberán quedar registrados en auditoría.
    7. Los roles del sistema no podrán eliminarse accidentalmente.
    8. La desactivación de un usuario deberá revocar su acceso administrativo.
    9. No se permitirá que un usuario se asigne privilegios a sí mismo.
    10. Las cuentas administrativas deberán utilizar credenciales individuales; no se compartirán cuentas entre empleados.
10. Validación de permisos en NestJS
La autorización se implementará en el backend mediante Guards y decoradores.
Ejemplo conceptual:
@RequirePermissions('catalog.products.create')
@Post()
createProduct() {
  // Operación autorizada
}
El proceso de autorización será:
    1. Recibir la solicitud.
    2. Verificar el JWT de Supabase Auth.
    3. Identificar al usuario autenticado.
    4. Obtener sus roles administrativos.
    5. Resolver los permisos asociados.
    6. Validar el permiso requerido.
    7. Evaluar las restricciones del recurso y su estado.
    8. Ejecutar la operación o rechazarla.
Respuestas esperadas:
    • 401 Unauthorized: identidad no autenticada o token inválido.
    • 403 Forbidden: usuario autenticado sin permisos suficientes.
    • 404 Not Found: recurso inexistente o no accesible según la política de exposición.
La autorización no dependerá de datos enviados por el frontend ni de roles declarados libremente por el cliente.
11. Protección de datos y seguridad
Se establecen las siguientes reglas:
    • Las credenciales de Supabase Service Role nunca estarán expuestas en el navegador.
    • Los servicios utilizarán credenciales PostgreSQL con permisos limitados.
    • El acceso a tablas administrativas estará restringido.
    • Se aplicará RLS cuando exista acceso directo autorizado a Supabase.
    • Los servicios NestJS validarán la autorización de las operaciones de negocio.
    • La información de clientes se expondrá únicamente a usuarios autorizados y en la medida necesaria para su función.
    • Los comprobantes de transferencias tendrán almacenamiento privado.
    • Las acciones críticas deberán quedar registradas en auditoría.
La mayoría de edad del comprador es una condición comercial y legal independiente de los roles. No se considerará que un cliente está habilitado para comprar únicamente por tener una cuenta registrada.
12. Evolución de la política
La arquitectura permitirá incorporar posteriormente:
    • Roles personalizados.
    • Permisos más granulares.
    • Alcance de permisos por ubicación.
    • Roles de logística y domiciliarios.
    • Permisos temporales.
    • Flujos de aprobación.
    • Restricciones por tipo de operación.
Cuando se habiliten múltiples ubicaciones, podremos ampliar la asignación de roles con un alcance territorial, evitando que un operador de una tienda tenga acceso automático a la operación de todas las demás.
No se implementarán estas capacidades hasta que exista una necesidad funcional concreta.
13. Criterios de aceptación
La política se considerará implementada cuando:
    • Los tres roles iniciales estén creados.
    • El catálogo de permisos esté registrado.
    • Las relaciones entre usuarios, roles y permisos funcionen correctamente.
    • Los servicios NestJS validen permisos en sus endpoints.
    • Los usuarios sin rol administrativo no puedan acceder al Backoffice.
    • Las operaciones no autorizadas sean rechazadas en backend.
    • Los cambios de roles y las operaciones sensibles queden auditados.
    • Los clientes registrados y los invitados puedan utilizar el Storefront sin recibir privilegios administrativos.
    • Las pruebas cubran tanto accesos permitidos como denegados.

Documento de referencia: Política de roles y permisos — Licorera Online.


Recomendaciones importantes para el modelo físico
Hay tres ajustes respecto al modelo de datos:
    1. Incorporar permissions y role_permissions. Antes habíamos dejado la granularidad para una etapa posterior, pero la matriz que acabamos de definir ya justifica implementarlas desde el MVP.
    2. Incorporar audit_logs. Es importante registrar cambios de precios, ajustes de inventario, aprobación de pagos, cancelaciones y asignación de roles.
    3. Separar los clientes de los administradores. Un cliente registrado no necesita recibir OPERATOR ni otro rol administrativo. La autenticación no implica autorización para operar el Backoffice.
También recomiendo que el rol ADMIN sea asignado únicamente a las cuentas de los propietarios o responsables autorizados del negocio.



