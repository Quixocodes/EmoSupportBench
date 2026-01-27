import { NextRequest, NextResponse } from 'next/server';
import { getAccessPassword } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const accessPassword = getAccessPassword();

    // 如果没有设置密码，直接通过
    if (!accessPassword) {
      return NextResponse.json({ success: true });
    }

    // 验证密码
    if (password === accessPassword) {
      const response = NextResponse.json({ success: true });
      
      // 设置 cookie，30 天过期
      response.cookies.set('access_password', password, {
        httpOnly: true,
        secure: false, // 改为 false，允许 HTTP 环境使用
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 天
        path: '/', // 添加 path
      });

      return response;
    }

    return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: '请求失败' }, { status: 500 });
  }
}
