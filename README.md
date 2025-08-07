# Telegram 媒体上传器

一个简单易用的Web应用程序，允许用户通过拖放界面上传图片和视频文件，并自动将这些文件转发到指定的Telegram群组。

## 功能特性

- 🖱️ **拖放上传**: 支持拖拽文件到上传区域
- 📁 **批量上传**: 支持同时上传多个文件
- 🖼️ **多格式支持**: 支持常见的图片格式（JPEG、PNG、GIF、WebP）和视频格式（MP4、AVI、MOV、WebM）
- 📊 **实时进度**: 显示上传进度和状态
- 🔄 **自动重试**: 网络错误时自动重试，支持手动重试失败的文件
- 📱 **响应式设计**: 支持移动设备和桌面设备
- ⚡ **Serverless架构**: 基于Vercel Serverless Functions，无需服务器维护

## 快速开始

### 1. 创建Telegram Bot

1. 在Telegram中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 命令创建新的bot
3. 按照提示设置bot名称和用户名
4. 获取bot token（格式类似：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 获取群组ID

1. 将bot添加到目标群组
2. 在群组中发送任意消息
3. 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. 在返回的JSON中找到 `chat.id` 字段（通常是负数）

### 3. 部署到Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/telegram-media-uploader)

1. 点击上方按钮或手动部署到Vercel
2. 在环境变量中设置：
   - `TELEGRAM_BOT_TOKEN`: 你的bot token
   - `TELEGRAM_CHAT_ID`: 目标群组ID

### 4. 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd telegram-media-uploader

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env.local

# 编辑 .env.local 文件，填入你的bot token和群组ID
# TELEGRAM_BOT_TOKEN=your_bot_token_here
# TELEGRAM_CHAT_ID=your_chat_id_here

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 查看应用。

## API 文档

### POST /api/upload

上传单个文件到Telegram。

**请求**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` - 要上传的文件

**响应**:
```json
{
  "success": true,
  "message": "File uploaded successfully to Telegram",
  "data": {
    "filename": "image.jpg",
    "fileSize": 1024000,
    "fileType": "image/jpeg",
    "telegramMessageId": 123
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/batch-upload

批量上传多个文件到Telegram。

**请求**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `files` - 要上传的文件数组

**响应**:
```json
{
  "success": true,
  "message": "Batch upload completed: 2 successful, 0 failed",
  "data": {
    "results": [
      {
        "success": true,
        "filename": "image1.jpg",
        "fileSize": 1024000,
        "fileType": "image/jpeg",
        "telegramMessageId": 123
      },
      {
        "success": true,
        "filename": "video1.mp4",
        "fileSize": 5120000,
        "fileType": "video/mp4",
        "telegramMessageId": 124
      }
    ],
    "summary": {
      "total": 2,
      "successful": 2,
      "failed": 0
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/health

健康检查端点。

**响应**:
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "service": "telegram-media-uploader",
    "version": "1.0.0",
    "environment": {
      "botTokenConfigured": true,
      "chatIdConfigured": true,
      "nodeVersion": "v18.17.0"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 项目结构

```
telegram-media-uploader/
├── api/                    # Vercel Serverless Functions
│   ├── _utils/
│   │   └── response.js     # 响应工具函数
│   ├── batch-upload.js     # 批量上传API
│   ├── health.js          # 健康检查API
│   └── upload.js          # 单文件上传API
├── public/                # 静态文件
│   ├── app.js            # 前端JavaScript
│   ├── index.html        # 主页面
│   └── styles.css        # 样式文件
├── __tests__/            # 测试文件
│   ├── api/
│   │   └── upload.test.js
│   └── setup.js
├── .env.example          # 环境变量示例
├── jest.config.js        # Jest配置
├── package.json          # 项目配置
├── README.md            # 项目文档
└── vercel.json          # Vercel部署配置
```

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `TELEGRAM_CHAT_ID` | 目标群组或频道ID | ✅ |

## 支持的文件格式

### 图片格式
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)

### 视频格式
- MP4 (`.mp4`)
- AVI (`.avi`)
- MOV (`.mov`)
- WebM (`.webm`)

## 限制

- 单个文件大小限制：50MB（Vercel限制）
- Telegram文件大小限制：50MB（图片）/ 50MB（视频）
- 并发上传：支持多文件同时上传
- 重试机制：最多重试3次，使用指数退避算法

## 开发

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch
```

### 部署

```bash
# 部署到生产环境
npm run deploy
```

## 故障排除

### 常见问题

1. **Bot Token无效**
   - 确保从@BotFather获取的token正确
   - 检查环境变量是否正确设置

2. **无法发送到群组**
   - 确保bot已被添加到目标群组
   - 确保bot有发送消息的权限
   - 检查群组ID是否正确（通常是负数）

3. **文件上传失败**
   - 检查文件格式是否支持
   - 确认文件大小不超过50MB
   - 检查网络连接

4. **部署问题**
   - 确保所有环境变量都已在Vercel中设置
   - 检查函数超时设置是否合适

### 日志查看

在Vercel控制台中查看函数日志：
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 点击 "Functions" 标签
4. 查看各个函数的日志

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License