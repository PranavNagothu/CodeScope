const CONFIG = {
  API_URL:
    window.location.hostname === '' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/graphql'
      : 'https://codescope-e4rj.onrender.com/graphql',
};

async function gql(query, variables = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (networkErr) {
    throw new Error(
      `Cannot reach the backend at ${CONFIG.API_URL}. ` +
      `Make sure the server is running.`
    );
  }

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

const Auth = {
  getToken: () => localStorage.getItem('cs_token'),
  getUser: () => JSON.parse(localStorage.getItem('cs_user') || 'null'),
  setSession(token, user) {
    localStorage.setItem('cs_token', token);
    localStorage.setItem('cs_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
  },
  isLoggedIn: () => !!localStorage.getItem('cs_token'),
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'auth.html';
      return false;
    }
    return true;
  },
};

function toast(message, type = 'info') {
  const colors = { info: '#6366f1', success: '#10b981', error: '#ef4444', warn: '#f59e0b' };
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;padding:14px 20px;border-radius:10px;
    background:${colors[type]};color:#fff;font-size:14px;font-weight:500;
    box-shadow:0 10px 30px rgba(0,0,0,0.4);z-index:9999;
    animation:slideInRight 0.3s ease;max-width:320px;line-height:1.4;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function setLoading(btn, loading, text = '') {
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || text;
  }
}

const SEVERITY_COLOR = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#6366f1',
};
const TYPE_ICON = {
  bug: '🐛', security: '🔒', performance: '⚡', style: '🎨', maintainability: '🔧', complexity: '🧩',
};
const LANG_ICON = {
  javascript: '🟨', typescript: '🔷', python: '🐍', java: '☕', go: '🐹', rust: '🦀', cpp: '⚙️',
};

function scoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderNav() {
  const user = Auth.getUser();
  const navUser = document.getElementById('nav-user');
  if (!navUser) return;
  if (user) {
    navUser.innerHTML = `
      <span class="nav-username">${user.username}</span>
      <a href="dashboard.html" class="btn-nav">Dashboard</a>
      <button class="btn-nav btn-nav-ghost" onclick="logout()">Logout</button>
    `;
  } else {
    navUser.innerHTML = `
      <a href="auth.html" class="btn-nav btn-nav-ghost">Login</a>
      <a href="auth.html?mode=register" class="btn-nav">Try Free</a>
    `;
  }
}

function logout() {
  Auth.clear();
  window.location.href = 'index.html';
}
