import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = getConfig();
    
    // 返回配置（隐藏敏感信息）
    return NextResponse.json({
      api: {
        baseUrl: config.api.baseUrl,
        expertModel: config.api.expertModel,
        hasApiKey: !!config.api.key,
      },
      security: {
        hasPassword: !!config.security.accessPassword,
      },
      server: {
        port: config.server.port,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
