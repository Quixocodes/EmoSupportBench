import fs from 'fs';
import path from 'path';

interface Config {
  api: {
    key: string;
    baseUrl: string;
    expertModel: string;
  };
  security: {
    accessPassword: string;
  };
  server: {
    port: number;
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public loadConfig(): Config {
    if (this.config) {
      return this.config;
    }

    try {
      let loadedConfig: Config;

      // 首先尝试读取 config.json
      if (fs.existsSync(this.configPath)) {
        const configFile = fs.readFileSync(this.configPath, 'utf-8');
        loadedConfig = JSON.parse(configFile);
        console.log('✅ 配置文件加载成功:', this.configPath);
      } else {
        // 如果不存在，使用默认配置
        console.warn('⚠️  config.json 不存在，使用默认配置');
        loadedConfig = this.getDefaultConfig();
      }

      // 验证配置
      this.validateConfig(loadedConfig);

      // 赋值并返回
      this.config = loadedConfig;
      return this.config;
    } catch (error) {
      console.error('❌ 配置文件读取失败:', error);
      throw new Error('无法读取配置文件，请检查 config.json 是否存在且格式正确');
    }
  }

  private getDefaultConfig(): Config {
    return {
      api: {
        key: process.env.OPENROUTER_API_KEY || '',
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        expertModel: process.env.EXPERT_MODEL || 'openai/gpt-4',
      },
      security: {
        accessPassword: process.env.ACCESS_PASSWORD || '',
      },
      server: {
        port: parseInt(process.env.PORT || '3000'),
      },
    };
  }

  private validateConfig(config: Config): void {
    if (!config.api.key) {
      console.warn('⚠️  API Key 未配置，某些功能可能无法使用');
    }
    if (!config.api.baseUrl) {
      throw new Error('API Base URL 不能为空');
    }
    if (!config.api.expertModel) {
      throw new Error('Expert Model 不能为空');
    }
  }

  public getConfig(): Config {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  public getApiKey(): string {
    return this.getConfig().api.key;
  }

  public getBaseUrl(): string {
    return this.getConfig().api.baseUrl;
  }

  public getExpertModel(): string {
    return this.getConfig().api.expertModel;
  }

  public getAccessPassword(): string {
    return this.getConfig().security.accessPassword;
  }

  public getPort(): number {
    return this.getConfig().server.port;
  }

  // 重新加载配置
  public reloadConfig(): Config {
    this.config = null;
    return this.loadConfig();
  }
}

export const configManager = ConfigManager.getInstance();

// 导出便捷函数
export const getConfig = () => configManager.getConfig();
export const getApiKey = () => configManager.getApiKey();
export const getBaseUrl = () => configManager.getBaseUrl();
export const getExpertModel = () => configManager.getExpertModel();
export const getAccessPassword = () => configManager.getAccessPassword();
