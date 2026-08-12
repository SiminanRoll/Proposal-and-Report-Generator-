import type { Project } from "@/lib/projects/types";
import { clientDeviceDisplayName, inventoryReportDevices } from "@/lib/outcomes/client-report-data";

export function BackupRecoveryPresentation({ project }: { project: Project }) {
  const bdrDevices = inventoryReportDevices(project).filter((device) => device.type === "backup-server");
  const protectedHere = bdrDevices.length > 0;

  return (
    <div className="presentation-section-layout">
      <div className="presentation-section-heading">
        <span className="presentation-kicker">Backup & disaster recovery</span>
        <h2>{protectedHere ? "Your backup is built to become your emergency server." : "A backup should get you working again — not just preserve a copy of your data."}</h2>
        <p>
          Advantage Cloud Plus BDR is designed around fast recovery. It captures a server backup every hour, keeps a copy onsite for fast local recovery, replicates that backup to the cloud for offsite protection, and can run the protected server workload as an emergency standby server if the primary server becomes unavailable.
        </p>
      </div>

      <div className="presentation-plan">
        <article>
          <b>01</b>
          <div><h3>Backup every hour</h3><p>A fresh server recovery point is captured each hour so a failure does not automatically mean losing an entire day of work.</p></div>
        </article>
        <article>
          <b>02</b>
          <div><h3>Stored onsite</h3><p>A local copy stays close to the practice, giving the recovery process fast access to protected server data when every minute matters.</p></div>
        </article>
        <article>
          <b>03</b>
          <div><h3>Replicated to the cloud</h3><p>An offsite copy protects the recovery path even when the local office, server room, or onsite equipment is part of the disaster.</p></div>
        </article>
        <article>
          <b>04</b>
          <div><h3>Emergency standby server</h3><p>If the primary server fails, the protected workload can be brought online on the BDR so the team can keep working while the permanent server is repaired or replaced.</p></div>
        </article>
      </div>

      <div className="security-feature-grid">
        <article className="ransomware-feature">
          <div className="security-feature-icon">DR</div>
          <div>
            <span>Traditional recovery</span>
            <h3>A server failure can become a multi-day outage.</h3>
            <p>Without a standby recovery platform, replacement hardware may need to arrive, the operating environment may need to be rebuilt, data may need to be restored, and applications may need to be validated before normal work resumes.</p>
          </div>
        </article>
        <article className="antivirus-feature">
          <div className="security-feature-icon">BDR</div>
          <div>
            <span>Cloud Plus BDR recovery</span>
            <h3>Designed to get the practice back up in minutes instead of days.</h3>
            <p>The BDR can temporarily take over the protected server workload, giving Advantage time to repair or replace the primary server without making the hardware replacement itself the starting point for recovery.</p>
          </div>
        </article>
      </div>

      <aside className="security-protection-statement">
        <span>{protectedHere ? "Cloud Plus BDR in this environment" : "The continuity goal"}</span>
        <p>{protectedHere
          ? `The current inventory includes ${bdrDevices.map((device) => clientDeviceDisplayName(device)).join(", ")}. The value of that system is not simply that another copy exists — it is that the backup platform can become part of the recovery environment when the primary server is unavailable.`
          : "The goal is to shorten the distance between a server failure and the moment the team can work again. Cloud Plus BDR combines frequent backups, onsite and cloud copies, and emergency standby capability into one recovery path."}</p>
      </aside>
    </div>
  );
}
