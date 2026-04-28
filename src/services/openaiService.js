const OpenAI = require('openai');
const logger = require('../utils/logger');

function buildClient(apiKey, baseURL) {
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// Providers are tried in order. If one returns a rate-limit or quota error,
// the next one in the list is used automatically.
const PROVIDERS = [];

if (process.env.OPENAI_API_KEY) {
  PROVIDERS.push({
    name: 'OpenAI (gpt-4o-mini)',
    client: buildClient(process.env.OPENAI_API_KEY),
    model: 'gpt-4o-mini',
  });
}

if (process.env.NVIDIA_API_KEY) {
  PROVIDERS.push({
    name: `NVIDIA NIM (${process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct'})`,
    client: buildClient(process.env.NVIDIA_API_KEY, 'https://integrate.api.nvidia.com/v1'),
    model: process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
  });
}

if (process.env.GEMINI_API_KEY) {
  // Gemini exposes an OpenAI-compatible endpoint, so no extra SDK needed.
  // response_format: json_object is not supported — handled via noJsonMode flag.
  PROVIDERS.push({
    name: `Gemini Flash (${process.env.GEMINI_MODEL || 'gemini-1.5-flash'})`,
    client: buildClient(process.env.GEMINI_API_KEY, 'https://generativelanguage.googleapis.com/v1beta/openai'),
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    noJsonMode: true,
  });
}

if (process.env.OPENROUTER_API_KEY) {
  PROVIDERS.push({
    name: `OpenRouter (${process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'})`,
    client: buildClient(process.env.OPENROUTER_API_KEY, 'https://openrouter.ai/api/v1'),
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  });
}

if (process.env.GROQ_API_KEY) {
  PROVIDERS.push({
    name: `Groq (${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'})`,
    client: buildClient(process.env.GROQ_API_KEY, 'https://api.groq.com/openai/v1'),
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  });
}

if (PROVIDERS.length === 0) {
  logger.warn('No AI API key configured. Set NVIDIA_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in .env');
} else {
  logger.info(`AI providers configured: ${PROVIDERS.map(p => p.name).join(' → ')}`);
}

// Embeddings require OpenAI's text-embedding model — not available on free providers.
const embeddingClient = process.env.OPENAI_API_KEY
  ? buildClient(process.env.OPENAI_API_KEY)
  : null;

// Catches rate limits, quota exhaustion, and model availability errors.
// A 404 usually means the model slug is wrong or the account can't access it.
function isQuotaError(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    err.status === 429 ||
    err.status === 404 ||
    err.status === 503 ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('restricted') ||
    msg.includes('insufficient_quota') ||
    msg.includes('too many requests') ||
    msg.includes('organization has been restricted') ||
    msg.includes('model not found') ||
    msg.includes('not found')
  );
}

// Some providers return JSON wrapped in markdown code fences, or skip JSON
// entirely and return raw code. This function handles all of those cases.
function safeParseJSON(raw, fallbackKey = null) {
  const content = (raw || '').trim();

  try { return JSON.parse(content); } catch {}

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
    if (fallbackKey) return { [fallbackKey]: fenced[1].trim(), summary: 'Code refactored.' };
  }

  const embedded = content.match(/\{[\s\S]*\}/);
  if (embedded) {
    try { return JSON.parse(embedded[0]); } catch {}
  }

  if (fallbackKey) return { [fallbackKey]: content, summary: 'Code refactored.' };

  throw new SyntaxError(`Could not parse response as JSON: ${content.slice(0, 120)}`);
}

const SYSTEM_PROMPT = `You are CodeScope, an expert code analysis assistant.
Analyze code for bugs, security vulnerabilities, performance issues, style problems,
and maintainability concerns. Provide actionable suggestions for each issue found.
Return your analysis in the following JSON format:
{
  "issues": [
    {
      "type": "bug|security|performance|style|maintainability|complexity",
      "severity": "critical|high|medium|low|info",
      "line": <line_number_or_null>,
      "message": "<description of the issue>",
      "suggestion": "<how to fix it>"
    }
  ],
  "metrics": {
    "linesOfCode": <number>,
    "cyclomaticComplexity": <estimated_number>,
    "maintainabilityIndex": <0-100>,
    "duplicateRatio": <0-1>,
    "overallScore": <0-100>
  },
  "summary": "<brief overall assessment>"
}`;

async function analyzeCode(sourceCode, language, ragContext = '') {
  if (PROVIDERS.length === 0) {
    throw new Error('No AI provider configured. Add an API key to .env');
  }

  const contextPrompt = ragContext
    ? `\n\nRelevant best practices and known patterns for reference:\n${ragContext}`
    : '';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + contextPrompt },
    { role: 'user', content: `Analyze this ${language} code:\n\n\`\`\`${language}\n${sourceCode}\n\`\`\`` },
  ];

  let lastError;

  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[i];
    try {
      logger.info(`Trying AI provider: ${provider.name}`);
      const startTime = Date.now();

      const requestOptions = {
        model: provider.model,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      };

      if (!provider.noJsonMode) {
        requestOptions.response_format = { type: 'json_object' };
      }

      const response = await provider.client.chat.completions.create(requestOptions);
      const processingTimeMs = Date.now() - startTime;
      const result = safeParseJSON(response.choices[0].message.content);

      logger.info(`Analysis completed via ${provider.name} in ${processingTimeMs}ms`);
      return { ...result, processingTimeMs, providerUsed: provider.name };

    } catch (err) {
      lastError = err;
      if (isQuotaError(err) && i < PROVIDERS.length - 1) {
        logger.warn(`Provider ${provider.name} unavailable — trying ${PROVIDERS[i + 1].name}`);
        continue;
      }
      logger.error(`AI analysis failed with ${provider.name}: ${err.message}`);
      throw new Error(`Analysis failed: ${err.message}`);
    }
  }

  throw new Error(`All AI providers exhausted. Last error: ${lastError?.message}`);
}

