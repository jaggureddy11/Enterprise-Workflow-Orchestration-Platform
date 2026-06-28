// services/ai-service/src/index.ts
import { initTelemetry } from '@ewap/telemetry';
initTelemetry('ai-service');

import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { WorkflowGeneratorChain, generateStubWorkflow } from './chains/workflow-generator.chain';
import { isAppError, ValidationError } from '@ewap/shared';
import { metricsHandler } from '@ewap/telemetry';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const app: express.Application = express();
app.use(express.json());

const GenerateWorkflowSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  context: z.record(z.unknown()).optional().default({}),
});

const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
const generator = hasOpenAiKey ? new WorkflowGeneratorChain() : null;

if (!hasOpenAiKey) {
  logger.warn('[AI Service] OPENAI_API_KEY not set — using stub responses for testing');
}

// POST /ai/generate-workflow per PRD §10.6
app.post('/ai/generate-workflow', async (req, res, next) => {
  try {
    const input = GenerateWorkflowSchema.safeParse(req.body);
    if (!input.success) throw new ValidationError('Invalid input', input.error.flatten() as any);

    let workflow;

    if (generator) {
      workflow = await generator.generate(input.data.prompt);
    } else {
      // Stub mode for development without OpenAI key
      workflow = generateStubWorkflow(input.data.prompt);
    }

    res.json({
      success: true,
      data: workflow,
      meta: { mode: hasOpenAiKey ? 'live' : 'stub', timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

// POST /ai/suggest-steps — Stub implementation
app.post('/ai/suggest-steps', async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        suggestions: [
          { type: 'TASK', name: 'Manager Approval', config: { assigneeType: 'ROLE', assignee: 'MANAGER', slaHours: 48 } },
          { type: 'NOTIFICATION', name: 'Send Confirmation', config: { channel: 'EMAIL', template: 'workflow-completed' } },
        ],
      },
    });
  } catch (error) { next(error); }
});

// POST /ai/detect-anomalies — Stub implementation
app.post('/ai/detect-anomalies', async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        anomalies: [],
        analysisTimestamp: new Date().toISOString(),
        message: 'No anomalies detected',
      },
    });
  } catch (error) { next(error); }
});

app.get('/metrics', metricsHandler as any);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ai-service', openAiConnected: hasOpenAiKey }));

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  logger.error({ err });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const PORT = parseInt(process.env.PORT ?? '4006', 10);
app.listen(PORT, () => logger.info(`[AI Service] Listening on port ${PORT}${hasOpenAiKey ? '' : ' (STUB MODE)'}`));

export { app };
