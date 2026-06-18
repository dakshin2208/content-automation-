const DEFAULT_API_VERSION = "2024-10-21";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AzureChatOptions {
  // Overrides the default deployment (AZURE_OPENAI_DEPLOYMENT) when set.
  deployment?: string;
  temperature?: number;
  maxTokens?: number;
}

function getApiKey(): string {
  const k = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!k) throw new Error("Missing AZURE_OPENAI_API_KEY");
  return k;
}

function getEndpoint(): string {
  const e = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  if (!e) throw new Error("Missing AZURE_OPENAI_ENDPOINT");
  // Strip a trailing slash so we can join paths cleanly.
  return e.replace(/\/+$/, "");
}

function getDeployment(override?: string): string {
  const d = (override ?? process.env.AZURE_OPENAI_DEPLOYMENT)?.trim();
  if (!d) throw new Error("Missing AZURE_OPENAI_DEPLOYMENT");
  return d;
}

export async function azureChat(
  messages: ChatMessage[],
  options: AzureChatOptions = {}
): Promise<string> {
  const apiKey = getApiKey();
  const endpoint = getEndpoint();
  const deployment = getDeployment(options.deployment);
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION?.trim() || DEFAULT_API_VERSION;

  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    deployment
  )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      // GPT-4o/GPT-5-era models on Azure require max_completion_tokens
      // (the legacy max_tokens is rejected as unsupported).
      max_completion_tokens: options.maxTokens ?? 8192,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const content = data.choices?.[0]?.message?.content;
  if (content == null || content === "") {
    throw new Error("Azure OpenAI returned empty content");
  }

  return content;
}

export async function azureChatWithRetry(
  messages: ChatMessage[],
  options?: AzureChatOptions
): Promise<string> {
  try {
    return await azureChat(messages, options);
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    return await azureChat(messages, options);
  }
}
