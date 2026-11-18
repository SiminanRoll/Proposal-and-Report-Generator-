import type { Project } from "@/lib/projects/types";
import { factNumber, inventoryReportDevices } from "@/lib/outcomes/client-report-data";
import styles from "./security-safeguards-presentation.module.css";

/**
 * Cross-industry security ownership slide.
 * This is an explanation of potential managed controls and responsibilities, not a
 * compliance score or a claim that every service is active for every client.
 */
export function SecuritySafeguardsPresentation({ project }: { project: Project }) {
  const monitoredEntities = factNumber(project, "huntress.entitiesProtected");
  const hasBackupServer = inventoryReportDevices(project).some((device) => device.type === "backup-server");

  const measures = [
    {
      title: "Endpoint protection & monitoring",
      detail: "Threat detection, managed antivirus, security alerts, and investigation for devices covered by the service.",
      evidence: monitoredEntities > 0
        ? `${monitoredEntities} protected ${monitoredEntities === 1 ? "entity" : "entities"} in the available monitoring data`
        : "Verify covered devices and monitoring evidence",
    },
    {
      title: "Backup & recovery readiness",
      detail: "Managed backups, backup alerts, and recovery coordination for covered systems. The protected data and restore-test scope must be confirmed.",
      evidence: hasBackupServer
        ? "A backup server is listed in the inventory; verify its protected workloads"
        : "Confirm backup coverage and recovery-test evidence",
    },
    {
      title: "Device & network safeguards",
      detail: "Supported systems, maintenance, endpoint configuration, and network or firewall protections where included in the managed agreement.",
      evidence: "Confirm in-scope devices, updates, network equipment, and exceptions",
    },
    {
      title: "Identity & secure access",
      detail: "Technical help with account security, multifactor authentication, and secure remote access where supported. The organization approves who gets access.",
      evidence: "Review MFA, account access, and remote-access scope",
    },
  ];

  return (
    <div className={`presentation-section-layout ${styles.root}`}>
      <div className="presentation-section-heading">
        <span className="presentation-kicker">Security safeguards | All industries</span>
        <h2>Technology protection first. Compliance support, not compliance consulting.</h2>
        <p>Advantage helps protect the systems your business relies on. The same security fundamentals matter in healthcare, legal services, accounting, payment-card environments, manufacturing, and more.</p>
      </div>
      <div className={styles.layout}>
        <section className={styles.managed}>
          <div className={styles.sectionHead}>
            <span className={styles.role}>ADVANTAGE TECHNOLOGIES</span>
            <h3>Technical safeguards we manage or help implement</h3>
            <p>Actual coverage depends on the service agreement, managed inventory, and verified configuration.</p>
          </div>
          <div className={styles.measures}>
            {measures.map((item) => (
              <article className={styles.measure} key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
                <small>{item.evidence}</small>
              </article>
            ))}
          </div>
        </section>
        <aside className={styles.side}>
          <section className={styles.responsibility}>
            <span className={styles.role}>SHARED RESPONSIBILITY</span>
            <h3>What we coordinate together</h3>
            <p>Access changes, secure information sharing, incident escalation, identifying systems outside support, and planning recovery priorities.</p>
          </section>
          <section className={styles.responsibility}>
            <span className={styles.role}>CLIENT / QUALIFIED ADVISER</span>
            <h3>What remains with your organization</h3>
            <p>Written policies, formal risk assessments, staff training, regulatory interpretation, required agreements, and breach-notification decisions.</p>
          </section>
        </aside>
      </div>
      <p className={styles.complianceNote}>
        <strong>How this relates to compliance:</strong> These technical measures can support HIPAA, PCI DSS, legal confidentiality obligations, and other applicable standards. Coverage of a safeguard is not a certification or a determination that an organization complies with any framework.
      </p>
    </div>
  );
}
