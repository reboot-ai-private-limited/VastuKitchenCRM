import type {
  ChangePasswordBodyDto,
  LoginBodyDto,
  LoginResponseDto,
  OtpRequestBodyDto,
  OtpVerifyBodyDto,
  UserDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const requestOtp = (body: OtpRequestBodyDto) =>
  request<void>('POST', '/identity/auth/otp/request', body, { anonymous: true });

export const verifyOtp = (body: OtpVerifyBodyDto) =>
  request<LoginResponseDto>('POST', '/identity/auth/otp/verify', body, { anonymous: true });

export const loginPassword = (body: LoginBodyDto) =>
  request<LoginResponseDto>('POST', '/identity/auth/login', body, { anonymous: true });

export const logout = (refreshToken: string) =>
  request<void>('POST', '/identity/auth/logout', { refreshToken }, { anonymous: true });

export const getMe = (signal?: AbortSignal) =>
  request<UserDto>('GET', '/identity/auth/me', undefined, { signal });

export const changePassword = (body: ChangePasswordBodyDto) =>
  request<void>('POST', '/identity/auth/change-password', body);

export const redeemInvite = (token: string) =>
  request<LoginResponseDto>('POST', '/identity/auth/invite/redeem', { token }, { anonymous: true });