async function generateEmbedding(text) {
  if (!embeddingClient) {
    logger.info('Embedding skipped — no OpenAI key. RAG will use keyword fallback.');
    return null;
  }
  try {
    const response = await embeddingClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000),
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error(`Embedding generation failed: ${error.message}`);
    return null;
  }
}

async function fixCode(sourceCode, language, issues) {
  if (PROVIDERS.length === 0) throw new Error('No AI provider configured.');

  const issueList = issues
    .map((issue, n) => `${n + 1}. [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}${issue.suggestion ? ' Fix: ' + issue.suggestion : ''}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a code refactoring tool. Your job is to rewrite the given code so all detected issues are resolved.

Rules:
- Fix every issue in the list below
- Fix anything else you notice that isn't listed
- Use secure patterns: parameterized queries, no eval, no hardcoded secrets, subprocess.run over os.system
- Use os.environ for config/secrets — do not add packages like python-dotenv or django-environ
- Add brief docstrings and inline comments where they help readability
- Use idiomatic style for the language
- Add proper error handling and close resources in finally blocks
- Do not add any new third-party dependencies beyond what was already imported

Return only valid JSON with no markdown:
{"fixedCode":"<full rewritten code>","summary":"<one sentence describing the changes>"}`,
    },
    {
      role: 'user',
      content: `Rewrite this ${language} code.\n\nOriginal:\n\`\`\`${language}\n${sourceCode}\n\`\`\`\n\nIssues to fix:\n${issueList}\n\nStandard library only, no new dependencies.`,
    },
  ];

  let lastError;
  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[i];
    try {
      const startTime = Date.now();
      const requestOptions = { model: provider.model, messages, temperature: 0.1, max_tokens: 2000 };
      if (!provider.noJsonMode) requestOptions.response_format = { type: 'json_object' };

      const response = await provider.client.chat.completions.create(requestOptions);
      const processingTimeMs = Date.now() - startTime;
      const result = safeParseJSON(response.choices[0].message.content, 'fixedCode');

      logger.info(`Code fix completed via ${provider.name} in ${processingTimeMs}ms`);
      return { fixedCode: result.fixedCode, summary: result.summary || 'Code refactored.', processingTimeMs };
    } catch (err) {
      lastError = err;
      if (isQuotaError(err) && i < PROVIDERS.length - 1) {
        logger.warn(`Provider ${provider.name} unavailable during fix — trying ${PROVIDERS[i + 1].name}`);
        continue;
      }
      throw new Error(`Fix failed: ${err.message}`);
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

// Score the issues the same way analysisService does, so we can evaluate
// the quality of a fix before returning it to the user.
const FIX_PENALTIES = { critical: 20, high: 12, medium: 4, low: 1, info: 0 };
function scoreIssues(issues = []) {
  return Math.max(0, Math.min(100,
    100 - issues.reduce((s, issue) => s + (FIX_PENALTIES[issue.severity] || 0), 0)
  ));
}

// Runs fixCode, re-analyzes the result, and retries if the score is still below
// the target. Returns the best result seen across all attempts.
async function fixCodeWithValidation(sourceCode, language, issues, { targetScore = 80, maxAttempts = 2 } = {}) {
  let currentCode = sourceCode;
  let currentIssues = issues;
  let bestResult = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.info(`Fix attempt ${attempt}/${maxAttempts} for ${language} code...`);

    const fixResult = await fixCode(currentCode, language, currentIssues);

    let reAnalysis;
    try {
      reAnalysis = await analyzeCode(fixResult.fixedCode, language, '');
    } catch (e) {
      logger.warn(`Re-analysis on attempt ${attempt} failed: ${e.message}`);
      reAnalysis = { issues: [] };
    }

    const newScore = scoreIssues(reAnalysis.issues || []);
    const issueSummary = (reAnalysis.issues || []).reduce((m, issue) => {
      m[issue.severity] = (m[issue.severity] || 0) + 1;
      return m;
    }, {});
    logger.info(`Attempt ${attempt} score: ${newScore}/100 — issues: ${JSON.stringify(issueSummary)}`);

    if (newScore > bestScore) {
      bestScore = newScore;
      bestResult = {
        fixedCode: fixResult.fixedCode,
        summary: fixResult.summary,
        processingTimeMs: fixResult.processingTimeMs,
        attemptsUsed: attempt,
        finalScore: newScore,
      };
    }

    if (newScore >= targetScore) {
      logger.info(`Score target ${targetScore} reached after ${attempt} attempt(s)`);
      break;
    }

    if (attempt < maxAttempts) {
      currentCode = fixResult.fixedCode;
      currentIssues = reAnalysis.issues || [];
    }
  }

  if (!bestResult) throw new Error('Fix produced no valid result');
  logger.info(`Fix complete — best score: ${bestResult.finalScore}/100 in ${bestResult.attemptsUsed} attempt(s)`);
  return bestResult;
}

module.exports = {
  analyzeCode,
  fixCode,
  fixCodeWithValidation,
  generateEmbedding,
  providers: PROVIDERS.map(p => p.name),
  supportsEmbeddings: !!embeddingClient,
};
