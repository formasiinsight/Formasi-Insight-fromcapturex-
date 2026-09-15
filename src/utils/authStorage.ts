import { AuthUser } from '../types';

const USERS_STORAGE_KEY = 'sscasn_users_v27';
const AUTH_SESSION_KEY = 'sscasn_active_session_v27';

export const ADMIN_EMAIL = 'faizcapturex@gmail.com';
export const ADMIN_DEFAULT_PASSWORD = '@Dmin1357';

export const INITIAL_AUTH_USERS: AuthUser[] = [
  {
    id: 'usr-admin-1',
    name: 'Faiz CaptureX',
    email: 'faizcapturex@gmail.com',
    password: '@Dmin1357',
    role: 'admin',
    instansi: 'Pusat (SSCASN BKN)',
    status: 'active',
    avatarColor: 'from-indigo-500 via-purple-500 to-pink-500',
    createdAt: '2024-01-01',
    lastLogin: 'Baru saja',
  },
  {
    id: 'usr-user-2',
    name: 'Budi Santoso, S.Kom',
    email: 'budi.santoso@sscasn.go.id',
    password: 'user123',
    role: 'user',
    instansi: 'BKPSDM Pemkab Jember',
    status: 'active',
    avatarColor: 'from-blue-500 to-cyan-500',
    createdAt: '2024-02-15',
    lastLogin: '2 jam lalu',
  },
  {
    id: 'usr-user-3',
    name: 'Siti Nurhaliza, M.Si',
    email: 'siti.nurhaliza@bkn.go.id',
    password: 'user123',
    role: 'user',
    instansi: 'Deputi Pengadaan BKN',
    status: 'active',
    avatarColor: 'from-emerald-500 to-teal-500',
    createdAt: '2024-03-10',
    lastLogin: 'Kemarin',
  },
  {
    id: 'usr-user-4',
    name: 'Rian Pratama',
    email: 'rian.pratama@pemkab.go.id',
    password: 'user123',
    role: 'user',
    instansi: 'Pemprov Jawa Timur',
    status: 'inactive',
    avatarColor: 'from-amber-500 to-orange-500',
    createdAt: '2024-04-05',
    lastLogin: '3 hari lalu',
  },
];

export function getStoredUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_AUTH_USERS));
      return INITIAL_AUTH_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure admin account always exists and has admin role
      const adminExists = parsed.some(
        (u: AuthUser) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
      if (!adminExists) {
        const withAdmin = [INITIAL_AUTH_USERS[0], ...parsed];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(withAdmin));
        return withAdmin;
      }
      return parsed;
    }
    return INITIAL_AUTH_USERS;
  } catch (err) {
    console.error('Failed to load users from storage:', err);
    return INITIAL_AUTH_USERS;
  }
}

export function saveStoredUsers(users: AuthUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users to storage:', err);
  }
}

export function getCurrentSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const user: AuthUser = JSON.parse(raw);
    // Verify user still exists in database and is active
    const users = getStoredUsers();
    const existing = users.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (!existing || existing.status !== 'active') {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return existing;
  } catch (err) {
    console.error('Failed to parse current session:', err);
    return null;
  }
}

export function setCurrentSession(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    }
    // Dispatch auth state change event for real-time reactivity
    window.dispatchEvent(new CustomEvent('sscasn_auth_change', { detail: user }));
  } catch (err) {
    console.error('Failed to update auth session:', err);
  }
}

export function loginUser(email: string, password: string): { success: boolean; user?: AuthUser; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Email dan password wajib diisi.' };
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return { success: false, error: 'Pengguna dengan email ini tidak ditemukan.' };
  }

  if (user.password !== cleanPassword) {
    return { success: false, error: 'Password yang dimasukkan salah.' };
  }

  if (user.status !== 'active') {
    return { success: false, error: 'Akun ini sedang dinonaktifkan. Hubungi Administrator.' };
  }

  // Update last login time
  const updatedUser: AuthUser = {
    ...user,
    lastLogin: 'Baru saja',
  };

  const updatedUsers = users.map((u) => (u.id === user.id ? updatedUser : u));
  saveStoredUsers(updatedUsers);
  setCurrentSession(updatedUser);

  return { success: true, user: updatedUser };
}

export function logoutUser(): void {
  setCurrentSession(null);
}

export function addUser(newUser: Omit<AuthUser, 'id' | 'createdAt'>): { success: boolean; user?: AuthUser; error?: string } {
  const users = getStoredUsers();
  const emailLower = newUser.email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === emailLower)) {
    return { success: false, error: 'Email sudah terdaftar untuk pengguna lain.' };
  }

  // Auto assign avatar gradient
  const gradients = [
    'from-indigo-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-fuchsia-600',
  ];
  const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

  // Force Admin role only for faizcapturex@gmail.com, or as specified
  const isTargetAdmin = emailLower === ADMIN_EMAIL.toLowerCase();

  const user: AuthUser = {
    ...newUser,
    id: `usr-${Date.now()}`,
    email: emailLower,
    role: isTargetAdmin ? 'admin' : newUser.role,
    avatarColor: newUser.avatarColor || (newUser.role === 'admin' ? 'from-indigo-500 via-purple-500 to-pink-500' : randomGradient),
    createdAt: new Date().toISOString().split('T')[0],
    lastLogin: 'Belum pernah login',
  };

  const updated = [user, ...users];
  saveStoredUsers(updated);
  return { success: true, user };
}

export function updateUser(id: string, updates: Partial<AuthUser>): { success: boolean; user?: AuthUser; error?: string } {
  const users = getStoredUsers();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return { success: false, error: 'Pengguna tidak ditemukan.' };
  }

  if (updates.email) {
    const emailLower = updates.email.trim().toLowerCase();
    const conflict = users.some((u) => u.id !== id && u.email.toLowerCase() === emailLower);
    if (conflict) {
      return { success: false, error: 'Email sudah digunakan oleh akun lain.' };
    }
  }

  // Protect main admin email from role downgrade
  let role = updates.role !== undefined ? updates.role : user.role;
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    role = 'admin';
  }

  const updatedUser: AuthUser = {
    ...user,
    ...updates,
    role,
    email: updates.email ? updates.email.trim().toLowerCase() : user.email,
  };

  const updatedList = users.map((u) => (u.id === id ? updatedUser : u));
  saveStoredUsers(updatedList);

  // If editing currently logged in session, update session too
  const currentSession = getCurrentSession();
  if (currentSession && currentSession.id === id) {
    setCurrentSession(updatedUser);
  }

  return { success: true, user: updatedUser };
}

export function deleteUser(id: string): { success: boolean; error?: string } {
  const users = getStoredUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return { success: false, error: 'Pengguna tidak ditemukan.' };
  }

  if (target.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: 'Akun Administrator Utama tidak boleh dihapus.' };
  }

  const filtered = users.filter((u) => u.id !== id);
  saveStoredUsers(filtered);
  return { success: true };
}
