const API_BASE = '/api';

const getToastContainer = () => {
  let container = document.querySelector('.toast-container');

  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  return container;
};

export const getToken = () => localStorage.getItem('lf_token');

export const setSession = ({ token, user }) => {
  if (token) {
    localStorage.setItem('lf_token', token);
  }

  if (user) {
    localStorage.setItem('lf_user', JSON.stringify(user));
  }
};

export const clearSession = () => {
  localStorage.removeItem('lf_token');
  localStorage.removeItem('lf_user');
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('lf_user') || 'null');
  } catch (error) {
    return null;
  }
};

export const escapeHtml = (value = '') =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

export const formatDateTime = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

export const debounce = (callback, delay = 350) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
};

export const showToast = (message, type = 'info') => {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<strong>${type === 'error' ? 'Error' : 'Notice'}</strong><span>${escapeHtml(
    message
  )}</span>`;

  getToastContainer().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 240);
  }, 3600);
};

export const request = async (path, options = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && options.auth !== false) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) {
      clearSession();
    }

    throw new Error(data.message || 'Request failed');
  }

  return data;
};

export const bindRippleEffects = (root = document) => {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('.btn, .icon-btn');

    if (!button) {
      return;
    }

    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    ripple.className = 'ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    button.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 600);
  });
};

export const createSkeletonCards = (container, count = 3) => {
  container.innerHTML = Array.from({ length: count })
    .map(
      () => `
        <article class="item-card skeleton-card">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line"></div>
        </article>
      `
    )
    .join('');
};

export const attachImagePreview = (input, preview) => {
  if (!input || !preview) {
    return;
  }

  input.addEventListener('change', () => {
    const [file] = input.files || [];

    if (!file) {
      preview.src = '/placeholder.svg';
      return;
    }

    preview.src = URL.createObjectURL(file);
  });
};

export const initials = (name = 'U') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export const makeAvatar = (user = {}) => {
  if (user.profileImage) {
    return `<img src="${user.profileImage}" alt="${escapeHtml(user.name || 'User')}" loading="lazy" />`;
  }

  return `<span>${escapeHtml(initials(user.name))}</span>`;
};
