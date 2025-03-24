import { NextResponse } from 'next/server';

export function middleware() {
  // Get response
  const response = NextResponse.next();

  // Add CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, token',
  );

  return response;
}

// Configure to match all API routes
export const config = {
  matcher: ['/api/:path*'],
};
