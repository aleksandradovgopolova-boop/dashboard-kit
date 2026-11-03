# Validate and compile the first typed static dashboard recipe

The kit now checks overview KPI/slot rules within declared screen scopes,
shares four minimal parameter schemas through manifest/CLI/MCP/skill, and
builds a validated plan-fact specification into an actual static consumer.
Bindings, types, grain, actions, dependencies and escaping are checked before
writing; real filters, numeric sort, details, partial/empty states and return
focus work without a framework or nested agent.

The editorial pass removed false mobile empty state and unsupported trend,
disabled disconnected static filters, fixed reduced-motion charts and retained
useful labels/units/periods/statuses. All seven examples were reviewed.

Validation: scoped positive/negative fixtures, deterministic packages, real
consumer static checks, 12 new-screen Chrome views, 148 example views,
reference API regression and independent analyst/UX review. Full local suite
and seven-tool MCP passed subsequently. Remote CI requires authorized push.
Evidence/limits: screen-contract.md. Only local daily plan-fact ≤1000 rows,
single select, four typed adapters; other recipes remain normal SDK assembly.

Closes #37, #67, #68 after review and authorized merge. No deploy or SDK promotion.
