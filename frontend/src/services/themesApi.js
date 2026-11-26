import api from "@/services/api";

const adminHeaders = (adminKey) => ({ headers: { "X-ADMIN-KEY": adminKey } });

export const themesAPI = {
  active: async () => (await api.get("/themes/active")).data,
};

export const adminThemesAPI = {
  list: async (adminKey) => (await api.get("/admin/themes", adminHeaders(adminKey))).data,
  update: async (adminKey, key, body) => (await api.put(`/admin/themes/${key}`, body, adminHeaders(adminKey))).data,
};
