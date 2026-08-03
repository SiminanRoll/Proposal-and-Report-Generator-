import type { HipaaQuestionDefinition } from "@/lib/projects/types";

export const HIPAA_QUESTIONS: HipaaQuestionDefinition[] = [
  {
    "id": "HIPAA-01",
    "title": "Assigned Security Responsibility",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Has the organization formally assigned responsibility for HIPAA security to a specific person or role?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Name and title",
      "Date assigned",
      "Supporting policy or job responsibility, when available"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-02",
    "title": "Written Security Policies and Procedures",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization maintain written HIPAA security policies and procedures appropriate to its operations and use of electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Access",
      "Passwords",
      "Devices",
      "Remote work",
      "Incidents",
      "Backups",
      "Vendors",
      "Workforce responsibilities"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-03",
    "title": "Policy Review and Maintenance",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Are HIPAA security policies reviewed and updated periodically and whenever meaningful operational, regulatory, staffing, or technology changes occur?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Last review date",
      "Review frequency",
      "Person responsible"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-04",
    "title": "Workforce Security Responsibilities",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Are workforce members informed of their security responsibilities and expected handling of electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "How responsibilities are communicated",
      "Whether acknowledgement is documented",
      "Whether responsibilities differ by role"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-05",
    "title": "Security Awareness and Training",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization provide recurring security and HIPAA awareness training to workforce members?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Training frequency",
      "New-hire process",
      "Completion tracking",
      "Phishing or security-awareness testing, when applicable"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-06",
    "title": "Sanction Policy",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization maintain and consistently apply a documented sanction process for workforce members who violate security or privacy policies?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Whether a written sanction policy exists",
      "Who administers it",
      "Whether actions are documented"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-07",
    "title": "Security Risk Analysis",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Has the organization completed and documented an accurate and thorough assessment of potential risks and vulnerabilities affecting electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Date of most recent assessment",
      "Scope",
      "Who completed it",
      "Whether all systems, locations, applications, and vendors were considered"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-08",
    "title": "Risk Management and Remediation",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization maintain a documented process for prioritizing, assigning, tracking, and resolving risks identified through assessments or security events?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Open risks",
      "Assigned owner",
      "Target date",
      "Accepted risks",
      "Remediation status"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-09",
    "title": "Business Associate Agreements",
    "category": "Organizational Requirements",
    "ownership": "client",
    "question": "Are current Business Associate Agreements maintained with vendors or service providers that create, receive, maintain, or transmit protected health information on the organization’s behalf?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Vendor name",
      "Agreement status",
      "Effective date",
      "Renewal or review date",
      "Missing agreements"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-10",
    "title": "Vendor Security Oversight",
    "category": "Organizational Requirements",
    "ownership": "client",
    "question": "Does the organization evaluate and periodically review the security practices of vendors that handle electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Vendor review process",
      "Security documentation requested",
      "Incident notification requirements",
      "Termination or offboarding requirements"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-11",
    "title": "Access Authorization",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does management approve access to systems containing electronic protected health information based on job responsibilities and the minimum access necessary?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Who approves access",
      "How requests are documented",
      "Whether role-based access is used"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-12",
    "title": "Identity Verification",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization verify the identity and authority of individuals before granting access to systems or disclosing protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [
      "This remains a questionnaire item but must not become a separate Identity score in the executive report."
    ],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-13",
    "title": "Workforce Changes and Termination",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization have a documented process to promptly remove or modify access when an employee or contractor changes roles or leaves the organization?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Notification process",
      "Responsible owner",
      "Expected completion time",
      "Whether access removal is documented"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-14",
    "title": "Facility Access",
    "category": "Physical Safeguards",
    "ownership": "client",
    "question": "Are physical access controls used to limit unauthorized access to facilities and areas containing systems or devices that store electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Keys or badges",
      "Restricted rooms",
      "Visitor procedures",
      "Server or network-equipment protection"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-15",
    "title": "Workstation and Device Use",
    "category": "Physical Safeguards",
    "ownership": "client",
    "question": "Does the organization maintain and enforce appropriate rules for the use, placement, and security of workstations, laptops, mobile devices, and other devices that may access electronic protected health information?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Screen positioning",
      "Device locking",
      "Remote work",
      "Personal devices",
      "Portable media"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-16",
    "title": "Documentation and Retention",
    "category": "Administrative Safeguards",
    "ownership": "client",
    "question": "Does the organization retain required HIPAA security documentation, assessments, policies, decisions, incidents, and supporting records for the required retention period?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Retention policy",
      "Storage location",
      "Responsible owner",
      "Disposal process"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-17",
    "title": "Contingency Planning",
    "category": "Administrative Safeguards",
    "ownership": "joint",
    "question": "Does the organization maintain a documented contingency plan for systems and operations involving electronic protected health information, and do the available technical recovery capabilities support that plan?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [
      "Written plan",
      "Operational priorities",
      "Responsible personnel"
    ],
    "advantageConfirms": [
      "Managed systems",
      "Backup capabilities",
      "Recovery dependencies"
    ],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-18",
    "title": "Disaster Recovery and Emergency Operations",
    "category": "Administrative Safeguards",
    "ownership": "joint",
    "question": "Are documented procedures in place to restore critical systems and continue essential operations following an outage, cyberattack, equipment failure, or other emergency?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Critical systems",
      "Recovery order",
      "Expected downtime",
      "Alternate operating procedures",
      "Communication process"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-19",
    "title": "Contingency Testing and Revision",
    "category": "Administrative Safeguards",
    "ownership": "joint",
    "question": "Are contingency, backup, and recovery procedures periodically tested, reviewed, and revised based on test results or operational changes?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Last test date",
      "Test type",
      "Results",
      "Problems found",
      "Corrective actions"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-20",
    "title": "Security Incident Response",
    "category": "Administrative Safeguards",
    "ownership": "joint",
    "question": "Does the organization maintain a documented process for identifying, reporting, escalating, responding to, and recovering from suspected security incidents?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [
      "Internal reporting process",
      "Management and legal contacts",
      "Breach-response responsibilities"
    ],
    "advantageConfirms": [
      "Technical notification and escalation procedures",
      "Available logs and monitoring"
    ],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-21",
    "title": "Incident Documentation and Corrective Action",
    "category": "Administrative Safeguards",
    "ownership": "joint",
    "question": "Are security incidents documented, investigated, retained, and followed by appropriate corrective actions?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Incident date",
      "Description",
      "Affected systems",
      "Response",
      "Outcome",
      "Corrective actions",
      "Closure date"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-22",
    "title": "User Account Administration",
    "category": "Technical Safeguards",
    "ownership": "joint",
    "question": "Are user accounts created, changed, reviewed, and removed through a consistent approval and administration process?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [
      "Approval process",
      "Role changes",
      "Workforce notifications"
    ],
    "advantageConfirms": [
      "Technical account changes in managed systems",
      "Available account records"
    ],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-23",
    "title": "Device and Media Disposal",
    "category": "Physical Safeguards",
    "ownership": "joint",
    "question": "Are devices and media containing electronic protected health information inventoried, handled, reused, and disposed of securely?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [
      "Internal handling process",
      "Third-party disposal vendors",
      "Records retained"
    ],
    "advantageConfirms": [
      "Technical wiping or destruction methods for equipment handled by Advantage"
    ],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-24",
    "title": "Secure System Implementation and Change Management",
    "category": "Technical Safeguards",
    "ownership": "joint",
    "question": "Are security and HIPAA risks considered before implementing new systems, applications, devices, integrations, or significant configuration changes?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [
      "Approval",
      "Security review",
      "Backup impact",
      "Access impact",
      "Data-flow impact",
      "Vendor involvement"
    ],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-25",
    "title": "Managed Endpoint Protection",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are Advantage-managed servers and workstations protected by current, centrally managed endpoint security or anti-malware controls?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "Device count",
      "Protection status",
      "Last check-in",
      "Detection coverage",
      "Unprotected devices",
      "Devices requiring remediation"
    ],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-26",
    "title": "Continuous Security Monitoring",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are supported systems monitored for security events, suspicious behavior, device-health concerns, or other indicators requiring investigation?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [],
    "notes": [
      "Use “continuous security monitoring” in client-facing wording.",
      "Do not use “SOC.”"
    ],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-27",
    "title": "Log Collection and Review",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are relevant security and system logs collected, reviewed, and used to identify suspicious activity or operational problems?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "Systems covered",
      "Alerting capability",
      "Review process",
      "Retention",
      "Investigated signals"
    ],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-28",
    "title": "Unique User Identification",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Do users have unique credentials for access to systems containing electronic protected health information, with shared accounts avoided or appropriately controlled?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "Known shared accounts",
      "Named-user coverage",
      "Administrative accounts",
      "Service accounts"
    ],
    "notes": [
      "Do not turn this into a separate Identity category in the report."
    ],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-29",
    "title": "Authentication Controls",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are appropriate authentication controls implemented for managed systems, including password standards and multifactor authentication where supported or required?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "MFA coverage",
      "Password-policy status",
      "Systems without MFA",
      "Exceptions",
      "Compensating controls"
    ],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-30",
    "title": "Temporary, Vendor, and Emergency Accounts",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are temporary, vendor, emergency, and remote-support accounts controlled, time-limited where possible, reviewed, and disabled when no longer required?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "Active temporary accounts",
      "Vendor accounts",
      "Last-use date",
      "Expiration",
      "Remote-access controls"
    ],
    "notes": [],
    "originalControlMapId": null,
    "regulationMappings": []
  },
  {
    "id": "HIPAA-31",
    "title": "Technical Backup Verification",
    "category": "Technical Safeguards",
    "ownership": "advantage-prefill",
    "question": "Are backups for Advantage-managed systems containing electronic protected health information completed, monitored, protected, and periodically tested?",
    "plainLanguageExplanation": "Confirm the organization’s policy, process, or workforce practice and retain supporting documentation when available.",
    "reviewPrompts": [],
    "clientConfirms": [],
    "advantageConfirms": [],
    "evidenceHints": [
      "Backup status",
      "Last successful backup",
      "Failed jobs",
      "Offsite or cloud protection",
      "Encryption",
      "Last recovery test",
      "Recovery result"
    ],
    "notes": [
      "This technical question is separate from the broader client contingency-plan questions."
    ],
    "originalControlMapId": null,
    "regulationMappings": []
  }
] as HipaaQuestionDefinition[];

export const HIPAA_QUESTION_COUNT = HIPAA_QUESTIONS.length;
