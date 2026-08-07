export interface CaptainsLogCoordinationCallRequest {
  clientId: string;
  company: string;
  dueDate: string;
  priorityReason?: string;
  requestId?: string;
}

export function coordinationCallTaskTitle(company: string): string {
  const cleanCompany = String(company || "Client").trim() || "Client";
  return `Coordination Call - ${cleanCompany} - Account Review Priority`;
}

export function nextBusinessDate(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 12, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function captainsLogCoordinationCallUrl(request: CaptainsLogCoordinationCallRequest): string {
  const params = new URLSearchParams({
    client_id: request.clientId,
    company: request.company,
    due: request.dueDate,
    title: coordinationCallTaskTitle(request.company),
    tag: "Client Coordination",
    task_type: "Call",
    source: "client_compass",
  });
  if (request.requestId?.trim()) params.set("request_id", request.requestId.trim().slice(0, 100));
  if (request.priorityReason?.trim()) params.set("reason", request.priorityReason.trim().slice(0, 500));
  return `captainslog://coordination-call?${params.toString()}`;
}
