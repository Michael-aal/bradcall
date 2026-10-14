# Bradcall: differentiation roadmap

Bradcall's product direction is to become a trusted local-services network, not simply a searchable list of providers. This roadmap combines five connected pillars with additional ideas for later releases.

## Five core pillars

### 1. Community Service Graph
- Suggest related categories based on completed bookings in the same service area.
- Only publish a category-to-category signal when at least three distinct customers have completed both categories in that area.
- Return aggregate category, area, and cohort size only; never return customer IDs or individual booking histories.
- If the data threshold is not met, show no inferred relationship rather than inventing a recommendation.

### 2. Proof-of-Work Reputation
- Public service listings show completed booking count and average review rating.
- Reviews remain tied to completed bookings and each booking can have one review.
- Keep provider verification separate from customer ratings: a high rating is not identity verification.
- Avoid penalising new providers merely because they have not accumulated reviews yet.

### 3. Live Service Pulse
- Providers can mark themselves available or temporarily unavailable.
- The provider availability timestamp is updated when availability is saved and shown as a freshness cue.
- Availability is an expression of intent, not a guarantee of immediate response. Future versions can add explicit response-time statistics after enough data exists.

### 4. Fair-Price Service Standard
- Keep the existing provider-proposed agreed price and appointment flow.
- Customer approval is required before the agreed terms count as approved.
- Any price or appointment change must invalidate the prior approval.
- Future price changes should be recorded as a quote revision history, not silently overwrite the original offer.

### 5. Local Opportunity Engine
- Aggregate service-request demand by category and public service area over the last 30 days.
- Only show an opportunity signal after at least three distinct customers appear in the cohort.
- Compare unique customer demand with distinct active providers, prioritising the provider's own service areas.
- Never show customer names, request details, or precise customer locations in this dashboard.

## Additional ideas to evaluate

1. **Quote Passport** — a reusable, itemised quote with scope, exclusions, expected duration, materials, and approval history.
2. **No-show protection** — both sides confirm arrival and milestones; no-show reports require evidence and a fair response window.
3. **Service Recovery Promise** — a documented escalation path when a provider cancels, a job is incomplete, or the agreed scope changes.
4. **Skill Evidence Cards** — optional certificates, portfolios, references, and sample work, each clearly labelled as provider-supplied or independently verified.
5. **Neighbourhood Reliability Index** — aggregate response and completion trends only after a minimum sample size; do not rank tiny cohorts.
6. **Fair New-Provider Boost** — limited discovery exposure for capable new providers so reputation systems do not permanently favour incumbents.
7. **Repeat-Service Plans** — reminders and rebooking for recurring services such as cleaning, maintenance, and tutoring.
8. **Team and Business Accounts** — allow legitimate service businesses to manage several staff members, service areas, and shared bookings.
9. **Service Bundles** — customers can request a planned set of related services with separate scope and pricing for each provider.
10. **Emergency-versus-scheduled intent** — distinguish urgent requests from appointments, without promising emergency response or replacing emergency services.
11. **Customer Service Brief** — a structured checklist and optional photos so providers understand the task before accepting it.
12. **Offline-friendly workflow** — keep a draft request and booking details available when connectivity is unreliable, while syncing safely once online.
13. **Provider earnings and demand insights** — show each provider their own completed jobs, conversion, cancellation rate, and category demand.
14. **Community referral trail** — let customers recommend providers, but distinguish personal referrals from verified completed-work reviews.
15. **Fraud-resistant milestone receipts** — record acceptance, arrival, agreed scope, completion, customer confirmation, and dispute state in an auditable timeline.
16. **Accessibility and language support** — clear low-bandwidth UI, readable text, and carefully reviewed local-language support.
17. **Transparent dispute evidence pack** — collect quote versions, booking messages, payment status, and milestone timestamps for authorised case review.
18. **Provider learning loop** — offer practical guidance when listings are unclear, customers frequently request missing details, or quotes are repeatedly declined.

## Product and safety rules

- Do not call any feature unique to the entire market without competitor research.
- Do not describe Paystack as escrow or promise funds are held until completion unless the payment flow and provider agreement explicitly support that arrangement.
- Never publish a customer's identity, booking details, or precise location in aggregate insight panels.
- AI may help triage reports, but consequential warnings, suspensions, bans, refunds, and dispute decisions require accountable human review.
- Keep privacy, fair treatment of new providers, and clear consent as product requirements.
- The current implementation still requires automated tests, migration validation against the deployed database, and end-to-end testing before production release.
