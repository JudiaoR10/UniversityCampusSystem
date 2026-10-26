/**
 * No desenvolvimento, o Vite encaminha estas chamadas para a API.
 * Em produção, a aplicação e a API são servidas pelo mesmo domínio.
 */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
