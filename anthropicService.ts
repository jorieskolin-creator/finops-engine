
const callAnthropicGenerate = async (model: string, messages: any[], systemPrompt: string): Promise<{ text: string }> => {
  const isDev = (import.meta as any)?.env?.DEV;

  if (isDev || !window.location.host.includes('vercel.app')) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY missing in environment.");
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text');
    return { text: textContent?.text || '' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 595000);

  try {
    const response = await fetch('/api/anthropic-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, systemPrompt }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 404) {
        clearTimeout(timeoutId);
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing and proxy unavailable.");

        const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 8192,
            system: systemPrompt,
            messages: messages
          })
        });

        if (!fallbackResponse.ok) {
          const errorText = await fallbackResponse.text();
          throw new Error(`Anthropic Direct Error (${fallbackResponse.status}): ${errorText}`);
        }

        const data = await fallbackResponse.json();
        const textContent = data.content?.find((c: any) => c.type === 'text');
        return { text: textContent?.text || '' };
      }

      const errorText = await response.text();
      throw new Error(`Anthropic Proxy Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const callOpusStrategy = async (messages: any[], systemPrompt: string): Promise<{ text: string }> => {
  return callAnthropicGenerate('claude-opus-4-7', messages, systemPrompt);
};

export const callSonnetValidator = async (messages: any[], systemPrompt: string): Promise<{ text: string }> => {
  return callAnthropicGenerate('claude-sonnet-4-6', messages, systemPrompt);
};

export { callAnthropicGenerate };
