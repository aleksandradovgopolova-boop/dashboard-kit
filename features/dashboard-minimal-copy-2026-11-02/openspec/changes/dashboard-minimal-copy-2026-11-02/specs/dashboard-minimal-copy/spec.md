## ADDED Requirements

### Requirement: R1 Minimal visible copy
The dashboard SHALL show data, labels, units, concise context, statuses and actions in its normal working state while moving explanatory prose to information available on request.

#### Scenario: Full data without explanatory placeholders
- WHEN the full dataset is displayed
- THEN required values and labels remain visible and no empty explanatory row, control or reserved space is displayed.

#### Scenario: Read the primary answer
- WHEN the user reads the main metric without opening help
- THEN its meaning and concise status are understandable, while formulas and detailed explanations remain available on request.

### Requirement: R2 Accessible explanations
The dashboard SHALL reuse the existing tooltip or details dialog and provide explanations through pointer interaction, keyboard focus and activation.

#### Scenario: Open and close short help
- WHEN the user hovers, focuses or activates the explanation trigger and then presses Escape
- THEN the current short explanation opens and closes without lost focus.

#### Scenario: Long or interactive help
- WHEN the explanation contains long content, links or actions
- THEN it is presented in the existing details or dialog rather than inside a tooltip.

#### Scenario: Reopen details
- WHEN the user closes and reopens regional details
- THEN help reflects the current slice and no extra tooltip nodes or handlers remain.

### Requirement: R3 Missing and partial data
The dashboard SHALL retain concise visible missing or partial data statuses and provide their reasons on request without treating missing data as zero.

#### Scenario: Missing observation
- WHEN an observation is unavailable
- THEN a concise status is visible and its explanation identifies incomplete coverage and distinguishes missing data from zero.

#### Scenario: Zero denominator with full coverage
- WHEN observations are complete but the denominator is zero
- THEN the existing undefined assessment remains unchanged and its reason is available on request.

#### Scenario: Restore full coverage
- WHEN the view changes from full to partial or missing data and then back to full coverage, including through a filter change
- THEN stale explanation text, its unnecessary trigger and the space they occupied disappear.

#### Scenario: Regional and empty states
- WHEN the user opens a region with missing values or reaches an empty slice
- THEN reasons remain available for missing values and a working recovery action remains available for the empty slice.

### Requirement: R4 Mobile map behavior
The dashboard SHALL remove the persistent mobile map instruction while preserving map panning, list switching and accessible control names.

#### Scenario: Navigate the mobile map
- WHEN the user pans the mobile map and switches to the list
- THEN both actions work without the removed explanatory paragraph and their controls retain accessible names.

#### Scenario: Report touch evidence
- WHEN the map is checked with touch emulation
- THEN the verification report distinguishes emulation from a physical device test.

### Requirement: R5 Existing product contracts
The editorial change SHALL preserve calculations, metrics, filters, URL state and the approved Graphite Dark and Light themes.

#### Scenario: Preserve the existing slice
- WHEN existing mortgage data and integration checks run after the change
- THEN formulas, metric values and the linked slice retain their existing results and no new metrics are introduced.

#### Scenario: Preserve themes and spacing
- WHEN the screen is displayed in either supported theme
- THEN it uses existing components and tokens without reserving placeholders for absent explanations.

### Requirement: R6 Consistent instructions and honest verification
The canonical rules, product UI/UX policy, dashboard-build instructions and generated guide SHALL consistently express the accepted minimal-copy rule without mass-editing educational documentation or overstating verification.

#### Scenario: Read the same rule from each entry point
- WHEN an implementer reads the rules, skill or generated guide
- THEN ordinary working states do not require explanatory prose, and short labels, units and statuses remain permitted.

#### Scenario: Scope and verification boundaries
- WHEN the implementation is reported
- THEN unchanged educational and agreed introductory text remains outside the mass edit, and skipped checks or untested physical devices are explicitly identified.
