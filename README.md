# EN Listen Writing

面向中学生的英语听力概括与写作批改应用。学生上传英语音频，系统使用豆包完成音频转写、语义理解和手写作文 OCR，使用 DeepSeek 结合听力内容批改学生英文概括，并把每次批改沉淀为可复习的知识点。

## 功能

- 学生学习档案：使用 Cookie 会话保存学生账号并隔离个人数据。
- 音频练习：上传音频后生成转写文本、主题、关键词、听力要点和标准概括。
- 写作提交：支持浏览器直接输入，也支持拍照上传手写作文后 OCR 确认。
- AI 批改：输出总体评分、分项评分、逐句问题、内容遗漏、中文式英语和优化表达。
- 知识点复习：自动生成语法、词汇、内容理解等知识点，并支持标记“新知识点 / 复习中 / 已掌握”。

## 大模型分工

- STT Wrapper：`STT_WRAPPER_BASE_URL`，优先用于音频转写，支持直接上传本机音频文件，不需要公网音频 URL。当前局域网默认地址为 `http://192.168.2.213:27178`，模型为 `Systran/faster-whisper-small`。
- 豆包/火山方舟：`DOUBAO_API_KEY`，默认模型配置为 `doubao-seed-2-0-mini-260428`，用于音频语义理解、图片 OCR/视觉识别。
- 豆包 LAS 录音文件识别：`DOUBAO_LAS_API_KEY`，作为 STT Wrapper 未配置时的备用真实音频转写方案。该接口是异步 `submit/poll`，需要公网 HTTP/HTTPS 或 TOS 音频 URL。
- DeepSeek：`DEEPSEEK_API_KEY`，默认模型配置为 `deepseek-v4-flash`，用于执行型文本任务，包括作文批改、结构化 JSON 输出和知识点抽取。
- 本地开发不会再用 mock transcript 冒充真实音频内容。若未配置公网音频地址，请在创建练习时粘贴真实听力转写文本。

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 复制并填写环境变量：

```bash
cp .env.example .env
```

3. 准备 PostgreSQL 数据库，并执行迁移：

```bash
npm run prisma:migrate
```

4. 启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

修改 `.env` 后需要重启开发服务器：

```bash
Ctrl + C
npm run dev
```

## 关键环境变量

- `DATABASE_URL`：PostgreSQL 连接字符串。
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：启动时自动创建或确保管理员账号。管理员可以查看用户列表并确认学生 VIP。
- `STT_WRAPPER_BASE_URL`：局域网 STT Wrapper 地址，默认 `http://192.168.2.213:27178`。
- `STT_WRAPPER_TRANSCRIBE_PATH`：转写接口路径，默认 `/stt/transcribe`。
- `STT_WRAPPER_MODEL`：STT 模型，默认 `Systran/faster-whisper-small`。
- `STT_WRAPPER_API_KEY`：STT Wrapper 鉴权 Key，通常复用 Speaches 等服务的 API Key。**不要**提交到仓库，在本机或服务器的私有 `.env` 中填写即可。
- `DOUBAO_API_KEY`：豆包/火山方舟 API Key。
- `DOUBAO_LAS_API_KEY`：豆包 LAS 录音文件识别 API Key。
- `DOUBAO_LAS_SUBMIT_URL`：豆包 LAS 提交任务接口，默认 `https://operator.las.cn-beijing.volces.com/api/v1/submit`。
- `DOUBAO_LAS_POLL_URL`：豆包 LAS 查询结果接口，默认 `https://operator.las.cn-beijing.volces.com/api/v1/poll`。
- `DOUBAO_AUDIO_MODEL`：豆包音频相关配置，默认 `doubao-seed-2-0-mini-260428`。
- `DOUBAO_TEXT_MODEL`：豆包文本理解模型，默认 `doubao-seed-2-0-mini-260428`。
- `DOUBAO_VISION_MODEL`：豆包视觉模型，默认 `doubao-seed-2-0-mini-260428`。
- `APP_PUBLIC_BASE_URL`：真实 LAS 转写需要公网 HTTP/HTTPS 音频地址；部署后填写应用公网域名，或改接 TOS 对象存储。
- `DEEPSEEK_API_KEY`：DeepSeek API Key。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-flash`。
- `UPLOAD_ROOT`：本地上传文件目录，生产建议替换为对象存储。

## 安全与开源

- `.gitignore` 已排除 `.env`、`.env.local` 等私密文件。**请勿**提交真实密钥。
- 首次克隆：`cp .env.example .env` 后在本机填入各 API Key。
- 若曾因误操作将密钥推到远程，请到各控制台**轮换**相关密钥。

## 质量检查

```bash
npm run lint
npm run build
```

## STT Wrapper 排错

先在开发机确认服务可达：

```bash
curl http://192.168.2.213:27178/health
```

如果连不上，检查服务是否仍在 `192.168.2.213:27178` 运行，以及当前 Mac 是否在同一局域网。若网页提示缺少 Key，请确认 `.env` 已填写 `STT_WRAPPER_API_KEY` 并重启 `npm run dev`。
