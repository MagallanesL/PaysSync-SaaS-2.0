# PaySync Billing Refactor Notes

## Objetivo de esta iteracion

Se adaptó PaySync para que el flujo principal del owner deje de depender de lógica ambigua o manual y pase a funcionar como un circuito operativo:

1. Crear disciplina
2. Crear alumno
3. Asignar disciplina
4. Generar cuota automática del período actual
5. Registrar pagos parciales o totales
6. Reflejar resultados en Resumen y Cuotas

La implementación buscó mantener la UI existente y evitar una reescritura total.

## Diagnóstico del estado previo

Antes del cambio:

- `students` guardaba disciplinas embebidas dentro del alumno.
- `fees` se “sincronizaba” desde la pantalla de cuotas al cargar.
- no existía una entidad operativa real para la relación alumno-disciplina.
- los pagos no estaban modelados como eventos trazables.
- varias pantallas recalculaban estado y saldo por su cuenta.

Problema principal:

- la app tenía UI funcional, pero el negocio de cobranza no tenía una única fuente de verdad.

## Decisión de arquitectura

Se mantuvo compatibilidad con las colecciones existentes, pero se agregó una estructura más sólida:

- `students`
- `disciplines`
- `enrollments`
- `fees`
- `payments`

Además, la lógica crítica pasó a centralizarse en:

- [src/lib/academyBilling.ts](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/lib/academyBilling.ts)

## Nuevas reglas de negocio implementadas

### 1. Disciplina

La disciplina define el valor base de la cuota.

Campos normalizados usados:

- `name`
- `category`
- `modality`
- `baseAmount`
- `active`
- `allowPartial`

Compatibilidad:

- también se siguen escribiendo campos previos como `price`, `billingType` y `paymentMode` para no romper vistas viejas ni datos existentes.

### 2. Enrollment

Se creó `enrollments` como relación real entre alumno y disciplina.

Campos usados:

- `centerId`
- `studentId`
- `disciplineId`
- `startDate`
- `active`
- `customAmount`
- `billingDay`

Regla:

- al asignar una disciplina a un alumno, se crea o reactiva un enrollment.

### 3. Cuota

Se consolidó la estructura de cuota con estos conceptos:

- `studentId`
- `disciplineId`
- `enrollmentId`
- `concept`
- `periodYear`
- `periodMonth`
- `dueDate`
- `originalAmount`
- `lateFeeAmount`
- `totalAmount`
- `amountPaid`
- `balance`
- `status`
- `reminderStatus`

Estados:

- `pending`
- `partial`
- `paid`
- `overdue`

Reglas:

- si `balance = 0`, la cuota queda `paid`
- si `amountPaid > 0` y `balance > 0`, queda `partial`
- si la cuota venció y tiene saldo, queda `overdue`
- nunca se marca `overdue` si ya está `paid`

### 4. Pago

Los pagos ahora se registran como eventos en `payments`.

Campos usados:

- `feeId`
- `studentId`
- `amount`
- `paymentDate`
- `paymentMethod`
- `note`
- `createdBy`

Reglas:

- no se aceptan pagos menores o iguales a cero
- no se permite pagar más que el saldo pendiente
- cada pago actualiza la cuota asociada

### 5. Vencimiento

Se definió una única fuente de verdad para el día de vencimiento:

1. `billingDay` del enrollment
2. `operations.defaultBillingDay` del centro
3. fallback a día `10`

Se agregó soporte en:

- [src/lib/types.ts](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/lib/types.ts)
- [src/pages/app/SettingsPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/SettingsPage.tsx)

## Funciones principales agregadas

En [src/lib/academyBilling.ts](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/lib/academyBilling.ts):

- `loadAcademyBillingSnapshot`
- `generateFeeForEnrollmentPeriod`
- `generateMonthlyFeesForCenter`
- `registerPayment`
- `buildReminderLink`
- helpers de período, vencimiento, montos y estados

## Cambios por pantalla

### Resumen

Archivo:

- [src/pages/app/AcademyDashboardPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/AcademyDashboardPage.tsx)

Cambio:

- ahora usa cuotas del período actual como base de cálculo.

Métricas alineadas:

