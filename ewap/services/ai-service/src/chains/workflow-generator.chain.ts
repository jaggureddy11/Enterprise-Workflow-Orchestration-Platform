// services/ai-service/src/chains/workflow-generator.chain.ts
// LangChain + GPT-4o-mini workflow generator per PRD §8.8

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { WORKFLOW_GENERATION_SYSTEM_PROMPT } from '../prompts/workflow-generation.prompt';

// Zod schema for LLM output validation
const StepConfigSchema = z.record(z.unknown());

const WorkflowStepSchema = z.object({
  name: z.string(),
  type: z.enum(['TASK', 'NOTIFICATION', 'CONDITION', 'DELAY', 'WEBHOOK', 'AI_ACTION']),
  order: z.number().int().positive(),
  isTerminal: z.boolean().optional().default(false),
  config: StepConfigSchema,
});

const WorkflowDefinitionOutputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  triggerType: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'EVENT']).default('MANUAL'),
  triggerConfig: z.record(z.unknown()).default({}),
  definition: z.object({
    steps: z.array(WorkflowStepSchema),
  }),
});

export type WorkflowDefinitionOutput = z.infer<typeof WorkflowDefinitionOutputSchema>;

export class WorkflowGeneratorChain {
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(userInput: string): Promise<WorkflowDefinitionOutput> {
    const parser = new JsonOutputParser<WorkflowDefinitionOutput>();

    const chain = ChatPromptTemplate.fromMessages([
      ['system', WORKFLOW_GENERATION_SYSTEM_PROMPT],
      ['human', '{input}'],
    ])
      .pipe(this.llm)
      .pipe(parser);

    const result = await chain.invoke({ input: userInput });

    // Validate output against Zod schema before returning
    return WorkflowDefinitionOutputSchema.parse(result);
  }
}

/**
 * Stub for when OPENAI_API_KEY is not set — returns a sample workflow for testing.
 */
export function generateStubWorkflow(userInput: string): WorkflowDefinitionOutput {
  return {
    name: `Generated: ${userInput.substring(0, 50)}`,
    description: `Auto-generated from: "${userInput}"`,
    triggerType: 'MANUAL',
    triggerConfig: {},
    definition: {
      steps: [
        {
          name: 'Manager Approval',
          type: 'TASK',
          order: 1,
          isTerminal: false,
          config: {
            assigneeType: 'ROLE',
            assignee: 'MANAGER',
            slaHours: 48,
            priority: 'HIGH',
            formSchema: {
              fields: [
                { name: 'decision', type: 'radio', options: ['APPROVED', 'REJECTED'], required: true },
                { name: 'comments', type: 'textarea', required: false },
              ],
            },
          },
        },
        {
          name: 'Send Notification',
          type: 'NOTIFICATION',
          order: 2,
          isTerminal: true,
          config: {
            channel: 'EMAIL',
            template: 'workflow-completed',
          },
        },
      ],
    },
  };
}
