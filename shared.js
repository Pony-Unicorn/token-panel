// shared.js

// 1. Global Config
const CONFIG = {
  API_BASE: "https://jsonplaceholder.typicode.com",
  TIMEOUT: 60000,
};

// 2. Axios Instance
const api = axios.create({
  baseURL: CONFIG.API_BASE,
  timeout: CONFIG.TIMEOUT,
});

// 3. API Definitions
const postApi = {
  getList: (params) => api.get("/posts", { params }),
  getById: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post("/posts", data),
  update: (id, data) => api.put(`/posts/${id}`, data),
  remove: (id) => api.delete(`/posts/${id}`),
};

const commentApi = {
  getByPost: (postId) => api.get(`/posts/${postId}/comments`),
};

const userApi = {
  getList: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
};

// 4. Alpine Store (Toast)
const TOAST_MAX = 5;

document.addEventListener("alpine:init", () => {
  Alpine.store("toast", {
    items: [],
    show(msg, type = "success") {
      const id = Date.now();
      this.items.push({ id, message: msg, type });
      if (this.items.length > TOAST_MAX) {
        this.items.shift();
      }
      setTimeout(() => {
        this.items = this.items.filter((t) => t.id !== id);
      }, 3000);
    },
  });
});

// 5. Global Utils
const toast = (msg, type) => Alpine.store("toast").show(msg, type);
const formatDate = (date) => dayjs(date).format("YYYY-MM-DD");
