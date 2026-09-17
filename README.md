# Clase Graduanda PR

Sistema general para colegios en Puerto Rico para administrar estudiantes, cuotas, actividades y balances mensuales.

## Módulos

- Estudiantes
  - Nombre del estudiante
  - Teléfono
  - Nombre del padre/madre/encargado
  - Email
- Cuotas
  - Concepto
  - Monto asignado
  - Pagado
  - Balance
  - Fecha
- Actividades
  - Actividad
  - Cargo
  - Pagado
  - Balance
  - Fecha
- Reporte mensual del colegio
  - Total cuotas
  - Total actividades
  - Total cobrado
  - Total pendiente
  - Detalle por estudiante
  - Envío por email

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```

Luego abre:

http://localhost:3000

## Email

El sistema usa SMTP con Nodemailer.

Para Gmail se recomienda usar una App Password en vez de la contraseña normal.

## Diseño de datos

Los balances se calculan automáticamente como:

`monto asignado - pagado`

El reporte consolidado suma cuotas y actividades dentro del mes seleccionado.

## Próximas mejoras sugeridas

- Login por administrador
- Multi-colegio
- Portal para padres
- Pago online
- Recibos PDF
- Importación CSV
- Roles y permisos
- Backup automático
