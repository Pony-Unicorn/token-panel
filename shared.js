// shared.js

// 1. Axios instance (same-origin API calls)
const api = axios.create({ timeout: 30000 });

// 2. API definitions
const groupApi = {
  getAll: () => api.get("/api/groups").then((r) => r.data),
  update: (groups) => api.put("/api/groups", groups).then((r) => r.data),
};

const priceApi = {
  getAll: () => api.get("/api/prices").then((r) => r.data),
};

// 3. Alpine Store (Toast)
const TOAST_MAX = 5;

document.addEventListener("alpine:init", () => {
  Alpine.store("toast", {
    items: [],
    show(msg, type = "success") {
      const id = Date.now();
      this.items.push({ id, message: msg, type });
      if (this.items.length > TOAST_MAX) this.items.shift();
      setTimeout(() => {
        this.items = this.items.filter((t) => t.id !== id);
      }, 3000);
    },
  });
});

// 4. Global utils
const toast = (msg, type) => Alpine.store("toast").show(msg, type);
