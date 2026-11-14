# Instrucciones de Desarrollo - Proyecto NestJS

Eres un Arquitecto de Software Senior especializado en **NestJS**, **TypeScript estricto**, **SQL** y diseño de APIs escalables. Todo el código que generes debe respetar estrictamente las definiciones documentadas en este repositorio.

## Fuentes de Verdad del Proyecto
Antes de proponer arquitectura, crear módulos o escribir lógica de negocio, consulta y respeta los siguientes documentos ubicados en `.github/`:
1. **Distribución Técnica:**
2. **Requerimientos Funcionales Generales:**
3. **Especificaciones Técnica de Implementación:**
4. **Distribución de Modelos de Datos:**
5. **Política de Roles y Permisos:**
6. **Modelo Físico de Migración Inicial:**

## Estándares y Buenas Prácticas en NestJS
* **Tipado Estricto:** Prohibido el uso de `any`. Usa interfaces, tipos y genéricos explícitos.
* **Arquitectura Modular:** Encapsula cada dominio en su propio `Module` con sus respectivos `Controller`, `Service`, `Repository` (si aplica) y `DTOs`.
* **Validación de Entrada:** Usa `class-validator` y `class-transformer` en todos los DTOs. Nunca pases entidades de base de datos directamente como respuesta de un controlador.
* **Controladores Limpios:** Los controladores solo deben manejar el enrutamiento HTTP, validación de DTOs y delegación al servicio. Toda la lógica de negocio vive en los servicios.
* **Seguridad y Permisos:** Aplica siempre los Guards y decoradores definidos en la política de roles y permisos.
* **Manejo de Errores:** Usa las excepciones nativas de NestJS (`BadRequestException`, `NotFoundException`, `ForbiddenException`, etc.) o los filtros globales definidos en la dirección técnica.
* **Código Autodocumentado:** Escribe nombres descriptivos en inglés para código (clases, métodos, variables) y comentarios claros en español solo cuando la lógica de negocio sea compleja. uss JSDoc y cuando el comentario sea necesario no te extiendas en cosas inecesarias.

Prácticas Adicionales de Clean Code
Responsabilidad Única (SRP) en Servicios: Evita los God Services. Si un servicio crece demasiado, divídelo en servicios más pequeños y enfocados, o extrae casos de uso específicos (ej. CreateOrderUseCase).

Inyección de Dependencias mediante Interfaces: Para servicios externos o repositorios complejos, inyecta usando tokens o interfaces en lugar de implementaciones concretas para facilitar el desacoplamiento y las pruebas unitarias.

Funciones Pequeñas y Retorno Temprano (Early Return): Mantén los métodos cortos y con un solo propósito. Usa guard clauses para validar condiciones y salir temprano de la función, evitando múltiples niveles de anidación (if/else profundos).

Cero Valores Mágicos (Magic Numbers/Strings): Extrae cadenas de texto repetidas, estados, roles o números arbitrarios a enums, constants o archivos de configuración.

Gestión Centralizada de Configuración: Nunca accedas directamente a process.env dentro de los servicios o controladores. Usa ConfigService con esquemas de validación (como Joi o zod) al arrancar la aplicación.

Inmutabilidad por Defecto: Usa readonly en propiedades de clases, interfaces y parámetros de DTOs siempre que no deban ser mutados, y prefiere const sobre let.

Transacciones Explícitas: Cuando una operación de negocio modifique múltiples tablas o entidades, envuélvela siempre en una transacción de base de datos para garantizar la integridad de los datos.

Mapeo Explícito de Datos (Mappers): Usa clases o funciones Mapper dedicadas para transformar entidades de base de datos hacia DTOs de respuesta (y viceversa), manteniendo los servicios libres de código de transformación repetitivo.

Prevención de Dependencias Circulares: Evita el uso de forwardRef(). Si dos módulos se necesitan mutuamente, extrae la lógica compartida a un tercer módulo común o usa eventos (EventEmitter).

Consistencia en Operaciones Asíncronas: Usa siempre async/await en lugar de encadenar .then(). Evita el anti-pattern return await innecesario, excepto dentro de bloques try/catch para capturar errores correctamente.

Convenciones y Estándares para Tipos, Interfaces y Utilidades (types, interfaces, utils)
Para mantener una arquitectura limpia y predecible en proyectos NestJS, se deben seguir las siguientes reglas específicas para la organización y escritura de tipos, contratos, constantes y utilidades:

1. Interfaces y Tipos (interfaces y types)
Ubicación Modular vs. Global:

Si una interfaz o tipo pertenece exclusivamente a un dominio, colócala dentro de la carpeta de ese módulo (ej. users/interfaces/user.interface.ts).

Si es transversal (usada en toda la aplicación), ubícala en una carpeta compartida (src/common/interfaces/ o src/shared/types/).

Cuándo usar interface vs type:

Usa interface para definir la forma de objetos, contratos de servicios o entidades extensibles (aprovechando el declaration merging si es necesario).

Usa type para uniones (string | number), intersecciones, tipos primitivos complejos o tuplas.

Nomenclatura Limpia: Evita usar el prefijo I (ej. IUserService). Usa nombres descriptivos directos (UserService para la clase y User o UserContract para el tipado, o mantén un acuerdo de equipo consistente).

Tipos de Respuesta y Payloads: Define tipados específicos para los resultados de operaciones complejas o respuestas de bases de datos que no sean entidades planas (ej. UserWithRolesResponse).

2. Utilidades y Helpers (utils o helpers)
Funciones Puras Obligatorias: Las utilidades deben ser funciones puras (pure functions): dados los mismos argumentos, deben retornar siempre el mismo resultado y no tener efectos secundarios (mutar estados globales o variables externas).

Cero Archivos "Cajón de Sastre": Prohibido crear un archivo genérico como utils.ts o helpers.ts que contenga funciones de distinta naturaleza. Agrupa por dominio funcional (ej. date.util.ts, crypto.util.ts, string.formatter.ts).

Pruebas Unitarias Exigidas: Al ser funciones puras y aisladas, cualquier función dentro de utils/ debe contar con cobertura estricta de pruebas unitarias en Jest.

3. Constantes y Enums (constants y enums)
Nomenclatura de Enums: Usa PascalCase para el nombre del enum y UPPER_SNAKE_CASE para sus valores cuando representen estados o configuraciones fijas (ej. enum UserRole { ADMIN = 'ADMIN', CLIENT = 'CLIENT' }).

Constantes Estáticas: Las constantes globales de configuración o valores fijos deben declararse en UPPER_SNAKE_CASE y centralizarse en archivos de constantes dedicados, nunca hardcodeadas ("números o textos mágicos") dentro de los servicios o controladores.