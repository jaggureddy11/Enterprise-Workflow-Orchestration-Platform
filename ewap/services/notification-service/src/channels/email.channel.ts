// services/notification-service/src/channels/email.channel.ts
// Email delivery via nodemailer per PRD §8.5

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT ?? '2525', 10),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailPayload {
  recipient: string;
  templateId: string;
  templateData: Record<string, unknown>;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const html = renderTemplate(payload.templateId, payload.templateData);

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'noreply@ewap.dev',
    to: payload.recipient,
    subject: getSubject(payload.templateId),
    html,
  });
}

function getSubject(templateId: string): string {
  const subjects: Record<string, string> = {
    'welcome-employee': 'Welcome to the team!',
    'task-assigned': 'You have a new task assigned',
    'workflow-completed': 'Workflow completed successfully',
    'task-expired': 'Action required: Task overdue',
  };
  return subjects[templateId] ?? 'EWAP Notification';
}

function renderTemplate(templateId: string, data: Record<string, unknown>): string {
  const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.html`);

  let template: string;
  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    // Fallback to simple template
    template = `<h2>EWAP Notification</h2><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  // Simple mustache-style variable substitution
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
    const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data);
    return value != null ? String(value) : match;
  });
}
