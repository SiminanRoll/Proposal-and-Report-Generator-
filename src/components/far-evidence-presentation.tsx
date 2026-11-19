import type { Project } from "@/lib/projects/types";
import { farPresentationItems, FAR_CATEGORY_LABEL } from "@/lib/far/far-review";
import styles from "./far-evidence-presentation.module.css";

const sections = ["service-value", "open-decision", "potential-adjustment"] as const;

export function FarEvidencePresentation({ project }: { project: Project }) {
  const groups = farPresentationItems(project);
  return <section className={styles.root} aria-labelledby="far-client-heading">
    <header className={styles.hero}>
      <span className={styles.eyebrow}>ACCOUNT REVIEW</span>
      <h2 id="far-client-heading">What matters most</h2>
      <p>Our recent work and the next decisions worth discussing.</p>
    </header>
    <div className={styles.grid}>
      {sections.filter((kind) => groups[kind].length > 0).map((kind) => <article key={kind} className={styles.column}>
        <span className={styles.label}>{FAR_CATEGORY_LABEL[kind]}</span>
        <ul>{groups[kind].map((item) => <li key={item.id}><span aria-hidden="true">✓</span>{item.clientText}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}
