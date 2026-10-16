export function validateProviderRegistration({ providerType, companyName } = {}) {
  const type = providerType || "INDIVIDUAL";
  if (!["INDIVIDUAL", "COMPANY"].includes(type)) {
    return { error: "Choose a supported provider account type." };
  }

  const normalizedCompanyName = typeof companyName === "string" ? companyName.trim() : "";
  if (type === "COMPANY" && !normalizedCompanyName) {
    return { error: "Enter your company or business name." };
  }
  if (type === "COMPANY" && normalizedCompanyName.length > 120) {
    return { error: "Company or business name must be 120 characters or fewer." };
  }

  return {
    error: null,
    providerType: type,
    companyName: type === "COMPANY" ? normalizedCompanyName : null
  };
}
