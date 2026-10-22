# VEIL — Product Requirements & Implementation Specification

**Project:** VEIL — The Trust Layer for Fair Evaluation  
**Tagline:** Judge the work. Not the person.  
**Challenge:** RMIT × Tide UNLOCKED Hackathon 2026  
**Objective:** Build a working, visually polished MVP with genuine TideCloak integration.

## 1. Product Vision

Build VEIL, an independent, privacy-preserving submission and evaluation platform that enables organizations to assess people's work before learning their identities.

Today, job applicants, scholarship candidates, startup founders, and competition participants often submit their work alongside identifiable information. This introduces opportunities for unconscious bias, favoritism, and unfair preferential treatment.

Traditional anonymous evaluation systems rely on administrators and platform operators to enforce confidentiality. An administrator with sufficient access may still be able to reveal identities or modify permissions.

VEIL introduces a different model.

Submissions are separated into two components:

1. **The Work:** The materials that evaluators are allowed to assess.
2. **The Identity:** Personal information protected through TideCloak encryption and authorization.

Evaluators assess anonymous submissions. Identities can only be disclosed to appropriately authorized users under a defined disclosure workflow.

The long-term vision is to make VEIL an infrastructure service that existing recruitment platforms, universities, competitions, and grant programs can integrate without replacing their entire workflow.

**Core value proposition:**

"We don't ask evaluators to promise impartiality. We remove unnecessary access to identity from the evaluation process."

**Technical value proposition:**

"VEIL anonymizes submissions. TideCloak protects sensitive identity access and helps prevent unilateral administrative overrides of protected permissions."

## 2. Required Technology

Use:

- Next.js with TypeScript.
- Tailwind CSS and a polished component library such as shadcn/ui.
- TideCloak for authentication, authorization, and identity encryption.
- SQLite or another simple persistent database for MVP data.
- A modular service architecture that can evolve into a standalone API.
- Synthetic data only.

**TideCloak is mandatory and must be genuinely integrated.**

Start with the official TideCloak Next.js Quickstart when practical.

Documentation: https://docs.tide.org/

Tide MCP: https://github.com/tide-foundation/raziel-mcp

Use the Tide MCP tools, if connected, to retrieve current implementation instructions.

Do not invent TideCloak SDK functions, governance APIs, permissions, or encryption capabilities.

Do not implement TideCloak encryption using a fake JavaScript function or replace actual security enforcement with UI-only checks.

If the real integration encounters an environmental limitation, clearly identify the missing configuration, provide reproducible setup instructions, and label any fallback as a simulation.

## 3. Target Users

### Applicant

A person submitting an application, project, case study, scholarship essay, or competition entry.

Applicants should be able to:

- Authenticate.
- Browse or open an evaluation campaign.
- Submit identifying information separately from their work.
- Review their submission status.
- Understand which information evaluators can access.
- View evaluation results when published.

### Evaluator

A recruiter, professor, judge, or committee member assessing submissions.

Evaluators should be able to:

- Authenticate.
- Access their assigned campaigns.
- Review anonymized submissions.
- Evaluate work using structured criteria.
- Submit and finalize scores.
- View candidate identities only if explicitly authorized.

### Organization Administrator

A person responsible for setting up and operating an evaluation campaign.

Administrators should be able to:

- Create campaigns.
- Configure evaluation criteria and deadlines.
- Assign reviewers.
- Monitor evaluation completion.
- Initiate a disclosure workflow after evaluations are finalized.

An ordinary organization administrator must not automatically have permission to decrypt applicant identities.

### Security / Governance Administrator

A role responsible for managing protected identity access and high-risk authorization changes.

The demo should demonstrate that an individual administrator cannot unilaterally make a protected permission change when TideCloak quorum approval is required.

Distinguish TideCloak realm administrators from ordinary VEIL organization administrators.

## 4. MVP Scope

Build one complete use case:

**Graduate Analyst Recruitment — Blind Case Study Assessment**

An organization invites candidates to submit a financial case study.

Candidates provide:

**Identity information**
- Full name.
- Email.
- University.
- Optional phone number.

**Evaluation information**
- Case study title.
- Case study answer.
- Skills or relevant experience expressed without identifying information.

VEIL stores these components separately.

Each applicant receives a random, non-sequential anonymous candidate identifier, such as `VEIL-K7M2Q`.

Evaluators see the anonymous identifier and case study content, but not identity details.

Identity data must be encrypted through TideCloak before being stored.

The evaluation ends with a finalized score and a controlled identity-disclosure process.

### Explicitly Out of Scope

Do not spend MVP development time building:

