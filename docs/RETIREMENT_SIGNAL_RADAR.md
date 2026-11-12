# Signal Radar static dashboard retirement

The standalone Signal Intelligence dashboard is retired. Its public static assets, duplicate source shell, UI-only tests and map-only route components were removed in this change. Historical signal records and operational ingestion/GHL handoff functions remain separate and are not removed.

The actively used Service Area Checker at https://plankton-app-otxyy.ondigitalocean.app/ is a different application (`SiminanRoll/ServiceAreaChecker`) and is not part of this retirement.

Rollback: revert the dashboard retirement commit and rebuild/redeploy Client Compass if the static shell must be restored.
