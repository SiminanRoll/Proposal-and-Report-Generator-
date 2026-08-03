# Version 1.0.2.5

## Cloud Plus BDR recovery

- Adds a second-pass recovery parser for CPBDR / CP-BDR / CP BDR / CPBR and EQUUS appliances.
- Recovers devices when the ScalePad PDF splits the hostname, check-in date, manufacturer, age, and warranty details across separate extracted lines.
- Detects the appliance even when it is outside the normal Servers table or the standard full-row parser cannot read its OS, CPU, or storage fields.
- Deduplicates recovered backup appliances against normally parsed server rows and preserves the Cloud Plus BDR classification.
- Includes the recovered appliance in asset totals, lifecycle priorities, technology planning, and HIPAA backup-and-recovery evidence.

## Security closing statement

- Rewrites the security close in client-facing language.
- Explains 24/7 anti-malware, anti-ransomware, and advanced threat detection and response without technical process language.
- Clearly asks clients to contact Advantage before connecting a new or replacement computer so it can be protected from day one.
- Retains a reasonable statement that no security solution eliminates every risk.

## Existing workspaces

Use **Reprocess cached sources** after deploying this version so previously stored ScalePad text is analyzed by the new recovery parser. If the original browser file cache is no longer available, remove and reattach the ScalePad PDF.