- A full recruitment applicant-tracking system.
- Payment processing.
- Real employer integrations.
- AI-powered candidate ranking.
- Large PDF processing pipelines.
- Blockchain functionality.
- Complex multi-tenant enterprise administration.
- An automated decision-making model.

Prioritize one fully working, credible journey.

## 5. Core Application Workflow

### Step 1 — Create a Campaign

An organization creates an evaluation campaign.

Example:

Campaign Name: Graduate Analyst Challenge 2026

Description: Evaluate analytical reasoning and financial problem-solving through a written case study.

Criteria:

- Analytical reasoning: 40%.
- Financial understanding: 30%.
- Clarity of recommendations: 20%.
- Creativity: 10%.

Campaign stages:

`DRAFT → OPEN → REVIEW → FINALIZED → DISCLOSURE → CLOSED`

Only authorized campaign managers can perform valid stage transitions.

Campaign stage checks must be enforced server-side, not just through disabled buttons.

### Step 2 — Submit an Application

The applicant opens the campaign and provides two sections.

**Section A: Identity**

Full name, email, university, and phone.

This information must be encrypted using TideCloak's supported encryption functions and an appropriate configured encryption tag.

The application database stores only the encrypted identity payload and necessary non-sensitive metadata.

Do not store an additional plaintext identity copy.

**Section B: Work**

The applicant submits a case study answer.

For the MVP, support structured text submissions.

Display warnings if the work includes identifying information such as a full name, email address, or explicit university affiliation.

Use simple detection rules. Do not claim perfect anonymization.

Submission creates a random candidate ID.

Example confirmation:

"Your submission has been received. Your identity is protected and will not be displayed during blind review."

### Step 3 — Anonymous Evaluation

An evaluator enters the review dashboard.

The dashboard displays:

- Candidate ID.
- Submission title.
- Case study response.
- Evaluation criteria.
- Score inputs.
- Review status.

It must not retrieve or include decrypted identity information in evaluator-facing API responses.

Evaluators score each criterion.

Total score is automatically calculated using campaign weightings.

Evaluators may save a draft evaluation and finalize their score.

Once finalized, the score becomes locked for the MVP.

### Step 4 — Unauthorized Disclosure Attempt

This is the most important security demonstration.

The prototype must demonstrate that a user without the required TideCloak decryption permissions cannot access protected identity data.

Show an explicit access attempt by an unauthorized reviewer.

Expected result:

"Access denied. Your identity permissions do not allow decryption of this record."

This must reflect actual failed authorization or a denied TideCloak decryption operation, not merely a hidden interface element.

A second demonstration should show that a single realm administrator cannot unilaterally grant additional protected permissions when QEA requires multiple approvals.

Use TideCloak's genuine governance workflow for this demonstration.

### Step 5 — Controlled Identity Disclosure

After the evaluation is finalized, the organization can request identity disclosure.

The application checks:

1. The evaluation campaign is in an eligible stage.
2. Required reviews have been finalized.
3. The requesting user has an appropriate TideCloak identity-decryption role.
4. Any configured disclosure authorization requirement has been satisfied.

Important:

A campaign-stage condition implemented in VEIL is an application-level business rule. It must not be presented as cryptographically enforced by TideCloak unless the implementation genuinely binds that condition to TideCloak authorization.

For the MVP, it is acceptable to use a separately authorized disclosure officer with TideCloak decryption permission and enforce finalized-review conditions through the application's backend.

Do not automatically grant decryption permissions to every evaluator when they submit a score.

Do not assume TideCloak provides native per-submission threshold approval. Implement additional workflow approvals only if needed, and distinguish them from TideCloak QEA.

### Step 6 — Results

Authorized users can view finalized evaluation outcomes.

The application can display a ranked candidate list based on finalized scores.

Applicant identities are displayed only to roles genuinely authorized to decrypt them.

The application should retain an audit history of relevant operations, with an explicit distinction between application event logs and TideCloak governance events.

## 6. Data Architecture

Implement the following logical entities.

### Users

- id
- tidecloak_user_id
- display_name
- organization_id
- application_role

Use TideCloak as the authoritative source for authentication and protected security roles. Do not trust a self-editable database role field for sensitive authorization.

### Organizations

- id
- name
- created_at

### Campaigns

- id
- organization_id
- title
- description
- status
- deadline
- criteria
- created_by
- created_at

### Submissions

- id
- campaign_id
- applicant_user_id
- anonymous_candidate_id
- title
- anonymized_work_content
- encrypted_identity_payload
- identity_encryption_tags
- submitted_at
- status

Ensure applicant ownership information and internal user mappings are not exposed in reviewer-facing responses.

### Evaluations

