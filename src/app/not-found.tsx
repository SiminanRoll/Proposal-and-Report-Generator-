import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="empty-state large">
        <span className="eyebrow">Not found</span>
        <h1>That workspace is not available.</h1>
        <p>Return to the dashboard and open one of your saved workspaces.</p>
        <Link className="button primary" href="/">Back to workspaces</Link>
      </div>
    </main>
  );
}
