# EN Listen Writing

面向中学生的英语听力概括与写作批改应用。学生上传英语音频，系统使用豆包完成音频转写、语义理解和手写作文 OCR，使用 DeepSeek 结合听力内容批改学生英文概括，并把每次批改沉淀为可复习的知识点。

## 功能

- 学生学习档案：使用 Cookie 会话保存学生账号并隔离个人数据。
- 音频练习：上传音频后生成转写文本、主题、关键词、听力要点和标准概括；并基于转写内容自动生成 **3～5 道听力理解选择题**（四选一），页面直接展示 **参考答案**（新上传的练习才有；历史数据若摘要里无该字段则不会显示）。
- **浏览器朗读题目**：在练习页可对单题使用系统语音朗读题干与选项（默认不朗读答案）；支持在英文声音列表中切换音色，便于 Mac / Chrome 环境下选用更清晰的朗读声线。
- 写作提交：支持浏览器直接输入，也支持拍照上传手写作文后 OCR 确认。
- AI 批改：输出总体评分、分项评分、逐句问题、内容遗漏、中文式英语和优化表达。
- 知识点复习：自动生成语法、词汇、内容理解等知识点，并支持标记“新知识点 / 复习中 / 已掌握”。

## 大模型分工

- STT Wrapper：`STT_WRAPPER_BASE_URL`，优先用于音频转写，支持直接上传本机音频文件，不需要公网音频 URL。当前局域网默认地址为 `http://192.168.2.213:27178`，模型为 `Systran/faster-whisper-small`。
- 豆包/火山方舟：`DOUBAO_API_KEY`，默认模型配置为 `doubao-seed-2-0-mini-260428`。其中 **`DOUBAO_TEXT_MODEL`** 负责根据转写文本生成听力摘要结构（含听力选择题）；视觉相关由 **`DOUBAO_VISION_MODEL`** 负责手写 OCR。
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

默认在 **`0.0.0.0:15666`** 监听（便于局域网或 Tailscale 等设备访问）。本机可打开 [http://localhost:15666](http://localhost:15666)；其他机器请使用你当前机的局域网 IP 或 Tailscale IP，例如 `http://<主机IP>:15666`。

`npm install` / `npm ci` 后会通过 **`postinstall` 自动执行 `prisma generate`**，避免生产构建时缺少已生成的 Prisma Client。

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
- `APP_PUBLIC_BASE_URL`：豆包 LAS 走「音频 URL」转写时，需要 **可从豆包侧访问的 HTTP/HTTPS 音频地址**。部署时请填你的站点根地址（勿带末尾 `/`），例如公网域名 **`https://example.com`**；若仅在内网或 Tailscale 使用，可填类似 **`http://100.x.x.x:15666`**（需 LAS 能从该 URL 拉到音频文件，不满足时请改用 STT Wrapper 或在创建练习时粘贴转写）。
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

生产环境部署时，建议在目标机器上：**拉取代码 → `npm ci` → `npm run build` → `npm run start`**（`start` 与 `dev` 同样默认绑定 **`0.0.0.0:15666`**）。若曾因清理 `node_modules` 导致生成物缺失，可手动执行 **`npm run prisma:generate`** 后再 `npm run build`。

## 生产部署简述

仓库内不包含固定服务器路径；按需将代码克隆到你自己的目录（例如 `$HOME/apps/en-listen-writing`），配置好 `.env` 与 PostgreSQL，再执行上文构建与启动命令。使用 **Tailscale** 时，用分配给该主机的 `100.x` 地址即可访问，例如 `http://100.x.x.x:15666`。

## STT Wrapper 排错

先在开发机确认服务可达：

```bash
curl http://192.168.2.213:27178/health
```

如果连不上，检查服务是否仍在 `192.168.2.213:27178` 运行，以及当前 Mac 是否在同一局域网。若网页提示缺少 Key，请确认 `.env` 已填写 `STT_WRAPPER_API_KEY` 并重启本应用（默认 `npm run dev` 在 **15666** 端口）。