- id
- submission_id
- evaluator_id
- criterion_scores
- weighted_total_score
- feedback
- status
- finalized_at

### Disclosure Requests

- id
- campaign_id
- submission_id (nullable for campaign-wide requests)
- requested_by
- reason
- status
- created_at
- resolved_at

These records describe application workflow state, not automatically TideCloak quorum authorization.

### Audit Events

- id
- actor_id
- action
- target_type
- target_id
- outcome
- timestamp

Do not store raw identity fields, decrypted identity payloads, access tokens, or cryptographic secrets in audit logs.

## 7. TideCloak Integration — Mandatory

TideCloak must be used for:

**A. Authentication**

Users sign in using TideCloak.

Implement real login, logout, session handling, and protected routes.

**B. Role-Based Authorization**

Use TideCloak roles and token claims for relevant protected permissions.

Suggested application roles:

- applicant
- evaluator
- organization-admin
- disclosure-officer

Use TideCloak-supported realm or client roles and verify permissions server-side where appropriate.

**C. Identity Encryption**

Use official TideCloak SDK encryption/decryption functions.

Follow the official tag-based encryption mechanism.

For example, configure a suitable tag such as `candidate_identity`, along with the actual roles required for encryption and decryption.

Never embed master keys or decryption secrets in the repository.

Never use a server-wide privileged TideCloak identity to transparently decrypt protected data for unauthorized reviewers.

**D. Quorum-Enforced Governance**

Configure and demonstrate QEA for sensitive administrative permission changes.

Where the TideCloak environment supports a multi-administrator quorum, demonstrate:

- One administrator initiates a protected role or permission change.
- That administrator's action alone is insufficient.
- Another authorized administrator approves as required.
- The change becomes effective through the TideCloak approval process.

Use official TideCloak administration interfaces when appropriate. VEIL does not need to reproduce the entire QEA console.

**E. Genuine Enforcement**

All encryption and protected permission checks must be implemented using real TideCloak operations.

The UI must not falsely display "cryptographically protected" when the backend is only using ordinary conditional logic.

## 8. Required Screens

### Screen 1 — Landing Page

Create a modern SaaS landing page with:

Hero:

**Judge the work. Not the person.**

Subheading:

"The independent trust layer for fair evaluation. Collect anonymous submissions, assess work without identity bias, and protect disclosure through TideCloak."

Primary CTA: Start evaluating

Secondary CTA: See how VEIL works

Include a simple visual showing identity separated from work.

### Screen 2 — Campaign Dashboard

Display active campaigns with application counts, review progress, deadlines, and statuses.

Include a button to create a new campaign.

### Screen 3 — Applicant Submission Portal

A clean two-section form:

- Your Identity — Protected
- Your Submission — Shared with Evaluators

Display a clear explanation of who can access each section.

Show anonymization warnings before submission.

### Screen 4 — Anonymous Evaluation Dashboard

Display anonymous candidate cards and assessment progress.

The candidate's identity should be absent from the reviewer experience.

A submission detail page should show the candidate's answer alongside the scoring rubric.

### Screen 5 — Identity Disclosure & Governance

Display:

- Campaign review status.
- Finalized evaluation count.
- Disclosure requests.
- Protected identity status.
- TideCloak permission information where available.

Include a clear educational explanation that protected TideCloak permission changes require the configured governance approvals.

Do not fabricate successful TideCloak approvals.

### Screen 6 — Results Dashboard

Display evaluation scores and rankings.

Show identities only where successfully decrypted for authorized users.

Otherwise, display anonymous candidate identifiers.

## 9. UI / UX Requirements

The UI should look like a premium enterprise SaaS product, not a generic hackathon template.

Style direction:

- Minimal, professional, and modern.
- White/light-gray surfaces.
- Deep navy typography.
- Muted blue or teal accents.
- Clear information hierarchy.
- Subtle borders and generous whitespace.
- Modern tables, progress indicators, and cards.
- Responsive layout.

Avoid excessive gradients, glassmorphism, neon colors, or decorative animations.

The product should feel credible for universities, major companies, and professional organizations.

Security outcomes must be visually explicit:

- Identity protected.
- Access denied.
- Evaluation finalized.
- Disclosure authorized.

Use clear human language rather than unexplained cryptographic terminology.

## 10. Demo Scenario

Use synthetic data representing a graduate recruitment campaign.

Prepare at least three sample candidates with different universities and case study quality levels.

The most important demo is:

**Scene 1: The Problem**

Explain that conventional recruitment systems often reveal identifying information before work is assessed.

**Scene 2: Anonymous Submission**

An applicant submits their identity and a financial case study.

VEIL creates an anonymous ID and stores the protected identity through TideCloak encryption.

