# v1.0.0.7 build hotfix

Corrected the production TypeScript failure in `src/components/hipaa-presentation.tsx` by importing `answerIsComplete` from the HIPAA engine before using it in the completed-session summary.

Added an automated regression test that verifies the helper is both exported and imported where it is called.
