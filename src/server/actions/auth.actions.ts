'use server';

import * as authService from '@/features/auth/auth.service';
import { signUpSchema, signInSchema, signOutSchema } from '@/features/auth/auth.schemas';
import { createApiResponse, createApiError, ApiResponse } from '@/lib/errors';

export async function handleAuthSignUp(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = signUpSchema.parse(input);
    const session = await authService.handleSignUp(parsed.email, parsed.password, parsed.name);
    return createApiResponse(session);
  } catch (error) {
    return createApiError(error);
  }
}

export async function handleAuthSignIn(input: unknown): Promise<ApiResponse> {
  try {
    const parsed = signInSchema.parse(input);
    const session = await authService.handleSignIn(parsed.email, parsed.password);
    return createApiResponse(session);
  } catch (error) {
    return createApiError(error);
  }
}

export async function handleAuthSignOut(input: unknown): Promise<ApiResponse> {
  try {
    signOutSchema.parse(input);
    await authService.handleSignOut();
    return createApiResponse({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

export async function getCurrentAuthUser(): Promise<ApiResponse> {
  try {
    const user = await authService.getAuthenticatedUser();
    if (!user) {
      return createApiResponse(null);
    }
    return createApiResponse(user);
  } catch (error) {
    return createApiError(error);
  }
}
