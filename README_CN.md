# EmoSupportBench - LLM 模型评测系统

[English](./README.md) | 中文

一个专业的大语言模型 (LLM) 评测与评分系统，基于 Next.js 16、TypeScript、Tailwind CSS 和 SQLite 构建。支持批量推理、多维度专家评分、竞技场对战等功能，帮助研究者系统化地评估和比较不同 LLM 模型的表现。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [使用指南](#使用指南)
  - [登录系统](#1-登录系统)
  - [管理问题](#2-管理问题)
  - [管理模型](#3-管理模型)
  - [管理评分维度](#4-管理评分维度)
  - [批量推理](#5-批量推理测试)
  - [批量评分](#6-批量评分)
  - [专家评分](#7-专家评分)
  - [竞技场对战](#8-竞技场对战)
  - [批量竞技场](#9-批量竞技场)
  - [数据导出](#10-数据导出)
  - [CSV 数据导入](#11-csv-数据导入)
- [项目结构](#项目结构)
- [API 接口文档](#api-接口文档)
- [数据库结构](#数据库结构)
- [常见问题](#常见问题)
- [生产部署](#生产部署)
- [许可证](#许可证)

---

## 功能特性

### 核心功能

- **模型管理** — 添加、编辑、删除 LLM 模型，支持所有 OpenRouter 兼容的模型
- **问题管理** — 创建和管理评测问题集，支持 CSV 批量导入
- **评分维度管理** — 自定义评分维度及对应的评估提示词（Prompt）
- **批量推理** — 将所有问题发送给指定模型，批量收集回答
- **多维度评分** — 使用专家模型对模型回答进行多维度自动评分
- **竞技场对战** — 多个专家模型交叉评审，意见不一致时由仲裁模型裁决
- **数据导出** — 支持将评测结果导出为 Excel 文件

### 任务管理

- 支持并发执行，可配置最大并发数
- 任务队列支持暂停 / 恢复 / 取消操作
- 失败任务自动重试（指数退避策略）
- 实时进度追踪与错误日志

### 国际化

- 支持中英文双语切换（默认英文）
- 导航栏一键切换语言，偏好自动保存至 localStorage
- 所有 UI 文本、API 提示词均支持双语

### 界面特性

- 响应式设计，适配桌面端和移动端
- 虚拟滚动，支持大数据量列表流畅展示
- 分页加载，优化数据展示性能

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5.9 |
| 样式 | Tailwind CSS 4 |
| 数据库 | SQLite (Node.js 内置 `node:sqlite`) |
| LLM 接口 | OpenRouter API |
| UI 组件 | React 19, React Virtuoso |
| 数据导出 | SheetJS (xlsx) |

---

## 系统要求

- **Node.js** >= 22.0.0（需要内置 `node:sqlite` 模块）
- **npm** >= 9.0.0 或 **yarn** >= 1.22.0
- **OpenRouter API Key**（用于调用 LLM 模型）
- 操作系统：Windows / macOS / Linux

---

## 快速开始

### 1. 克隆或下载项目

```bash
git clone <repository-url>
cd ai-benchmark
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

在项目根目录创建 `.env.local` 文件：

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
EXPERT_MODEL=moonshotai/kimi-k2-thinking
ACCESS_PASSWORD=your_password_here
```

> **说明：** 也可以通过编辑 `config.json` 进行配置，详见 [配置说明](#配置说明)。

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 访问系统

打开浏览器访问 [http://localhost:3000](http://localhost:3000)，输入设置的密码登录。

---

## 配置说明

系统支持两种配置方式，优先级为：`config.json` > `.env.local`。

### 方式一：环境变量 (.env.local)

```env
# OpenRouter API 密钥（必填）
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx

# 专家评分模型（选填，默认 moonshotai/kimi-k2-thinking）
EXPERT_MODEL=moonshotai/kimi-k2-thinking

# 访问密码（选填，留空则不需要密码）
ACCESS_PASSWORD=your_password
```

### 方式二：配置文件 (config.json)

```json
{
  "api": {
    "key": "sk-or-v1-xxxxxxxxxxxxxxxx",
    "baseUrl": "https://openrouter.ai/api/v1",
    "expertModel": "moonshotai/kimi-k2-thinking"
  },
  "security": {
    "accessPassword": "your_password"
  },
  "server": {
    "port": 3000
  }
}
```

### 配置项说明

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `api.key` / `OPENROUTER_API_KEY` | 是 | OpenRouter API 密钥，用于调用 LLM 模型 |
| `api.baseUrl` | 否 | API 基础 URL，默认 `https://openrouter.ai/api/v1` |
| `api.expertModel` / `EXPERT_MODEL` | 否 | 专家评分使用的模型，默认 `moonshotai/kimi-k2-thinking` |
| `security.accessPassword` / `ACCESS_PASSWORD` | 否 | 系统访问密码，留空则无需登录 |

> **安全提示：** `config.json` 和 `.env.local` 包含敏感信息，已在 `.gitignore` 中排除。请勿将其提交到版本控制系统。

---

## 使用指南

### 1. 登录系统

- 访问 `http://localhost:3000`，系统自动跳转至登录页面
- 输入配置的访问密码后即可进入系统
- 登录状态通过 Cookie 保持 30 天
- 如果未设置 `ACCESS_PASSWORD`，系统不需要登录

### 2. 管理问题

**路径：** 导航栏 → "问题管理"（`/settings/questions`）

1. 点击页面上的添加按钮
2. 输入评测问题内容
3. 点击保存
4. 支持编辑和删除已有问题

> **提示：** 支持通过 CSV 文件批量导入问题，详见 [CSV 数据导入](#11-csv-数据导入)。

### 3. 管理模型

**路径：** 导航栏 → "模型管理"（`/settings/models`）

1. 点击添加按钮
2. 输入模型名称（需使用 OpenRouter 支持的模型标识符）
3. 点击保存

**模型名称示例：**
- `openai/gpt-4o`
- `anthropic/claude-sonnet-4`
- `google/gemini-2.5-pro`
- `moonshotai/kimi-k2-thinking`
- `deepseek/deepseek-r1`

> **提示：** 完整的模型列表请参考 [OpenRouter Models](https://openrouter.ai/models)。

### 4. 管理评分维度

**路径：** 导航栏 → "维度管理"（`/settings/dimensions`）

系统默认提供 5 个评分维度：

| 维度 | 说明 |
|------|------|
| 准确性 | 评估回答内容的正确性 |
| 完整性 | 评估回答是否涵盖了问题的所有方面 |
| 清晰度 | 评估回答的表达是否清晰易懂 |
| 实用性 | 评估回答对用户的实际帮助程度 |
| 创新性 | 评估回答是否提供了独特或创新的见解 |

**自定义维度：**
1. 在维度管理页面添加新维度
2. 填写维度名称和评估提示词（Prompt）
3. 评估提示词会作为专家模型评分时的指导说明

### 5. 批量推理测试

**路径：** 首页选择模型 → 模型详情页 → "启动测试" 或 导航栏 → "批量任务"（`/admin/tasks`）→ "推理任务"（`/admin/tasks/inference`）

**操作步骤：**
1. 在首页点击目标模型进入详情页
2. 点击"启动测试"按钮
3. 系统将所有问题发送给该模型，批量收集回答
4. 在"推理任务"页面可查看推理队列进度

**任务管理：**
- 查看实时进度（已完成 / 总任务数）
- 暂停运行中的任务
- 恢复暂停的任务
- 取消任务
- 重试失败的任务
- 查看错误详情

### 6. 批量评分

**路径：** 模型详情页 → "启动评分" 或 导航栏 → "批量任务"（`/admin/tasks`）

**操作步骤：**
1. 在模型详情页点击"启动评分"
2. 系统使用配置的专家模型对所有回答进行多维度评分
3. 在"批量任务"页面查看评分队列进度
4. 评分完成后，可在回答详情页查看各维度的评分结果

**评分机制：**
- 专家模型接收问题、回答和维度提示词
- 评分结果以 XML 格式输出：`<score>分数</score>`
- 系统自动提取分数（支持多种格式的回退解析）
- 每个回答在每个维度上获得一个分数

### 7. 专家评分

**路径：** 导航栏 → "专家评分"（`/expert`）

独立的专家评分界面，可直接输入问题和回答进行即时评分：

1. 输入或粘贴问题内容
2. 输入或粘贴回答内容
3. 选择要评估的维度
4. 系统调用专家模型返回评分结果

### 8. 竞技场对战

**路径：** 导航栏 → "竞技场"（`/arena`）

多专家交叉评审功能：

1. 选择两个专家模型（Expert A 和 Expert B）
2. 选择一个仲裁模型（Expert C）
3. 选择待评估的回答
4. 系统启动多轮对战：
   - 每轮中，两个专家分别对回答进行评估
   - 如果两位专家意见一致，对战结束
   - 如果意见不一致，进入下一轮
   - 达到最大轮次仍不一致时，由仲裁模型做出最终裁决

**查看历史：** 导航栏 → "交锋历史"（`/arena/history`）

### 9. 批量竞技场

**路径：** 导航栏 → "批量竞技场"（`/admin/arena-batch`）

批量执行竞技场对战任务：

1. 选择三个专家模型（Expert A / B / C）
2. 设置最大轮次和并发数
3. 系统对所有待评估回答自动执行竞技场对战
4. 支持暂停 / 恢复 / 取消操作

### 10. 数据导出

**路径：** 导航栏 → 数据导出页面（`/export`）

- 将评测结果导出为 Excel (.xlsx) 文件
- 包含模型信息、问题、回答、各维度评分等完整数据

### 11. CSV 数据导入

系统提供 Python 脚本用于从 CSV 文件批量导入问题和回答数据。

**CSV 文件格式要求：**

| 问题 | 模型A | 模型B | 模型C | ... |
|------|-------|-------|-------|-----|
| 问题1内容 | 模型A的回答 | 模型B的回答 | 模型C的回答 | ... |
| 问题2内容 | ... | ... | ... | ... |

**使用方法：**

```bash
python import_csv.py
```

> **注意：** 脚本默认读取 `8道题×13个答案.csv` 文件。如需导入其他文件，请修改脚本中的 `csv_file` 变量。

**导入行为：**
- 自动创建不存在的模型和问题
- 跳过已存在的重复数据
- 输出导入统计信息

---

## 项目结构

```
ai-benchmark/
├── app/                            # Next.js App Router 页面和 API
│   ├── api/                        # 后端 API 路由
│   │   ├── answers/                # 回答 CRUD
│   │   ├── arena/                  # 竞技场功能
│   │   ├── arena-batch-queue/      # 批量竞技场队列
│   │   ├── config/                 # 配置读取
│   │   ├── dimensions/             # 评分维度 CRUD
│   │   ├── expert-score/           # 批量专家评分
│   │   ├── expert-score-single/    # 单维度评分
│   │   ├── inference-queue/        # 推理队列管理
│   │   ├── login/                  # 登录认证
│   │   ├── models/                 # 模型 CRUD
│   │   ├── questions/              # 问题 CRUD
│   │   ├── score/                  # 计算模型分数
│   │   ├── scores/                 # 评分结果查询
│   │   ├── task-queue/             # 评分队列管理
│   │   └── test/                   # 健康检查
│   ├── admin/                      # 管理后台页面
│   │   ├── tasks/                  # 评分任务管理
│   │   │   └── inference/          # 推理任务管理
│   │   └── arena-batch/            # 批量竞技场管理
│   ├── answers/                    # 回答详情页
│   ├── arena/                      # 竞技场页面
│   │   └── history/                # 交锋历史
│   ├── expert/                     # 专家评分页面
│   ├── export/                     # 数据导出页面
│   ├── login/                      # 登录页面
│   ├── models/                     # 模型详情页
│   ├── settings/                   # 设置管理页面
│   │   ├── questions/              # 问题管理
│   │   ├── models/                 # 模型管理
│   │   └── dimensions/             # 维度管理
│   ├── layout.tsx                  # 根布局
│   ├── page.tsx                    # 首页
│   └── globals.css                 # 全局样式
├── components/                     # React 组件
│   ├── Navbar.tsx                  # 导航栏
│   ├── LanguageSwitcher.tsx        # 中英文切换按钮
│   └── LoadingSpinner.tsx          # 加载指示器
├── lib/                            # 核心库
│   ├── i18n/                       # 国际化模块
│   │   ├── context.tsx             # LanguageProvider 和 useTranslation 钩子
│   │   ├── server.ts               # 服务端翻译工具函数
│   │   └── locales/                # 语言包
│   │       ├── en.ts               # 英文翻译
│   │       └── zh.ts               # 中文翻译
│   ├── db.ts                       # SQLite 数据库初始化与连接
│   ├── config.ts                   # 配置管理（单例模式）
│   ├── queries.ts                  # 数据库查询操作
│   ├── taskQueue.ts                # 任务队列执行引擎
│   ├── openrouter.ts               # OpenRouter API 封装
│   └── arenaBatchQueue.ts          # 批量竞技场执行引擎
├── types/                          # TypeScript 类型定义
│   └── xlsx.d.ts                   # Excel 导出类型
├── middleware.ts                   # 认证中间件
├── config.json                     # 应用配置文件
├── import_csv.py                   # CSV 数据导入脚本
├── package.json                    # 项目依赖
├── tsconfig.json                   # TypeScript 配置
├── tailwind.config.ts              # Tailwind CSS 配置
├── next.config.js                  # Next.js 配置
└── postcss.config.js               # PostCSS 配置
```

---

## API 接口文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 密码验证，设置认证 Cookie |

### 问题管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取问题列表 |
| POST | `/api/questions` | 创建新问题 |
| PUT | `/api/questions` | 更新问题 |
| DELETE | `/api/questions` | 删除问题 |

### 模型管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models` | 获取模型列表 |
| POST | `/api/models` | 创建新模型 |
| PUT | `/api/models` | 更新模型 |
| DELETE | `/api/models` | 删除模型 |

### 回答管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/answers` | 获取回答列表（支持分页） |
| GET | `/api/answers/count` | 获取回答总数 |
| POST | `/api/answers` | 创建新回答 |
| DELETE | `/api/answers` | 删除回答 |

### 评分维度

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dimensions` | 获取评分维度列表 |
| POST | `/api/dimensions` | 创建新维度 |
| PUT | `/api/dimensions` | 更新维度 |
| DELETE | `/api/dimensions` | 删除维度 |

### 评分操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scores` | 获取评分结果 |
| POST | `/api/scores` | 创建评分记录 |
| POST | `/api/score` | 触发模型分数计算 |
| POST | `/api/expert-score` | 批量专家评分 |
| POST | `/api/expert-score-single` | 单维度专家评分 |

### 任务队列

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/task-queue` | 创建评分批量任务 |
| GET | `/api/task-queue/[id]` | 查询任务队列状态 |
| POST | `/api/inference-queue` | 创建推理批量任务 |
| GET | `/api/inference-queue/[id]` | 查询推理队列状态 |

### 竞技场

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/arena/experts` | 获取专家模型列表 |
| POST | `/api/arena/experts` | 添加专家模型 |
| POST | `/api/arena/sessions` | 创建竞技场会话 |
| POST | `/api/arena/battle` | 执行一轮对战 |
| POST | `/api/arena/judge` | 仲裁裁决 |
| POST | `/api/arena-batch-queue` | 创建批量竞技场任务 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config` | 获取公开配置信息 |
| GET | `/api/test` | 健康检查 |

---

## 数据库结构

系统使用 SQLite 数据库（文件：`benchmark.db`），自动创建以下表：

### 核心数据表

```
questions           问题表
├── id              INTEGER PRIMARY KEY
└── content         TEXT NOT NULL

models              模型表
├── id              INTEGER PRIMARY KEY
├── name            TEXT NOT NULL UNIQUE
└── average_score   TEXT (JSON 格式的评分数据)

answers             回答表
├── id              INTEGER PRIMARY KEY
├── question_id     INTEGER → questions(id) ON DELETE CASCADE
├── model_id        INTEGER → models(id) ON DELETE CASCADE
├── content         TEXT NOT NULL
└── created_at      DATETIME

dimensions          评分维度表
├── id              INTEGER PRIMARY KEY
├── name            TEXT NOT NULL UNIQUE
└── prompt          TEXT NOT NULL

scores              评分表
├── id              INTEGER PRIMARY KEY
├── answer_id       INTEGER → answers(id) ON DELETE CASCADE
├── dimension_id    INTEGER → dimensions(id) ON DELETE CASCADE
├── score           TEXT NOT NULL
├── created_at      DATETIME
└── UNIQUE(answer_id, dimension_id)
```

### 队列管理表

```
task_queue          评分队列表
├── id, status, total_tasks, completed_tasks, failed_tasks
├── current_task, error_message, max_concurrency
└── created_at, started_at, completed_at

task_items          评分子任务表
├── id, queue_id, answer_id, dimension_id
├── status, error_message
└── created_at, completed_at

inference_queue     推理队列表（结构同 task_queue）

inference_tasks     推理子任务表
├── id, queue_id, question_id, model_id
├── status, error_message
└── created_at, completed_at

arena_batch_queue   批量竞技场队列表
├── (同 task_queue 结构)
├── max_rounds, expert_a_id, expert_b_id, expert_c_id
└── ...

arena_batch_tasks   批量竞技场子任务表
├── id, queue_id, question_id, answer_id, session_id
├── status, current_round, is_agreed, needs_judgment
└── error_message, created_at, completed_at
```

### 任务状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `running` | 执行中 |
| `completed` | 已完成 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |
| `paused` | 已暂停 |

---

## 常见问题

### Q: 启动时报错 "node:sqlite" 模块找不到？

Node.js 内置 `node:sqlite` 模块需要 Node.js 22 及以上版本。请升级 Node.js：

```bash
node --version  # 检查版本
```

### Q: API 调用失败，提示 "API Key 未配置"？

确保 `config.json` 中的 `api.key` 或 `.env.local` 中的 `OPENROUTER_API_KEY` 已正确设置有效的 OpenRouter API Key。

### Q: 评分结果为空或无法解析？

系统自动从专家模型回复中提取分数，支持以下格式：
1. XML 格式（优先）：`<score>85</score>`
2. 中文格式：`分数：85`
3. 英文格式：`Score: 85`
4. 兜底：提取回复中第一个 0-100 范围的数字

如果模型回复格式异常，检查评分维度的提示词是否清晰。

### Q: 批量任务失败率高？

- 检查 OpenRouter API Key 余额是否充足
- 适当降低并发数（默认为 3）
- 系统已内置指数退避重试策略（1s → 2s → 4s），通常可自动恢复
- 查看任务详情页的错误日志，确认具体失败原因

### Q: 数据库文件在哪里？

数据库文件 `benchmark.db` 位于项目根目录，首次启动时自动创建。该文件已在 `.gitignore` 中排除。

### Q: 如何重置所有数据？

删除项目根目录下的 `benchmark.db` 文件，重启服务后系统会自动创建新的空数据库。

### Q: 如何更换专家评分模型？

修改 `.env.local` 中的 `EXPERT_MODEL` 或 `config.json` 中的 `api.expertModel`，然后重启服务。也可以在 "设置" 页面（`/settings`）的配置接口中查看当前配置。

---

## 生产部署

### 构建

```bash
npm run build
```

### 启动

```bash
npm start
```

### 注意事项

- 确保生产环境的 Node.js 版本 >= 22
- SQLite 数据库文件需要写权限
- `config.json` 和 `.env.local` 不应包含在部署包中，需在服务器上单独配置
- 建议使用 PM2 或类似工具进行进程管理

---

## 许可证

[ISC](LICENSE)
