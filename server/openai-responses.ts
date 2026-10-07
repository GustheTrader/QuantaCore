const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

export function usesGpt6Responses(provider: string, baseUrl: string, model: string) {
  return provider === 'openai-compatible' && baseUrl.replace(/\/$/, '') === 'https://api.openai.com/v1' && /^gpt-6(?:[.-]|$)/.test(model);
}

// Keep the public chat contract; only the official GPT-6 upstream uses Responses.
export function responsesRequest(chat: any) {
  const model = String(chat.model);
  let effort = chat.reasoning_effort ?? 'medium';
  if (effort === 'minimal' || (effort === 'none' && /^gpt-6(?:\.1-sol|-astra)/.test(model))) effort = 'low';
  if (!['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw fail('Unsupported GPT-6 reasoning effort.');
  const input: any[] = [];
  for (const message of chat.messages) {
    if (!message || !['system', 'developer', 'user', 'assistant', 'tool'].includes(message.role)) throw fail('Unsupported message role.');
    if (message.role === 'tool') {
      if (typeof message.tool_call_id !== 'string' || typeof message.content !== 'string') throw fail('Tool results need a call ID and text content.');
      input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: message.content });
    } else {
      if (message.content != null) {
        if (typeof message.content !== 'string') throw fail('This GPT-6 adapter currently supports text messages only.');
        input.push({ role: message.role, content: message.content });
      }
      for (const call of message.tool_calls || []) {
        if (call.type !== 'function' || typeof call.id !== 'string' || typeof call.function?.name !== 'string' || typeof call.function?.arguments !== 'string') throw fail('Invalid function call history.');
        input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments });
      }
    }
  }
  if (!input.length) throw fail('Provide a non-empty message history.');
  const body: any = { model, input, store: false, stream: false, reasoning: { effort }, max_output_tokens: chat.max_completion_tokens ?? chat.max_tokens ?? 2048 };
  if (!Number.isSafeInteger(body.max_output_tokens) || body.max_output_tokens < 1) throw fail('Invalid output token limit.');
  if (chat.stop !== undefined || chat.plugins !== undefined || chat.seed !== undefined) throw fail('stop, plugins and seed are unsupported on this GPT-6 route.');
  if (effort === 'none') for (const key of ['temperature', 'top_p']) if (chat[key] !== undefined) body[key] = chat[key];
  if (chat.tools !== undefined) {
    if (!Array.isArray(chat.tools)) throw fail('tools must be an array.');
    body.tools = chat.tools.map((tool: any) => {
      if (tool?.type !== 'function' || typeof tool.function?.name !== 'string') throw fail('Only function tools are supported.');
      return { type: 'function', ...tool.function };
    });
  }
  if (chat.tool_choice !== undefined) {
    const choice = chat.tool_choice;
    if (typeof choice === 'string' && ['auto', 'none', 'required'].includes(choice)) body.tool_choice = choice;
    else if (choice?.type === 'function' && typeof choice.function?.name === 'string') body.tool_choice = { type: 'function', name: choice.function.name };
    else throw fail('Invalid tool choice.');
  }
  if (chat.parallel_tool_calls !== undefined) body.parallel_tool_calls = chat.parallel_tool_calls;
  if (chat.response_format !== undefined) {
    const format = chat.response_format;
    if (['text', 'json_object'].includes(format?.type)) body.text = { format: { type: format.type } };
    else if (format?.type === 'json_schema' && format.json_schema?.schema) body.text = { format: { type: 'json_schema', ...format.json_schema } };
    else throw fail('Invalid structured output format.');
  }
  return body;
}

export function responsesCompletion(response: any) {
  if (response?.status !== 'completed' || !Array.isArray(response.output)) throw fail('GPT-6 response did not complete successfully.', 502);
  let content = '', refusal = '';
  const tool_calls: any[] = [];
  for (const item of response.output) {
    if (item.type === 'function_call') {
      if (typeof item.call_id !== 'string' || typeof item.name !== 'string' || typeof item.arguments !== 'string') throw fail('Invalid upstream function call.', 502);
      tool_calls.push({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } });
    } else if (item.type === 'message') {
      for (const part of item.content || []) {
        if (part.type === 'output_text') content += part.text;
        if (part.type === 'refusal') refusal += part.refusal;
      }
    } else if (item.type !== 'reasoning') throw fail('Unsupported upstream output item.', 502);
  }
  if (!content.trim() && !refusal && !tool_calls.length) throw fail('GPT-6 returned no usable output.', 502);
  const usage = response.usage;
  return {
    id: response.id, object: 'chat.completion', created: response.created_at ?? Math.floor(Date.now() / 1000), model: response.model,
    choices: [{ index: 0, message: { role: 'assistant', content: content || null, ...(refusal ? { refusal } : {}), ...(tool_calls.length ? { tool_calls } : {}) }, finish_reason: tool_calls.length ? 'tool_calls' : refusal ? 'content_filter' : 'stop' }],
    ...(usage ? { usage: { ...usage, prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens, total_tokens: usage.total_tokens ?? usage.input_tokens + usage.output_tokens } } : {}),
    responses_output: response.output
  };
}