- cobrado
- saldo pendiente
- alumnos activos
- cuotas cerradas
- tasa cobrada
- por vencer
- vencidas

### Alumnos

Archivo:

- [src/pages/app/StudentsPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/StudentsPage.tsx)

Cambios:

- al guardar, crea o reactiva enrollments
- desactiva enrollments que se hayan quitado
- genera cuota inicial del período actual
- mantiene `disciplines` embebidas en el alumno como snapshot compatible

Mejoras UX hechas:

- modal reorganizado como flujo operativo
- asignación de disciplina arriba
- datos básicos en segundo lugar
- datos secundarios colapsables
- copy orientado a generación de cuota

### Disciplinas

Archivo:

- [src/pages/app/DisciplinesPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/DisciplinesPage.tsx)

Cambios:

- pantalla alineada al modelo de valor base
- muestra alumnos asociados
- muestra ingreso potencial estimado
- aclara que cambiar precio afecta solo cuotas futuras

### Cuotas

Archivo:

- [src/pages/app/FeesPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/FeesPage.tsx)

Cambios de negocio:

- ya no se depende de editar manualmente `paidAmount`
- registrar pago crea documentos en `payments`
- el estado y saldo se recalculan automáticamente
- se ejecuta generación mensual al cargar datos

Cambios UX:

- título cambiado a `Cobranza del mes`
- copy más operativo
- tabla simplificada
- CTA principal por fila: `Registrar pago`
- `WhatsApp` pasó a `Enviar recordatorio`
- estado vacío orientado a acción

Limitación actual:

- el botón `Generar cuotas del mes` sí ejecuta lógica, pero aún le falta mejor feedback explícito sobre cuántas cuotas generó o si no había nada para generar.

### Configuración

Archivo:

- [src/pages/app/SettingsPage.tsx](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/src/pages/app/SettingsPage.tsx)

Cambio:

- se agregó edición del día de vencimiento por defecto del centro.

## Reglas de compatibilidad mantenidas

Para no romper la app actual:

- no se eliminó `students.disciplines`
- se siguen guardando campos antiguos en `disciplines`
- se reutilizaron pantallas existentes en vez de rehacer todo
- se preservó la estética dark/cyan del producto

## Reglas nuevas en Firestore

Archivo:

- [firestore.rules](/C:/Users/Usuario/Desktop/Proyectos/PaysSync-SaaS-2.0/firestore.rules)

Cambio:

- se habilitó la colección `academies/{academyId}/enrollments/{enrollmentId}`

## Qué quedó resuelto

- asignación alumno -> disciplina con entidad real
- generación automática de cuota inicial
- base reutilizable para generación mensual
- pago parcial y total con trazabilidad
- actualización consistente de estados
- resumen alineado al ciclo actual
- pantalla de cuotas más operativa
- día de vencimiento configurable

## Qué falta o conviene seguir

### Prioridad alta

- feedback explícito en `Generar cuotas del mes`
- alerta visible para owner cuando existan cuotas vencidas
- aviso si no hay enrollments y el botón de generación no puede crear nada

### Prioridad media

- filtros extra en cuotas
- filtros más ricos en alumnos
- vista de detalle de cuota con historial de pagos
- badge más claro de recordatorio enviado / no enviado

### Prioridad futura

- recargos manuales o automáticos
- automatización real mensual por trigger o cloud function
- alertas automáticas internas
- recordatorios automatizados

## Casos a tener presentes

- si no hay enrollments activos, `generateMonthlyFeesForCenter` no crea nada
- si la cuota del período ya existe, no se duplica
- si cambia el valor de una disciplina, las cuotas viejas no se modifican
- si el pago supera el saldo, se bloquea

## Verificación realizada

Se ejecutó:

```bash
npx tsc -b
npm run build
```

Resultado:

- compilación TypeScript correcta
- build de producción correcta

## Siguiente paso recomendado

La siguiente mejora con más impacto UX es:

1. dar feedback real al botón `Generar cuotas del mes`
2. sumar alerta visible para cuotas vencidas en dashboard y/o cuotas
3. mostrar cuántas cuotas se generaron o por qué no se generó ninguna
