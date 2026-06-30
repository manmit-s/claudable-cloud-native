const { query } = require('@anthropic-ai/claude-agent-sdk');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompt: '',
    model: '',
    sessionId: undefined,
    dir: '/workspace',
    maxTokens: undefined
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      parsed.prompt = args[i + 1];
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      parsed.model = args[i + 1];
      i++;
    } else if (args[i] === '--session-id' && args[i + 1]) {
      parsed.sessionId = args[i + 1];
      i++;
    } else if (args[i] === '--dir' && args[i + 1]) {
      parsed.dir = args[i + 1];
      i++;
    } else if (args[i] === '--max-tokens' && args[i + 1]) {
      parsed.maxTokens = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return parsed;
}

async function main() {
  const config = parseArgs();
  if (!config.prompt) {
    console.error('Error: --prompt is required');
    process.exit(1);
  }

  try {
    const response = query({
      prompt: config.prompt,
      options: {
        workingDirectory: config.dir,
        additionalDirectories: [config.dir],
        model: config.model || undefined,
        resume: config.sessionId || undefined,
        permissionMode: 'bypassPermissions',
        systemPrompt: `You are an expert web developer building a Next.js application.
- Use Next.js 15 App Router
- Use TypeScript
- Use Tailwind CSS for styling
- Write clean, production-ready code
- Follow best practices
- The platform automatically installs dependencies and manages the preview dev server. Do not run package managers or dev-server commands yourself; rely on the existing preview.
- Keep all project files directly in the project root. Never scaffold frameworks into subdirectories (avoid commands like "mkdir new-app" or "create-next-app my-app"; run generators against the current directory instead).
- Never override ports or start your own development server processes. Rely on the managed preview service which assigns ports from the approved pool.
- When sharing a preview link, read the actual NEXT_PUBLIC_APP_URL (e.g. from .env/.env.local or project metadata) instead of assuming a default port.
- Prefer giving the user the live preview link that is actually running rather than written instructions.`,
        maxOutputTokens: config.maxTokens || undefined,
        stderr: (data) => {
          process.stderr.write(data);
        }
      }
    });

    for await (const message of response) {
      console.log(JSON.stringify(message));
    }
  } catch (error) {
    console.error('Fatal error during execution:', error);
    process.exit(1);
  }
}

main();
