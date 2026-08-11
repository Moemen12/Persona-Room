import * as authRepo from './auth.repository';
import { AuthSession, AuthUser } from './auth.types';

export async function handleSignUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthSession> {
  // Validate inputs
  if (!email || !password || !name) {
    throw new Error('Email, password, and name are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return await authRepo.signUp(email, password, name);
}

export async function handleSignIn(email: string, password: string): Promise<AuthSession> {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  return await authRepo.signIn(email, password);
}

export async function handleSignOut(): Promise<void> {
  return await authRepo.signOut();
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  return await authRepo.getCurrentUser();
}

export async function fetchUserById(userId: string): Promise<AuthUser | null> {
  return await authRepo.getUserById(userId);
}
