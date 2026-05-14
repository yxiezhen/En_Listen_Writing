"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type User = {
  id: string;
  username?: string | null;
  role: "STUDENT" | "ADMIN";
  isVip: boolean;
  displayName: string;
  email?: string | null;
};

type AdminUser = {
  id: string;
  username?: string | null;
  displayName: string;
  email?: string | null;
  role: "STUDENT" | "ADMIN";
  isVip: boolean;
  _count: {
    exercises: number;
    knowledgePoints: number;
  };
};

type AudioSummary = {
  title: string;
  topic: string;
  level: string;
  keyPoints: string[];
  keywords: string[];
  idealSummary: string;
  comprehensionQuestions?: Array<{
    question: string;
    options: string[];
    answer: "A" | "B" | "C" | "D";
  }>;
};

type Exercise = {
  id: string;
  title: string;
  audioFileName: string;
  audioStorageKey: string;
  transcript: string;
  summary: AudioSummary;
  createdAt: string;
  submissions: Submission[];
};

type Submission = {
  id: string;
  exerciseId: string;
  originalText: string;
  mode: "TEXT" | "PHOTO";
  createdAt: string;
  exercise?: Exercise;
  evaluation?: Evaluation | null;
};

type Evaluation = {
  id: string;
  overallScore: number;
  rubricScores: {
    content: number;
    grammar: number;
    vocabulary: number;
    coherence: number;
  };
  overallComment: string;
  issues: Array<{
    type: string;
    severity: string;
    original: string;
    corrected: string;
    explanation: string;
  }>;
  sentenceNotes: Array<{
    sentence: string;
    note: string;
    suggestion: string;
  }>;
  improvedDraft: string;
  contentCoverage: {
    covered: string[];
    missing: string[];
    inaccurate: string[];
  };
  knowledgePoints: KnowledgePoint[];
};

type KnowledgePoint = {
  id: string;
  type: string;
  title: string;
  original?: string | null;
  corrected?: string | null;
  explanation: string;
  example?: string | null;
  masteryStatus: string;
  evaluation?: {
    submission?: {
      exercise?: { id: string; title: string };
    };
  };
};

type ApiState = "idle" | "loading" | "error";
const EXERCISES_PER_PAGE = 6;