**Scene 3: Blind Evaluation**

A reviewer reads the anonymous submission and finalizes a score without accessing the candidate's identity.

**Scene 4: Attempted Bypass**

The reviewer attempts to access protected identity information and fails because their TideCloak permissions do not authorize decryption.

Show a separate real QEA permission-change attempt that cannot be completed unilaterally.

**Scene 5: Authorized Disclosure**

An appropriately authorized user decrypts the identity after the required application workflow conditions are satisfied.

End the demonstration with:

"VEIL doesn't simply hide names. It changes who has the power to reveal them."

The final hackathon video must be approximately two minutes long.

## 11. Security and Correctness Requirements

The following are mandatory:

- Never rely solely on frontend authorization.
- Never return plaintext identities in reviewer API responses.
- Never store unencrypted applicant identity payloads.
- Never expose TideCloak secrets or access tokens in the UI.
- Never claim anonymity if identifying information is still visible in submissions.
- Use secure, random candidate IDs rather than sequential IDs.
- Maintain strict ownership and reviewer-assignment checks.
- Prevent cross-campaign access to submissions.
- Validate user inputs.
- Provide clear error states for failed encryption, decryption, or authentication.
- Never automatically fall back to plaintext when encryption fails.
- Document any limitation related to metadata, inference, or previously disclosed information.
- Do not confuse application-level workflow approvals with TideCloak's QEA governance mechanism.

## 12. MVP Acceptance Criteria

The MVP is complete when:

- [ ] Users can authenticate using TideCloak.
- [ ] An applicant can submit identity and work separately.
- [ ] Identity is genuinely encrypted using TideCloak.
- [ ] The encrypted payload is persisted without a plaintext duplicate.
- [ ] A reviewer can read the submission without seeing the candidate's identity.
- [ ] A reviewer can score and finalize an evaluation.
- [ ] An unauthorized identity decryption attempt fails.
- [ ] An authorized disclosure officer can decrypt identity when application conditions permit.
- [ ] TideCloak QEA is configured and a genuine protected administrative change can be demonstrated as requiring multiple approvals.
- [ ] The application has polished, usable core screens.
- [ ] Synthetic demo data is available.
- [ ] The repository contains setup instructions, configuration requirements, and a clear explanation of TideCloak's role.

Do not claim an acceptance criterion is complete without confirming it works.

## 13. Implementation Priority

Build in this order:

**Priority 0 — Security Foundation**

Set up TideCloak, authentication, roles, encryption, decryption, and QEA configuration.

Verify TideCloak operations before building the full UI.

**Priority 1 — Core Working Flow**

Implement campaign creation, submission, encrypted identity storage, anonymous review, scoring, and authorized disclosure.

**Priority 2 — Polished Demo**

Develop the dashboard, landing page, seeded scenarios, error states, and an understandable security demonstration.

**Priority 3 — Optional Enhancements**

If time permits:

- A reusable submission widget.
- A basic public API for campaign creation and submission.
- Email notifications.
- Improved automatic identity detection.
- Audit reporting.
- Multi-organization onboarding.

Do not sacrifice the real TideCloak integration for optional features.

## 14. Deliverables

Produce:

1. A runnable working application.
2. Complete source code.
3. Environment variable template.
4. Database schema and seed script.
5. TideCloak setup and role configuration instructions.
6. A README project overview of no more than 300 words addressing the UNLOCKED judging prompts.
7. A separate detailed setup section.
8. A test checklist demonstrating authorized and unauthorized access.
9. A concise two-minute video demonstration script.

Do not invent screenshots or claim functionality that has not been tested.

## 15. Instructions to the Coding Agent

You are acting as a senior full-stack engineer, security architect, and product designer.

Your responsibility is not merely to generate UI components. Your responsibility is to build a credible and demonstrable product that showcases why TideCloak materially enables VEIL.

**Execute the implementation rather than stopping at a proposed architecture.**

Start by inspecting the existing repository and available development environment.

Use the Tide MCP integration if available. Otherwise, follow the official TideCloak Quickstart and SDK documentation.

Preserve any existing functional project setup.

Build the smallest complete vertical slice first, and test it end to end.

Make reasonable implementation decisions independently.

When a real integration is blocked, document the exact issue and do not silently replace the security mechanism with a mock.
        
After implementation, run available type checks, builds, and relevant tests.

Provide a final report identifying:

- What is implemented.
- What was verified working.
- Which protections TideCloak actually enforces.
- Which conditions are enforced by VEIL.
- What remains incomplete.
- How to run and demo the project.

**Above all: the product must demonstrate a real difference between ordinary anonymous UI and cryptographically governed identity access.**
