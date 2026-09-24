// 模拟鉴权层 —— 仅用于前端骨架，数据存储在 localStorage
// 后续接入 Supabase Auth 时，只需替换 registerUser / loginUser / getCurrentUser 的实现

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

const USERS_KEY = "mock_users";
const CURRENT_USER_KEY = "current_user";

// 用 Web Crypto API 做简单哈希（仅模拟，非生产安全方案）
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "::mock_salt::agent_studio");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function writeCurrentUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

function stripPassword(user: StoredUser): AuthUser {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

// 预置一个管理员账号，方便首次登录后台
export function seedAdminIfNeeded() {
  const users = readUsers();
  if (!users.some((u) => u.email === "admin@example.com")) {
    const admin: StoredUser = {
      id: "admin-seed-001",
      email: "admin@example.com",
      name: "系统管理员",
      role: "admin",
      createdAt: new Date().toISOString(),
      passwordHash: "0", // 占位，首次登录时会懒加载哈希
    };
    users.push(admin);
    writeUsers(users);
  }
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: UserRole = "user"
): Promise<AuthUser> {
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("该邮箱已被注册");
  }

  const passwordHash = await hashPassword(password);
  const newUser: StoredUser = {
    id: `user-${Date.now()}`,
    email,
    name,
    role,
    createdAt: new Date().toISOString(),
    passwordHash,
  };
  users.push(newUser);
  writeUsers(users);

  const safe = stripPassword(newUser);
  writeCurrentUser(safe);
  return safe;
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const users = readUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!found) {
    throw new Error("邮箱或密码错误");
  }

  // 预置管理员的懒加载哈希
  let expectedHash = found.passwordHash;
  if (found.email === "admin@example.com" && expectedHash === "0") {
    expectedHash = await hashPassword("admin123");
    found.passwordHash = expectedHash;
    writeUsers(users);
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== expectedHash) {
    throw new Error("邮箱或密码错误");
  }

  const safe = stripPassword(found);
  writeCurrentUser(safe);
  return safe;
}

export function logout() {
  writeCurrentUser(null);
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// 预置管理员账号密码（仅骨架演示用）
export const DEMO_ADMIN = { email: "admin@example.com", password: "admin123" };
