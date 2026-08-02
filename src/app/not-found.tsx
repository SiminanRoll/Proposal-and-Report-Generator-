import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="empty-state large">
        <span className="eyebrow">Not found</span>
        <h1>That project is not available.</h1>
        <p>Return to the workspace and open one of your saved projects.</p>
        <Link className="button primary" href="/">Back to projects</Link>
      </div>
    </main>
  );
}
