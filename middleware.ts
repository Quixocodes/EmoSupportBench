import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;

export function middleware(request: NextRequest) {
  // 如果没有设置密码，直接放行
  if (!ACCESS_PASSWORD) {
    return NextResponse.next();
  }

  // 检查 cookie 中的密码
  const cookiePassword = request.cookies.get('access_password')?.value;

  // 如果密码正确，放行
  if (cookiePassword === ACCESS_PASSWORD) {
    return NextResponse.next();
  }

  // 如果是登录页面，放行
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // 如果是登录 API，放行
  if (request.nextUrl.pathname === '/api/login') {
    return NextResponse.next();
  }

  // 否则重定向到登录页
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
