// lib/openrouter.ts
import { getApiKey, getBaseUrl, getExpertModel } from './config';
import { getServerTranslation } from './i18n/server';

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 请求计数器（用于日志）
let requestCounter = 0;

export async function callOpenRouter(
  model: string, 
  messages: Array<{ role: string; content: string }>,
  retryCount = 0
): Promise<string> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  const requestId = ++requestCounter;

  if (!apiKey) {
    throw new Error('API Key 未配置，请在 config.json 中设置 api.key');
  }

  // 记录请求开始
  const startTime = Date.now();
  console.log(`[OpenRouter Request #${requestId}] 开始请求`);
  console.log(`  - 模型: ${model}`);
  console.log(`  - 消息数量: ${messages.length}`);
  console.log(`  - 重试次数: ${retryCount}/${MAX_RETRIES}`);
  console.log(`  - 时间: ${new Date().toLocaleTimeString()}`);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0, 
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter Request #${requestId}] ❌ API错误 (${duration}ms)`);
      console.error(`  - 状态码: ${response.status}`);
      console.error(`  - 错误信息: ${errorText.substring(0, 200)}`);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    // 检查响应是否为空
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.error(`[OpenRouter Request #${requestId}] ❌ 响应为空 (${duration}ms)`);
      throw new Error('Empty response from OpenRouter API');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`[OpenRouter Request #${requestId}] ❌ JSON解析失败 (${duration}ms)`);
      console.error(`  - 响应内容前100字符: ${text.substring(0, 100)}`);
      throw new Error(`Failed to parse JSON response: ${text.substring(0, 100)}`);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error(`[OpenRouter Request #${requestId}] ❌ 响应结构无效 (${duration}ms)`);
      console.error(`  - 响应数据:`, JSON.stringify(data).substring(0, 200));
      throw new Error('Invalid response structure from OpenRouter API');
    }

    const content = data.choices[0].message.content;
    const contentLength = content?.length || 0;
    
    console.log(`[OpenRouter Request #${requestId}] ✅ 请求成功 (${duration}ms)`);
    console.log(`  - 响应长度: ${contentLength} 字符`);
    console.log(`  - Token使用: prompt=${data.usage?.prompt_tokens || 0}, completion=${data.usage?.completion_tokens || 0}, total=${data.usage?.total_tokens || 0}`);
    
    return content;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[OpenRouter Request #${requestId}] ❌ 请求失败 (${duration}ms, attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    console.error(`  - 错误: ${error.message}`);

    // 如果还有重试次数，则重试
    if (retryCount < MAX_RETRIES) {
      const delayTime = RETRY_DELAY * Math.pow(2, retryCount); // 指数退避
      console.log(`[OpenRouter Request #${requestId}] 🔄 将在 ${delayTime}ms 后重试...`);
      await delay(delayTime);
      return callOpenRouter(model, messages, retryCount + 1);
    }

    // 所有重试都失败后抛出错误
    console.error(`[OpenRouter Request #${requestId}] 💀 所有重试均失败，放弃请求`);
    throw error;
  }
}

export async function getModelAnswer(model: string, question: string) {
  console.log(`[getModelAnswer] 调用模型回答问题`);
  console.log(`  - 模型: ${model}`);
  console.log(`  - 问题: ${question.substring(0, 100)}...`);
  
  return await callOpenRouter(model, [
    {
      role: 'user',
      content: question,
    },
  ]);
}

export async function scoreAnswer(question: string, answer: string, dimensionPrompt: string, locale: 'en' | 'zh' = 'en') {
  const expertModel = getExpertModel();
  const t = getServerTranslation(locale);

  console.log(`[scoreAnswer] Calling expert model for scoring`);
  console.log(`  - Expert model: ${expertModel}`);
  console.log(`  - Question length: ${question.length} chars`);
  console.log(`  - Answer length: ${answer.length} chars`);
  console.log(`  - Dimension prompt length: ${dimensionPrompt.length} chars`);
  console.log(`  - Locale: ${locale}`);

  const constraint = t('prompt.scoreConstraint');

  return await callOpenRouter(expertModel, [
    {
      role: 'user',
      content: `${t('prompt.questionLabel')} ${question}\n\n${t('prompt.answerLabel')} ${answer}\n\n${dimensionPrompt}${constraint}`,
    },
  ]);
}
