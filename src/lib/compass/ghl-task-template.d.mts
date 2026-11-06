export const GHL_TASK_TEMPLATE_KEY: string;
export interface GhlTaskTemplate {
  title: string;
  description: string;
  dueBusinessDays: number;
  dueTime: string;
  timeZone: string;
}
export const DEFAULT_GHL_TASK_TEMPLATE: Readonly<GhlTaskTemplate>;
export function validateGhlTaskTemplate(value: unknown): GhlTaskTemplate | null;
export function dueDateForTaskTemplate(
  template: GhlTaskTemplate, now?: Date
): { date: string; time: string; timeZone: string };
