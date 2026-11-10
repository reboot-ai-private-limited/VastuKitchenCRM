# Risks

| Risk | Impact | Mitigation |
|---|---|---|
| WhatsApp Cloud API needs Meta business verification + approved templates | Auto-send blocked | Use `wa.me` prefilled link for MVP ([ADR-0004](../adr/0004-whatsapp-wa-me.md)) |
| Call-log access is Android-only and needs permission | Call tracking gaps | Sideloaded APK so no Play restrictions; manual outcome entry as fallback |
| Cron needs a persistent server | Reminders fail on Vercel | API hosted on Render/Railway/VPS, not Vercel |
| Scope creep ("Basecamp-like" everything) | Miss deadline | Follow [mvp-scope](../01-scope/mvp-scope.md); cut order in [roadmap](roadmap.md) |
| Push notifications (FCM + RN setup) eat time | Day 9 overrun | In-app notifications are baseline; push is cut item #1 |
| Real biometric (Hikvision) needs registration + LAN | Can't demo live | Simulated punches for MVP; real integration post-pricing |
| Cloudinary free-tier limits with unlimited photos | Uploads blocked | Fine for demo; plan S3 switch via storage interface |
| Missing client branding/proposal format | Rework | Generic clean template; swap branding later |
