export async function postJson<T>(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AI request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function postMultipart<T>(
  url: string,
  apiKey: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AI request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
}

export function extractChatContent(payload: unknown) {
  const candidate = payload as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = candidate.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response did not include message content");
  }

  return content;
}

export function parseJsonFromModel<T>(content: string): T {
  const trimmed = content.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  return JSON.parse(jsonBlock ?? trimmed) as T;
}

export function shouldUseMock(keys: string[]) {
  return (
    process.env.AI_MOCK_FALLBACK !== "false" &&
    keys.some((value) => !value || value.trim().length === 0)
  );
}
