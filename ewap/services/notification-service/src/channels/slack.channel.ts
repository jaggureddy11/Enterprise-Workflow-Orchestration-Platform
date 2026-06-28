// services/notification-service/src/channels/slack.channel.ts
// Slack webhook delivery per PRD §8.5

export interface SlackPayload {
  recipient: string; // webhook URL
  templateData: Record<string, unknown>;
  templateId: string;
}

export async function sendSlack(payload: SlackPayload): Promise<void> {
  const message = buildSlackMessage(payload.templateId, payload.templateData);

  const response = await fetch(payload.recipient, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message, username: 'EWAP Bot', icon_emoji: ':robot_face:' }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }
}

function buildSlackMessage(templateId: string, data: Record<string, unknown>): string {
  switch (templateId) {
    case 'task-assigned':
      return `🔔 *New Task Assigned*\n*Task:* ${data.title ?? 'Unknown'}\n*Due:* ${data.dueAt ?? 'N/A'}`;
    case 'workflow-completed':
      return `✅ *Workflow Completed*\n*Instance:* ${data.instanceId ?? 'Unknown'}`;
    case 'welcome-employee':
      return `👋 *Welcome to the team!*\n${JSON.stringify(data)}`;
    default:
      return `📢 EWAP Notification: ${JSON.stringify(data)}`;
  }
}
