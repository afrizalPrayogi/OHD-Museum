import { NextResponse } from 'next/server';

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export function apiSuccess<T = any>(
  data: T,
  message = 'Request berhasil diproses',
  meta?: ApiResponseMeta,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

export function apiCreated<T = any>(data: T, message = 'Data berhasil dibuat') {
  return apiSuccess(data, message, undefined, 201);
}

export function apiBadRequest(message = 'Input data tidak valid', errors?: any) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(errors ? { errors } : {}),
    },
    { status: 400 }
  );
}

export function apiUnauthorized(message = 'Autentikasi diperlukan atau token tidak valid') {
  return NextResponse.json(
    {
      success: false,
      message,
      error: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

export function apiForbidden(message = 'Akses ditolak: izin tidak memadai') {
  return NextResponse.json(
    {
      success: false,
      message,
      error: 'FORBIDDEN',
    },
    { status: 403 }
  );
}

export function apiNotFound(message = 'Data yang diminta tidak ditemukan') {
  return NextResponse.json(
    {
      success: false,
      message,
      error: 'NOT_FOUND',
    },
    { status: 404 }
  );
}

export function apiError(message = 'Terjadi kesalahan pada server internal', error?: any) {
  console.error('API Server Error:', error);
  return NextResponse.json(
    {
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && error ? { details: String(error) } : {}),
    },
    { status: 500 }
  );
}
