import {
  checkSLABreaches,
  escalateBreachedIssues,
} from "../services/sla.service";

export function startSLABreachJob() {
  const CHECK_INTERVAL = 60 * 1000; // 1 minute

  const timer = setInterval(async () => {
    try {
      const breachedResults = await checkSLABreaches();

      if (breachedResults.length > 0) {
        console.log(
          `SLA breach job: ${breachedResults.length} issue(s) breached`
        );
      }

      const escalatedResults = await escalateBreachedIssues();

      if (escalatedResults.length > 0) {
        console.log(
          `SLA escalation job: ${escalatedResults.length} issue(s) escalated`
        );
      }
    } catch (error) {
      console.error("SLA breach/escalation job error:", error);
    }
  }, CHECK_INTERVAL);

  console.log("SLA breach and escalation job started");

  return timer;
}