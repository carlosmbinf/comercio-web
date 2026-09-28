export const EMPRESA_TERMS = [
  "No se pueden publicar drogas, armas, municiones ni artículos destinados a causar daño.",
  "No se permiten productos robados, falsificados, ilegales, peligrosos o sujetos a permisos especiales sin autorización válida.",
  "No publiques medicamentos controlados, sustancias reguladas, documentos oficiales, servicios fraudulentos ni contenido sexual explícito.",
  "VIDKAR puede retirar productos, bloquear tiendas o suspender el modo empresa si detecta incumplimientos.",
];

export const hasEmpresaRole = (user) => {
  const roleComercio = user?.profile?.roleComercio;
  const roles = Array.isArray(roleComercio) ? roleComercio : [roleComercio];
  return roles.includes("EMPRESA");
};

export const isConfiguredCommerceOwner = (user, ownerId) =>
  Boolean(user?._id && ownerId && String(user._id) === String(ownerId));

export const canManageEmpresaFromWeb = (user, ownerId) =>
  isConfiguredCommerceOwner(user, ownerId) &&
  user?.empresaBloqueada !== true &&
  user?.empresaTerminosCondicionesAcepted === true &&
  hasEmpresaRole(user);

export const getEmpresaAccessState = (user, ownerId) => {
  if (!isConfiguredCommerceOwner(user, ownerId)) return "not-owner";
  if (user.empresaBloqueada === true) return "blocked";
  if (user.empresaTerminosCondicionesAcepted === true && hasEmpresaRole(user)) return "active";
  if (user.permiteEmpresa === true && user.empresaTerminosCondicionesAcepted !== true) return "terms";
  return "not-enabled";
};

export const getNextPreparationStatus = (status) => {
  if (status === "PENDIENTE") return "PREPARANDO";
  if (status === "PREPARANDO") return "PREPARACION_LISTO";
  return "";
};

export const ensureEmpresaMethodSuccess = (result) => {
  if (result instanceof Error) throw result;

  if (result && typeof result === "object" && !Array.isArray(result)) {
    if (result.success === false) {
      throw new Error(result.reason || result.message || result.error || "No se pudo completar la operación.");
    }

    if (result.error) {
      const message = typeof result.error === "string"
        ? result.error
        : result.error.reason || result.error.message;
      throw new Error(message || "No se pudo completar la operación.");
    }
  }

  return result;
};