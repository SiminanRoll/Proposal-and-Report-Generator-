"use client";

import { captainsLogCloudRest } from "./captains-log-cloud";

export interface A360OtaHandoffRequest {
  handoffId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  timeZone: string;
  consultantName: string;
}

export interface A360OtaHandoffResult {
  ok: boolean;
  status: string;
  handoff_id: string;
  company_id: string;
  company: string;
  relationship_type: string;
  company_status: string | null;
  task_id: string;
  task_type: "Meeting" | string;
  tag: "Sales" | string;
  completed_at: string;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function writeA360OtaHandoffToCaptainsLog(request: A360OtaHandoffRequest): Promise<A360OtaHandoffResult> {
  const handoffId = clean(request.handoffId);
  const companyName = clean(request.companyName);
  const contactName = clean(request.contactName);
  const email = clean(request.email).toLowerCase();
  const phone = clean(request.phone);
  const appointmentDate = clean(request.appointmentDate).slice(0, 10);
  const appointmentTime = clean(request.appointmentTime).slice(0, 5);
  const timeZone = clean(request.timeZone);
  const consultantName = clean(request.consultantName);

  if (!handoffId || !companyName || !contactName || !email || !phone || !appointmentDate || !appointmentTime || !timeZone || !consultantName) {
    throw new Error("The OTA handoff is missing required prospect or appointment information.");
  }

  const result = await captainsLogCloudRest<A360OtaHandoffResult>("POST", "rpc/record_a360_ota_handoff", {
    p_handoff_id: handoffId,
    p_company_name: companyName,
    p_contact_name: contactName,
    p_email: email,
    p_phone: phone,
    p_appointment_date: appointmentDate,
    p_appointment_time: appointmentTime,
    p_time_zone: timeZone,
    p_consultant_name: consultantName,
  });

  if (!result?.ok || !clean(result.company_id) || !clean(result.task_id)) {
    throw new Error("Captain's Log did not confirm the OTA handoff.");
  }

  return result;
}