export function LearningWorkspace({
  initialUser,
  initialExercises,
  initialKnowledgePoints,
  initialAdminUsers,
}: {
  initialUser: User | null;
  initialExercises: Exercise[];
  initialKnowledgePoints: KnowledgePoint[];
  initialAdminUsers: AdminUser[];
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [exercises, setExercises] = useState(initialExercises);
  const [knowledgePoints, setKnowledgePoints] = useState(initialKnowledgePoints);
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    initialExercises[0]?.id ?? "",
  );
  const [studentText, setStudentText] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [imageStorageKey, setImageStorageKey] = useState("");
  const [latestSubmission, setLatestSubmission] = useState<Submission | null>(null);
  const [status, setStatus] = useState<ApiState>("idle");
  const [message, setMessage] = useState("");
  const [readingQuestionIndex, setReadingQuestionIndex] = useState<number | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(initialAdminUsers);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exercisePage, setExercisePage] = useState(1);
  const busyRef = useRef(false);
  const speechTimerRef = useRef<number | null>(null);

  const isBusy = status === "loading";
  const effectiveExerciseId = selectedExerciseId || exercises[0]?.id || "";
  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === effectiveExerciseId),
    [exercises, effectiveExerciseId],
  );
  const filteredExercises = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase();
    if (!query) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const createdAt = formatDate(exercise.createdAt).toLowerCase();
      return [
        exercise.title,
        exercise.summary.topic,
        exercise.audioFileName,
        createdAt,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [exercises, exerciseQuery]);
  const exercisePageCount = Math.max(
    1,
    Math.ceil(filteredExercises.length / EXERCISES_PER_PAGE),
  );
  const visibleExercises = filteredExercises.slice(
    (exercisePage - 1) * EXERCISES_PER_PAGE,
    exercisePage * EXERCISES_PER_PAGE,
  );
  const displayedSubmission =
    latestSubmission?.exerciseId === effectiveExerciseId
      ? latestSubmission
      : selectedExercise?.submissions?.[0] ?? null;
  const selectedKnowledgePoints = knowledgePoints.filter(
    (point) => point.evaluation?.submission?.exercise?.id === effectiveExerciseId,
  );
  const selectedSpeechVoice = useMemo(
    () =>
      speechVoices.find((voice) => voice.voiceURI === selectedVoiceURI) ??
      getPreferredEnglishVoice(speechVoices),
    [speechVoices, selectedVoiceURI],
  );

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("en"));
      setSpeechVoices(voices);
      setSelectedVoiceURI((current) => {
        if (current && voices.some((voice) => voice.voiceURI === current)) {
          return current;
        }

        return getPreferredEnglishVoice(voices)?.voiceURI ?? "";
      });
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      if (speechTimerRef.current) {
        window.clearTimeout(speechTimerRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  async function signIn(formData: FormData) {
    await runAction("正在登录学习档案...", async () => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
          displayName: formData.get("displayName"),
          email: formData.get("email"),
        }),
      });
      const data = await parseResponse<{ user: User }>(response);
      setUser(data.user);
      await refreshData();
      if (data.user.role === "ADMIN") {
        await refreshAdminUsers();
      }
      setMessage("学习档案已准备好，历史练习和知识点已加载。");
    });
  }

  function handleSignInSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn(new FormData(event.currentTarget));
  }

  async function switchUser() {
    await runAction("正在退出当前学习档案...", async () => {
      const response = await fetch("/api/session", {
        method: "DELETE",
      });
      await parseResponse(response);
      setUser(null);
      setExercises([]);
      setKnowledgePoints([]);
      setAdminUsers([]);
      setSelectedExerciseId("");
      setLatestSubmission(null);
      setMessage("已退出，请输入用户名登录另一个学习档案。");
    });
  }

  async function createExercise(formData: FormData) {
    await runAction("正在上传音频并进行语音转文字，请稍候...", async () => {
      const response = await fetch("/api/exercises", {
        method: "POST",
        body: formData,
      });
      const data = await parseResponse<{ exercise: { id: string } }>(response);
      setSelectedExerciseId(data.exercise.id);
      setLatestSubmission(null);
      setExercisePage(1);
      await refreshData();
      setMessage("音频练习已创建，已基于真实转写文本生成标准要点。");
    });
  }

  function handleCreateExerciseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createExercise(new FormData(event.currentTarget));
  }

  async function deleteExercise(exerciseId: string, title: string) {
    const confirmed = window.confirm(
      `确定删除「${title}」吗？该练习下的作文、批改结果和知识点也会一起删除。`,
    );

    if (!confirmed) {
      return;
    }

    await runAction("正在删除练习及相关批改记录...", async () => {
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "DELETE",
      });
      await parseResponse(response);
      if (selectedExerciseId === exerciseId) {
        setSelectedExerciseId("");
      }
      setLatestSubmission(null);
      await refreshData();
      setMessage("练习已删除。");
    });
  }

  async function recognizeImage(formData: FormData) {
    await runAction("正在识别手写作文...", async () => {
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });
      const data = await parseResponse<{
        ocrText: string;
        imageStorageKey: string;
      }>(response);
      setOcrText(data.ocrText);
      setImageStorageKey(data.imageStorageKey);
      setStudentText(data.ocrText);
      setMessage("OCR 完成，请确认识别文本后再提交批改。");
    });
  }

  function handleRecognizeImageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void recognizeImage(new FormData(event.currentTarget));
  }

  async function submitWriting() {
    if (!effectiveExerciseId || studentText.trim().length < 20) {
      setStatus("error");
      setMessage("请选择练习，并输入至少 20 个字符的英文概括。");
      return;
    }

    await runAction("DeepSeek 正在结合听力内容批改作文...", async () => {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: effectiveExerciseId,
          text: studentText,
          mode: imageStorageKey ? "PHOTO" : "TEXT",
          ocrText: ocrText || undefined,
          imageStorageKey: imageStorageKey || undefined,
        }),
      });
      const data = await parseResponse<{ submission: Submission }>(response);
      setLatestSubmission(data.submission);
      setStudentText("");
      setOcrText("");
      setImageStorageKey("");
      await refreshData();
      setMessage("批改完成，知识点已加入复习库。");
    });
  }

  function readComprehensionQuestion(
    question: NonNullable<AudioSummary["comprehensionQuestions"]>[number],
    index: number,
  ) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setStatus("error");
      setMessage("当前浏览器不支持朗读功能，请换用 Chrome、Edge 或 Safari。");
      return;
    }

    if (readingQuestionIndex === index) {
      window.speechSynthesis.cancel();
      setReadingQuestionIndex(null);
      return;
    }

    const text = [
      `Question ${index + 1}. ${question.question}`,
      ...question.options,
    ].join(" ");
    const currentVoices = window.speechSynthesis.getVoices();
    const voice =
      currentVoices.find((item) => item.voiceURI === selectedVoiceURI) ??
      selectedSpeechVoice ??
      null;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? "en-US";
    utterance.voice = voice;
    utterance.rate = 0.72;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setReadingQuestionIndex(null);
    utterance.onerror = () => setReadingQuestionIndex(null);

    if (speechTimerRef.current) {
      window.clearTimeout(speechTimerRef.current);
    }
    window.speechSynthesis.cancel();
    setReadingQuestionIndex(index);
    speechTimerRef.current = window.setTimeout(() => {
      window.speechSynthesis.speak(utterance);
      speechTimerRef.current = null;
    }, 80);
  }

  async function refreshData() {
    const [exerciseResponse, knowledgeResponse] = await Promise.all([
      fetch("/api/exercises"),
      fetch("/api/knowledge"),
    ]);
    const exerciseData = await parseResponse<{ exercises: Exercise[] }>(
      exerciseResponse,
    );
    const knowledgeData = await parseResponse<{ knowledgePoints: KnowledgePoint[] }>(
      knowledgeResponse,
    );
    setExercises(exerciseData.exercises);
    setKnowledgePoints(knowledgeData.knowledgePoints);
  }

  async function refreshAdminUsers() {
    const response = await fetch("/api/admin/users");
    const data = await parseResponse<{ users: AdminUser[] }>(response);
    setAdminUsers(data.users);
  }

  async function toggleVip(userId: string, isVip: boolean) {
    await runAction("正在更新 VIP 权限...", async () => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVip }),
      });
      await parseResponse(response);
      await refreshAdminUsers();
      setMessage("VIP 权限已更新。");
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    if (busyRef.current) {
      return;
    }

    try {
      busyRef.current = true;
      flushSync(() => {
        setStatus("loading");
        setMessage(label);
      });
      await waitForPaint();
      await action();
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      busyRef.current = false;
    }
  }

  if (!user) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <div className="grid gap-8 rounded-3xl bg-white p-8 shadow-2xl shadow-slate-200 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              EN Listen Writing
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
              面向中学生的听力概括与英文写作教练
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              上传听力音频，并基于真实转写文本理解内容；局域网优先调用 STT Wrapper
              直接转写音频，再用豆包视觉 OCR 和 DeepSeek 批改并沉淀复习知识点。
            </p>
          </div>
          <form
            onSubmit={handleSignInSubmit}
            className="rounded-2xl border border-slate-200 p-6"
          >
            <h2 className="text-xl font-semibold text-slate-950">
              登录或创建学习档案
            </h2>
            <fieldset disabled={isBusy} className="disabled:opacity-60">
              <label className="mt-5 block text-sm font-medium text-slate-700">
                用户名
                <input
                  required
                  name="username"
                  pattern="[-a-zA-Z0-9_]{2,40}"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="例如：alex_8"
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                密码
                <input
                  required
                  name="password"
                  type="password"
                  minLength={6}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="至少 6 位"
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                显示姓名（可选）
                <input
                  name="displayName"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="例如：Alex"
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                邮箱（可选）
                <input
                  name="email"
                  type="email"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="student@example.com"
                />
              </label>
              <button className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isBusy ? "处理中..." : "进入学习档案"}
              </button>
            </fieldset>
            {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
          </form>
        </div>
        <BusyOverlay active={isBusy} message={message} />
      </section>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <header className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-950 p-8 text-white md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            AI English Coach
          </p>
          <h1 className="mt-3 text-3xl font-bold">你好，{user.displayName}</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            完成“听音频、写概括、看批改、复习知识点”的完整训练闭环。
            {user.username ? ` 当前用户名：${user.username}` : ""}
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
          <div>练习：{exercises.length}</div>
          <div>知识点：{knowledgePoints.length}</div>
          <div>
            权限：
            {user.role === "ADMIN" ? "管理员" : user.isVip ? "VIP 学生" : "普通学生"}
          </div>
          <button
            type="button"
            onClick={switchUser}
            disabled={isBusy}
            className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            切换用户
          </button>
        </div>
      </header>

      {message ? (
        <div
          className={`mt-5 rounded-2xl border px-5 py-4 text-sm ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {message}
        </div>
      ) : null}
      <BusyOverlay active={isBusy} message={message} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {user.role === "ADMIN" ? (
          <AdminUserPanel
            users={adminUsers}
            isBusy={isBusy}
            onRefresh={() => runAction("正在刷新用户列表...", refreshAdminUsers)}
            onToggleVip={toggleVip}
          />
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-950">1. 上传听力音频</h2>
          <form onSubmit={handleCreateExerciseSubmit} className="mt-4 space-y-4">
            <fieldset disabled={isBusy} className="space-y-4 disabled:opacity-60">
              <input
                name="title"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="练习标题，例如：White House Briefing"
              />
              <input
                name="audio"
                required
                type="file"
                accept="audio/*"
                className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3"
              />
              <textarea
                name="transcript"
                className="min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 leading-6"
                placeholder="可选：如果 STT Wrapper 暂不可用，可在这里粘贴这段音频的真实英文转写文本。留空则自动调用 STT Wrapper。"
              />
              <p className="text-sm leading-6 text-slate-500">
                注意：系统不会再用演示文本冒充转写。当前优先把音频文件直传到局域网 STT Wrapper；只有未配置 Wrapper 时才回退到豆包 LAS。
                {user.role !== "ADMIN" && !user.isVip
                  ? " 普通学生只能创建 1 篇听力练习。"
                  : ""}
              </p>
              <button className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {isBusy ? "处理中..." : "生成听力练习"}
              </button>
            </fieldset>
          </form>

          <div className="mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="block text-sm font-medium text-slate-700 sm:max-w-xs">
                搜索练习
                <input
                  value={exerciseQuery}
                  onChange={(event) => {
                    setExerciseQuery(event.target.value);
                    setExercisePage(1);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
                  placeholder="标题、主题、文件名或日期"
                />
              </label>
              <div className="text-sm text-slate-500">
                共 {filteredExercises.length} 篇，当前第 {exercisePage} /{" "}
                {exercisePageCount} 页
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {visibleExercises.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
                没有找到匹配的练习。
              </p>
            ) : null}
            {visibleExercises.map((exercise) => (
              <div
                key={exercise.id}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  effectiveExerciseId === exercise.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedExerciseId(exercise.id)}
                  className="w-full text-left"
                >
                  <div className="font-semibold text-slate-950">{exercise.title}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {exercise.summary.topic}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {formatDate(exercise.createdAt)} · {exercise.audioFileName}
                  </div>
                </button>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{exercise.submissions.length} 次提交</span>
                  <button
                    type="button"
                    onClick={() => deleteExercise(exercise.id, exercise.title)}
                    className="rounded-full border border-red-200 px-3 py-1 font-semibold text-red-600 hover:bg-red-50"
                    disabled={isBusy}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setExercisePage((page) => Math.max(1, page - 1))}
              disabled={exercisePage <= 1}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() =>
                setExercisePage((page) => Math.min(exercisePageCount, page + 1))
              }
              disabled={exercisePage >= exercisePageCount}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-950">2. 听后写英文概括</h2>
          {selectedExercise ? (
            <div className="mt-4 space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">
                  {selectedExercise.summary.title}
                </h3>
                <audio
                  controls
                  className="mt-3 w-full"
                  src={`/api/files/${selectedExercise.audioStorageKey}`}
                />
                <div className="mt-4 text-sm text-slate-600">
                  <div className="font-medium text-slate-800">听力要点</div>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {selectedExercise.summary.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
                {selectedExercise.summary.comprehensionQuestions?.length ? (
                  <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                    <div className="font-medium text-slate-900">
                      听力选择题（含答案）
                    </div>
                    {speechVoices.length ? (
                      <label className="mt-3 block text-xs font-medium text-slate-600">
                        朗读声音
                        <select
                          value={selectedVoiceURI}
                          onChange={(event) => setSelectedVoiceURI(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                        >
                          {speechVoices.map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="mt-3 space-y-4">
                      {selectedExercise.summary.comprehensionQuestions.map(
                        (item, index) => (
                          <article key={`${item.question}-${index}`}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="font-medium text-slate-900">
                                {index + 1}. {item.question}
                              </p>
                              <button
                                type="button"
                                onClick={() => readComprehensionQuestion(item, index)}
                                className="shrink-0 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                {readingQuestionIndex === index ? "停止本题" : "朗读本题"}
                              </button>
                            </div>
                            <ul className="mt-2 space-y-1 text-slate-600">
                              {item.options.map((option) => (
                                <li key={option}>{option}</li>
                              ))}
                            </ul>
                            <p className="mt-2 font-semibold text-blue-700">
                              答案：{item.answer}
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <form
                onSubmit={handleRecognizeImageSubmit}
                className="rounded-2xl border border-dashed border-slate-300 p-4"
              >
                <fieldset disabled={isBusy} className="disabled:opacity-60">
                  <label className="block text-sm font-medium text-slate-700">
                    拍照上传手写作文（可选）
                    <input
                      name="image"
                      type="file"
                      accept="image/*"
                      className="mt-2 w-full"
                    />
                  </label>
                  <button className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                    {isBusy ? "识别中..." : "用豆包视觉识别"}
                  </button>
                </fieldset>
              </form>

              <textarea
                value={studentText}
                onChange={(event) => setStudentText(event.target.value)}
                disabled={isBusy}
                className="min-h-44 w-full rounded-2xl border border-slate-300 p-4 leading-7 outline-none focus:border-blue-500"
                placeholder="在这里输入或确认 OCR 后的英文概括..."
              />
              <button
                onClick={submitWriting}
                disabled={isBusy}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? "批改中..." : "提交给 DeepSeek 批改"}
              </button>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-6 text-slate-500">
              请先上传一段英语听力音频。
            </p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <EvaluationPanel
          exerciseTitle={selectedExercise?.title ?? ""}
          submission={displayedSubmission}
        />
        <KnowledgePanel
          exerciseTitle={selectedExercise?.title ?? ""}
          knowledgePoints={selectedKnowledgePoints}
          onStatusChange={async (id, masteryStatus) => {
            await runAction("正在更新复习状态...", async () => {
              const response = await fetch(`/api/knowledge/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ masteryStatus }),
              });
              await parseResponse(response);
              await refreshData();
              setMessage("复习状态已更新。");
            });
          }}
        />
      </div>
    </main>
  );
}

