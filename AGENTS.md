# Codex: comercio-web

Lee `../AGENTS.md`, el `package.json` de este proyecto y `../.github/memory/business-rules.md` antes de modificar flujos comerciales. Si el cambio afecta un contrato Meteor, confirma la implementación del backend y sus consumidores.

Este cliente Vite/React es independiente de `react-download/`: confirma aquí las versiones y APIs disponibles en vez de trasladar patrones del React 16 legacy. Mantén estados de carga, error, vacío, permisos y éxito; no expongas acciones de administración a usuarios de empresa.

Valida con `npm test` y `npm run build` desde esta carpeta, según el alcance.
