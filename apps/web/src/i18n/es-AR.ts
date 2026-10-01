// App copy - single es-AR dictionary; components never hard-code user-facing text.
export const esAR = {
  app: {
    name: 'Mesa de Entrada Digital',
    description: 'Panel de mensajería de la Municipalidad de Epuyén',
    organization: 'Municipalidad de Epuyén',
  },
  auth: {
    login: {
      title: 'Ingresar al panel',
      subtitle: 'Usá el email y la contraseña que te dio la Municipalidad.',
      emailLabel: 'Email',
      passwordLabel: 'Contraseña',
      submit: 'Ingresar',
      submitting: 'Ingresando…',
    },
    errors: {
      invalidEmail: 'Ingresá un email válido.',
      passwordRequired: 'Ingresá tu contraseña.',
      invalidCredentials: 'Email o contraseña incorrectos.',
      inactive: 'Tu usuario está desactivado. Consultá con un administrador.',
      noProfile: 'Tu usuario no tiene un perfil asignado.',
    },
  },
  nav: {
    label: 'Navegación principal',
    inbox: 'Mensajería',
    citizens: 'Pobladores',
    tasks: 'Tareas',
    settings: 'Configuración',
    support: 'Soporte',
  },
  userMenu: {
    open: 'Abrir menú de usuario',
    profile: 'Mi perfil',
    signOut: 'Cerrar sesión',
  },
  roles: {
    admin: 'Administración',
    area_lead: 'Responsable de área',
    operator: 'Operador',
    support: 'Soporte',
  },
  emptyStates: {
    inbox: {
      title: 'Todavía no hay conversaciones',
      description: 'Cuando los pobladores escriban por WhatsApp, sus mensajes van a aparecer acá.',
    },
    citizens: {
      title: 'Todavía no hay pobladores cargados',
      description: 'El padrón de pobladores se va a armar a partir de las conversaciones.',
    },
    tasks: {
      title: 'No hay tareas pendientes',
      description: 'Las tareas derivadas de las conversaciones se van a listar acá.',
    },
  },
  forbidden: {
    title: 'No tenés permiso para ver esta sección.',
    description: 'Si necesitás acceso, pedíselo a un administrador.',
    back: 'Volver a Mensajería',
  },
} as const;