function BusyOverlay({ active, message }: { active: boolean; message: string }) {
  if (!active) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <h2 className="mt-5 text-lg font-semibold text-slate-950">正在处理</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {message || "STT、OCR 或 AI 批改可能需要一些时间，请不要重复操作。"}
        </p>
      </div>
    </div>
  );
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function getPreferredEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const preferredNames = [
    "Google US English",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Samantha",
    "Alex",
    "Ava",
    "Allison",
    "Daniel",
  ];

  return (
    preferredNames
      .map((name) => voices.find((voice) => voice.name.includes(name)))
      .find(Boolean) ??
    voices.find((voice) => voice.lang === "en-US") ??
    voices[0] ??
    null
  );
}

function AdminUserPanel({
  users,
  isBusy,
  onRefresh,
  onToggleVip,
}: {
  users: AdminUser[];
  isBusy: boolean;
  onRefresh: () => void;
  onToggleVip: (userId: string, isVip: boolean) => Promise<void>;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">管理员用户管理</h2>
          <p className="mt-1 text-sm text-slate-500">
            管理学生 VIP 权限。非 VIP 学生最多只能上传 1 篇听力练习。
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          刷新用户
        </button>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-3 pr-4">用户名</th>
              <th className="py-3 pr-4">姓名</th>
              <th className="py-3 pr-4">角色</th>
              <th className="py-3 pr-4">练习</th>
              <th className="py-3 pr-4">知识点</th>
              <th className="py-3 pr-4">VIP</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-3 pr-4 font-medium text-slate-950">
                  {item.username ?? "-"}
                </td>
                <td className="py-3 pr-4 text-slate-600">{item.displayName}</td>
                <td className="py-3 pr-4 text-slate-600">
                  {item.role === "ADMIN" ? "管理员" : "学生"}
                </td>
                <td className="py-3 pr-4 text-slate-600">{item._count.exercises}</td>
                <td className="py-3 pr-4 text-slate-600">
                  {item._count.knowledgePoints}
                </td>
                <td className="py-3 pr-4">
                  {item.role === "ADMIN" ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      默认
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onToggleVip(item.id, !item.isVip)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
                        item.isVip
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {item.isVip ? "VIP 已开通" : "确认 VIP"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EvaluationPanel({
  exerciseTitle,
  submission,
}: {
  exerciseTitle: string;
  submission: Submission | null;
}) {
  const evaluation = submission?.evaluation;

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold text-slate-950">3. 批改结果</h2>
      {exerciseTitle ? (
        <p className="mt-1 text-sm text-slate-500">当前练习：{exerciseTitle}</p>
      ) : null}
      {!evaluation ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-6 text-slate-500">
          当前练习还没有作文批改结果。提交作文后，这里会显示评分、逐句批注、内容遗漏和优化表达。
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white">
              {evaluation.overallScore}
            </div>
            <p className="leading-7 text-slate-600">{evaluation.overallComment}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(evaluation.rubricScores).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm capitalize text-slate-500">{key}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">主要问题</h3>
            <div className="mt-3 space-y-3">
              {evaluation.issues.map((issue, index) => (
                <div key={`${issue.type}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-blue-700">
                    {issue.type} · {issue.severity}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">原句：{issue.original}</div>
                  <div className="mt-1 text-sm text-slate-900">建议：{issue.corrected}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {issue.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <h3 className="font-semibold text-emerald-950">优化后的表达</h3>
            <p className="mt-2 leading-7 text-emerald-900">
              {evaluation.improvedDraft}
            </p>
          </div>
          <a
            href={`/summary/${submission.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            生成单篇训练总结 / 导出 PDF
          </a>
        </div>
      )}
    </section>
  );
}

function KnowledgePanel({
  exerciseTitle,
  knowledgePoints,
  onStatusChange,
}: {
  exerciseTitle: string;
  knowledgePoints: KnowledgePoint[];
  onStatusChange: (
    id: string,
    masteryStatus: "NEW" | "REVIEWING" | "MASTERED",
  ) => Promise<void>;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold text-slate-950">4. 复习知识点</h2>
      {exerciseTitle ? (
        <p className="mt-1 text-sm text-slate-500">只显示「{exerciseTitle}」的知识点。</p>
      ) : null}
      <div className="mt-5 space-y-3">
        {knowledgePoints.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-slate-500">
            当前练习还没有复习知识点。每次批改后，语法、词汇、中文式表达和内容理解问题会自动进入这里。
          </p>
        ) : (
          knowledgePoints.map((point) => (
            <article key={point.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-950">{point.title}</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {point.type}
                </span>
              </div>
              {point.original || point.corrected ? (
                <p className="mt-2 text-sm text-slate-600">
                  {point.original} → {point.corrected}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {point.explanation}
              </p>
              {point.example ? (
                <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  例句：{point.example}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(["NEW", "REVIEWING", "MASTERED"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(point.id, status)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      point.masteryStatus === status
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function statusLabel(status: "NEW" | "REVIEWING" | "MASTERED") {
  const labels = {
    NEW: "新知识点",
    REVIEWING: "复习中",
    MASTERED: "已掌握",
  };

  return labels[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "请求失败");
  }

  return data;
}
