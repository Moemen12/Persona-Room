import { createServerClient, createAdminClient } from '@/infrastructure/database/supabase';
import { AuthUser, AuthSession } from './auth.types';

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthSession> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Sign up failed');

  return {
    user: {
      id: data.user.id,
      email: data.user.email || '',
      name: name,
      createdAt: new Date(data.user.created_at),
      updatedAt: new Date(data.user.updated_at),
    },
    accessToken: data.session?.access_token || '',
    refreshToken: data.session?.refresh_token,
  };
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Sign in failed');

  return {
    user: {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata?.name || '',
      createdAt: new Date(data.user.created_at),
      updatedAt: new Date(data.user.updated_at),
    },
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || '',
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || '',
    name: data.user.user_metadata?.name || '',
    createdAt: new Date(data.user.created_at),
    updatedAt: new Date(data.user.updated_at),
  };
}
