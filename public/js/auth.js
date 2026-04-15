import {
  attachImagePreview,
  bindRippleEffects,
  clearSession,
  getStoredUser,
  getToken,
  request,
  setSession,
  showToast
} from '/js/api.js';

export const hydrateUser = async () => {
  const token = getToken();

  if (!token) {
    return null;
  }

  try {
    const { user } = await request('/auth/me');
    setSession({ token, user });
    return user;
  } catch (error) {
    clearSession();
    return null;
  }
};

export const requireAuth = async () => {
  const user = (await hydrateUser()) || getStoredUser();

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return user;
};

const renderAuthNav = (user) => {
  document.querySelectorAll('[data-auth-nav]').forEach((node) => {
    node.innerHTML = user
      ? `
          <a class="btn btn-ghost" href="/dashboard">Dashboard</a>
          <button class="btn btn-primary" type="button" data-logout>Logout</button>
        `
      : `
          <a class="btn btn-ghost" href="/login">Login</a>
          <a class="btn btn-primary" href="/register">Register</a>
        `;
  });

  document.querySelectorAll('[data-auth-user]').forEach((node) => {
    node.textContent = user ? user.name : 'Guest';
  });

  document.querySelectorAll('[data-auth-state]').forEach((node) => {
    node.dataset.authState = user ? 'authenticated' : 'guest';
  });
};

const setupLogout = () => {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-logout]');

    if (!button) {
      return;
    }

    clearSession();
    showToast('You have been logged out.', 'success');
    window.setTimeout(() => {
      window.location.href = '/';
    }, 400);
  });
};

const setupLoginForm = () => {
  const form = document.querySelector('#login-form');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    try {
      const data = await request('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password')
        })
      });

      setSession(data);
      showToast('Welcome back.', 'success');
      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

const setupRegisterForm = () => {
  const form = document.querySelector('#register-form');

  if (!form) {
    return;
  }

  attachImagePreview(
    document.querySelector('#profileImage'),
    document.querySelector('#profile-preview')
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = new FormData(form);

    try {
      const data = await request('/auth/register', {
        method: 'POST',
        auth: false,
        body
      });

      setSession(data);
      showToast('Account created successfully.', 'success');
      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

const init = async () => {
  bindRippleEffects();
  setupLogout();
  setupLoginForm();
  setupRegisterForm();

  const user = getToken() ? await hydrateUser() : null;
  renderAuthNav(user);
};

document.addEventListener('DOMContentLoaded', init);
