# Canonical subcategories within Governance Failure and AI Control

Research date: 2026-09-03

## Scope and naming rule

This note identifies narrower concepts that could sit under the existing umbrella concepts **Governance Failure** and **AI Control**. It uses only first-party or official sources: NIST, OECD, the European Union, the UK government and AI Security Institute, Google DeepMind, OpenAI, Anthropic, and the primary AI-control paper published at ICML.

The source frameworks usually describe desired practices rather than failures. The proposed failure-oriented names below are therefore normalized labels for this project, not claims that every source uses that exact phrase. Each entry explicitly distinguishes:

- an **exact source category or term**;
- a **recommended project label**; and
- likely overlap with concepts already present in the project.

## Executive recommendation

The strongest additions are:

1. **Accountability Failure**
2. **Risk Management Failure**
3. **Independent Oversight Failure**
4. **Incident Response Failure**
5. **AI Access Control**
6. **Containment and Isolation**
7. **Control Evaluations**
8. **Action Gating**

Add **Third-Party AI Risk Management**, **Stakeholder Exclusion**, **Safety Culture Failure**, and **Capability Restriction** only if the scenario corpus contains several clear examples. Do not add separate concepts for generic control monitoring, reverting changes, or shutdown: those are already represented by Runtime Monitoring, Reversibility, Shutdown Resistance, and Corrigibility.

## Governance Failure: ranked candidates

### 1. Accountability Failure — add now

**Recommended definition:** Failure to assign clear ownership, decision rights, escalation paths, or executive responsibility for AI risks and safety-critical decisions.

**Canonical basis:**

- NIST AI RMF has an explicit **GOVERN 2: Accountability structures** category, including clear roles, communication lines, training, and executive responsibility.
- The OECD has an explicit **Accountability** AI Principle and ties accountability to role-appropriate responsibility, traceability, and ongoing risk management.
- Article 17 of the EU AI Act requires an **accountability framework** setting out management and staff responsibilities within the quality management system.
- The UK frontier-safety guidance calls for named individual accountability, board sign-off, internal checks and balances, and separation of roles.

Sources: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [OECD Accountability Principle](https://oecd.ai/en/dashboards/ai-principles/P9), [EU AI Act, Article 17](https://eur-lex.europa.eu/eli/reg/2024/1689), [UK Emerging Processes for Frontier AI Safety](https://www.gov.uk/government/publications/emerging-processes-for-frontier-ai-safety/emerging-processes-for-frontier-ai-safety)

**Boundary:** This is about who owns and must justify a decision. **Power Concentration** is about who possesses power; **Contestability** is about whether affected people can challenge a decision; **Governance Failure** remains the umbrella.

**Taxonomy status:** The recommended failure label is normalized, but “Accountability,” “Accountability structures,” and “accountability framework” are exact formal source terms.

### 2. Risk Management Failure — add now

**Recommended definition:** Failure to identify, assess, prioritize, mitigate, or set tolerances and thresholds for AI risks, including failure to make or honor a safety-critical go/no-go decision.

**Canonical basis:**

- NIST **GOVERN 1** covers organization-wide policies and processes for mapping, measuring, and managing AI risks, including risk tolerance, review, inventories, and safe decommissioning. NIST **MANAGE 1** covers prioritization and risk treatment, including whether development or deployment should proceed.
- The OECD Accountability Principle explicitly requires a systematic, ongoing risk-management approach across the AI lifecycle.
- The UK framework's **Responsible capability scaling** process specifies risk assessments, pre-set risk thresholds, pre-committed mitigations, residual-risk assessment, and preparations to pause development or deployment.
- The Seoul Frontier AI Safety Commitments separately enumerate lifecycle risk assessment, intolerable-risk thresholds, mitigations, and explicit processes if thresholds are exceeded.

Sources: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [OECD Accountability Principle](https://oecd.ai/en/dashboards/ai-principles/P9), [UK Emerging Processes for Frontier AI Safety](https://www.gov.uk/government/publications/emerging-processes-for-frontier-ai-safety/emerging-processes-for-frontier-ai-safety), [Seoul Frontier AI Safety Commitments](https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024)

**Boundary:** This is the organizational decision system around risk. **Capability Evals** supply evidence; **Deployment Safety** concerns the release/operation safeguards; **Iterative Deployment** is a release strategy; **Race Dynamics** explains competitive pressure that may cause the process to be ignored.

**Taxonomy status:** “Risk management,” “risk tolerance,” “risk thresholds,” and “responsible capability scaling” are exact source terms. “Risk Management Failure” is the project's failure-oriented inverse.

### 3. Independent Oversight Failure — add now

**Recommended definition:** Failure to subject safety claims, evaluations, or consequential deployment decisions to sufficiently independent review, audit, verification, or conformity assessment.

**Canonical basis:**

- NIST **MEASURE 1.3** calls for assessments involving internal experts outside the front-line development team and/or independent assessors; the framework says independent review can mitigate internal bias and conflicts of interest.
- The UK framework uses the exact umbrella **external verification** and gives independent audits and third-party model evaluation as examples.
- The EU AI Act uses conformity assessment, including independent notified bodies for some high-risk systems, as a compliance mechanism.
- OpenAI's Preparedness Framework separates capabilities and safeguards reports from review by its Safety Advisory Group; this supports assurance as a distinct governance function, although it is internal rather than independent oversight.

Sources: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [UK Emerging Processes for Frontier AI Safety](https://www.gov.uk/government/publications/emerging-processes-for-frontier-ai-safety/emerging-processes-for-frontier-ai-safety), [EU AI Act overview](https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act), [OpenAI Preparedness Framework update](https://openai.com/index/updating-our-preparedness-framework/)

**Boundary:** **Capability Evals** are the tests; this concept is independence and authority of the verifier. **Contestability** is recourse for affected parties, not independent safety assurance.

**Taxonomy status:** “Independent assessors,” “independent review,” “external verification,” and “conformity assessment” are exact source terms. The combined project label is normalized.

### 4. Incident Response Failure — add now

**Recommended definition:** Failure to detect, document, escalate, communicate, investigate, contain, recover from, or learn from AI incidents and errors.

**Canonical basis:**

- NIST **GOVERN 4.3** covers incident identification and information sharing. **MANAGE 4** explicitly covers response, recovery, communication plans, incident tracking, appeal/override, decommissioning, and change management.
- Article 17 of the EU AI Act requires procedures for serious-incident reporting, while Article 73 requires providers of high-risk systems to report serious incidents and investigate them.
- Anthropic's Responsible Scaling Policy names asynchronous monitoring, incident-response protocols, and post-hoc detection with rapid response as separate operational layers.

Sources: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689), [Anthropic Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)

**Boundary:** **Runtime Monitoring** is technical detection during operation. Incident governance starts with how the organization acts on signals and continues through investigation, disclosure, recovery, and institutional learning. **Reversibility** is one possible response mechanism.

**Taxonomy status:** “Incident response,” “recovery,” “serious incident reporting,” and “post-hoc ... rapid response” are exact source terms. The failure-oriented label is normalized.

### 5. Third-Party AI Risk Management — conditional addition

**Recommended definition:** Governance of risks introduced by acquired models, data, tools, vendors, downstream integrations, and other external dependencies, including due diligence, responsibility allocation, monitoring, and contingency planning.

**Canonical basis:** NIST has exact categories **GOVERN 6** for third-party software, data, and supply-chain risks and **MANAGE 3** for managing third-party AI risks and benefits. It also explicitly calls for contingency processes for failures or incidents in high-risk third-party systems.

Source: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

**Boundary:** Keep **Supply-Chain Threats** for the threat vector—compromised dependencies, tampering, poisoning, or upstream compromise. Use this concept only when the illustrative failure is vendor selection, contracting, responsibility gaps, due diligence, oversight, or contingency planning.

**Taxonomy status:** The label is nearly exact NIST terminology and is highly canonical. It is conditional only because of likely corpus overlap.

### 6. Safety Culture Failure — conditional addition

**Recommended definition:** Organizational norms or incentives suppress critical thinking, warning escalation, candid risk communication, or a safety-first mindset.

**Canonical basis:** NIST **GOVERN 4** is an explicit category for an organizational culture that considers and communicates AI risk; subcategories cover a critical-thinking and safety-first mindset, risk documentation and communication, testing, incidents, and information sharing.

Source: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

**Boundary:** **Race Dynamics** can create the pressure, but this label captures the internal cultural mechanism: ignored warnings, normalized deviance, retaliation, silence, or production goals overriding safety practice.

**Taxonomy status:** “Culture that considers and communicates AI risk” and “safety-first mindset” are exact NIST language; “Safety Culture Failure” is a conventional inverse.

### 7. Stakeholder Exclusion — conditional addition

**Recommended definition:** Failure to collect, consider, prioritize, or integrate the perspectives of affected communities, external experts, users, and other relevant actors into AI risk governance.

**Canonical basis:** NIST **GOVERN 5** is an explicit category for robust engagement with relevant AI actors, including external feedback and mechanisms to incorporate adjudicated feedback into system design and implementation.

Source: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

**Boundary:** This is upstream and lifecycle participation. **Contestability** is the downstream ability to report a problem, appeal, or challenge an outcome. If the corpus rarely distinguishes the two, keep only Contestability.

**Taxonomy status:** “Robust engagement with relevant AI actors” is the formal NIST category; “Stakeholder Exclusion” is a normalized failure label.

### 8. AI Inventory Failure — narrow, add only with repeated examples

**Recommended definition:** Failure to maintain visibility, ownership, categorization, and lifecycle status for AI systems in use, especially unauthorized or “shadow” deployments.

**Canonical basis:** NIST **GOVERN 1.6** requires mechanisms to inventory AI systems and resource them according to risk priorities.

Source: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

**Boundary:** This is narrower than general governance and should not be used for every undocumented system. It is useful when the organization cannot govern an AI system because it does not know the system exists, who owns it, or where it operates.

**Taxonomy status:** “Inventory AI systems” is exact NIST terminology; the failure label is normalized.

## AI Control: ranked candidates

### Source taxonomy backbone

Google DeepMind's **GDM AI Control Roadmap v0.1** is unusually explicit. It defines two control invariants—**Detection** and **Prevention and response**—and then publishes taxonomies of concrete mitigations.

Its prevention/response taxonomy contains:

- agent- or model-level prevention: **AI access control**, **Restricting AI capabilities**, and trusted/untrusted AI for defence;
- environment-level prevention: **Environment isolation** and strict supply-chain security;
- asynchronous response: reverting changes, alignment investigation, and shutdown; and
- synchronous response: resampling, deferring to a trusted model, blocking, and escalating to a human.

Its detection taxonomy distinguishes in-simulation detection, in-deployment agent-level detection, in-deployment environment-level detection, and measures that limit detection evasion. This provides a direct formal basis for deciding which proposed labels are true taxonomy leaves and which are only convenient summaries.

Source: [Google DeepMind, GDM AI Control Roadmap v0.1](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf)

### 1. AI Access Control — add now

**Recommended definition:** Give AI agents distinct identities and separately scoped permissions, with least privilege, fine-grained and context-sensitive authorization, data minimization, and need-to-know access.

**Canonical basis:**

- **AI access control** is an exact leaf in the DeepMind roadmap's prevention taxonomy. It explicitly includes separate agent identity, least privilege, and data minimization.
- DeepMind's public summary describes controlled, incremental access based on verified behavior.
- Anthropic's RSP has an explicit **Access controls** safeguard layer.
- OpenAI describes limiting agents to necessary data and using permissions/approvals as safety controls.

Sources: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf), [Google DeepMind summary](https://deepmind.google/blog/securing-the-future-of-ai-agents/), [Anthropic Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy), [OpenAI prompt-injection guidance](https://openai.com/safety/prompt-injections/)

**Boundary:** This controls what resources and data an agent may reach. **Containment and Isolation** controls the execution boundary and blast radius. **Exfiltration** is an attack outcome; **Prompt Injection** is one attack vector.

**Taxonomy status:** Exact formal roadmap label; very strong candidate.

### 2. Containment and Isolation — add now

**Recommended definition:** Constrain an AI system's environment and potential blast radius through compartmentalization, sandboxes, virtual machines or containers, filesystem and network boundaries, egress controls, and separation from critical systems.

**Canonical basis:**

- **Environment isolation** is an exact leaf in the DeepMind prevention taxonomy; its definition emphasizes compartmentalizing the environment and limiting attack opportunities and impact.
- Anthropic uses **containment** as the direct engineering term and describes sandboxes, VMs, filesystem boundaries, and egress controls as access boundaries that cap blast radius.
- OpenAI describes sandboxing as the technical execution boundary for coding agents and pairs it with approval policies.

Sources: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf), [Anthropic containment engineering](https://www.anthropic.com/engineering/how-we-contain-claude), [OpenAI, Running Codex Safely](https://openai.com/index/running-codex-safely/)

**Boundary:** **Safe Exploration** is about learning or acting without entering unsafe states; this concept is the hard system boundary around a deployed agent. **Defense in Depth** describes layering; containment is one layer. Because the current umbrella is named “AI Control and Containment,” adding this child should be accompanied by treating **AI Control** as the umbrella name rather than leaving containment only in the parent's long name.

**Taxonomy status:** “Environment isolation” and “containment” are exact lab terms. The combined label is normalized but canonical.

### 3. Control Evaluations — add now

**Recommended definition:** Adversarial evaluations that test whether a control protocol prevents catastrophic or otherwise unacceptable harm even when an untrusted model intentionally tries to subvert the safeguards.

**Canonical basis:**

- The primary ICML AI-control paper defines control as protocols designed to remain safe despite intentional subversion and evaluates them by red-teaming attack strategies.
- The UK AI Security Institute uses **control evaluations** as an exact research term and defines them as testing exercises for whether control protocols withstand intentional scheming.
- OpenAI uses the exact term **control evaluations** for evaluating monitor recall, prevention after monitor predictions, and possible monitor-agent collusion.

Sources: [Greenblatt et al., AI Control](https://proceedings.mlr.press/v235/greenblatt24a.html), [UK AISI Alignment Project](https://alignmentproject.aisi.gov.uk/research-area/benchmark-design-and-evaluation), [OpenAI control-monitoring work](https://openai.com/index/how-we-monitor-internal-coding-agents-misalignment/)

**Boundary:** **Capability Evals** ask what the model can do or whether it crosses a risk threshold. **Control Evaluations** ask whether the surrounding safety protocol still prevents harm under an adversarial model. This distinction is important enough to justify a separate concept.

**Taxonomy status:** Exact and field-canonical research term.

### 4. Action Gating — add when the corpus has multiple clear cases

**Recommended definition:** Intercept a consequential AI action before execution and require a safe substitute, automated authorization, trusted-model review, or human approval.

**Canonical basis:**

- DeepMind's exact parent category is **Synchronous response**, with exact leaves **Blocking**, **Deferring to a trusted model**, and **Escalating to a human**.
- OpenAI describes confirmations before consequential actions, synchronous blocking, and approval policies at sandbox boundaries.
- Anthropic describes a permission model that requires approval for writes, shell use, and network access, while noting the limits of repeated human prompts.

Sources: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf), [OpenAI prompt-injection guidance](https://openai.com/safety/prompt-injections/), [OpenAI control-monitoring work](https://openai.com/index/how-we-monitor-internal-coding-agents-misalignment/), [Anthropic containment engineering](https://www.anthropic.com/engineering/how-we-contain-claude)

**Boundary:** This is the control point between detection and execution. **Runtime Monitoring** supplies the signal; **Contestability** permits a later challenge; **Reversibility** repairs or rolls back after an action; **Corrigibility** is a model property concerning acceptance of correction.

**Taxonomy status:** “Action Gating” is a normalized project label, not the formal DeepMind heading. If exact-source naming is preferred, use **Synchronous Control Response**, but the normalized label is more legible for scenario tagging.

### 5. Capability Restriction — conditional addition

**Recommended definition:** Deliberately limit an agent's ability to scheme, persist, coordinate, communicate, remember, or execute attacks while preserving useful task performance.

**Canonical basis:** **Restricting AI capabilities** is an exact DeepMind prevention-taxonomy item. Its examples include limiting memory, restricting cross-instance communication, and training interventions that suppress deceptive or strategic reasoning.

Source: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf)

**Boundary:** Use **AI Access Control** for permissions to external resources; use this concept for intrinsic or scaffold-level limits on memory, communication, coordination, persistence, or strategic reasoning. It may overlap **Safe Exploration** if applied too broadly.

**Taxonomy status:** Exact roadmap label, but less cross-institutionally established than access control or isolation.

### 6. Control Monitoring — canonical, but map to existing Runtime Monitoring

**Canonical structure:**

- DeepMind divides in-deployment detection into agent-level and environment-level monitoring, and distinguishes that from in-simulation detection and limiting detection evasion.
- The UK AISI distinguishes **synchronous**, **semi-synchronous**, and **asynchronous monitoring** according to latency and safety trade-offs.
- AI-control research distinguishes **trusted** and **untrusted** monitors.

Sources: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf), [UK AISI on control monitoring](https://www.aisi.gov.uk/research/practical-challenges-of-control-monitoring-in-frontier-ai-deployments), [UK AISI ControlArena](https://www.aisi.gov.uk/blog/introducing-controlarena-a-library-for-running-ai-control-experiments), [Greenblatt et al., AI Control](https://proceedings.mlr.press/v235/greenblatt24a.html)

**Recommendation:** Do not add a duplicate concept. Expand **Runtime Monitoring** metadata to mention control monitoring, and optionally record synchronous/semi-synchronous/asynchronous and trusted/untrusted as subtypes in its description rather than as standalone scenario concepts.

### 7. Defer-to-Trusted / Trusted Editing — canonical protocol terms, usually too narrow

The primary AI-control paper finds benefits from a trusted model editing untrusted-model code and from monitoring protocols. AISI ControlArena uses the exact micro-protocol label **defer to trusted**, in which a suspicious untrusted output is rejected and replaced with a trusted-model output. DeepMind's taxonomy includes **Deferring to a trusted model** and **Resampling** under synchronous response.

Sources: [Greenblatt et al., AI Control](https://proceedings.mlr.press/v235/greenblatt24a.html), [UK AISI ControlArena](https://www.aisi.gov.uk/blog/introducing-controlarena-a-library-for-running-ai-control-experiments), [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf)

**Recommendation:** Treat these as implementation examples under **Action Gating** unless the corpus contains several scenarios specifically about a weaker trusted model checking, editing, or replacing a stronger untrusted model's work.

### 8. Reverting Changes and Shutdown — canonical leaves already covered

DeepMind's asynchronous-response taxonomy explicitly includes **Reverting changes** and **Shutdown**. These map directly to the project's **Reversibility** and **Shutdown Resistance** / **Corrigibility** concepts.

Source: [Google DeepMind AI Control Roadmap](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/securing-the-future-of-ai-agents/gdm-ai-control-roadmap.pdf)

**Recommendation:** Do not add duplicates. In scenarios, put Reversibility first when rollback is the main analogy and Shutdown Resistance or Corrigibility first when intervention refusal is the main analogy; retain AI Control as the umbrella relation.

## Formal taxonomy labels versus project-friendly labels

| Recommended project label | Exact source terminology | Status |
| --- | --- | --- |
| Accountability Failure | Accountability; Accountability structures; accountability framework | Direct inverse of multiple formal terms |
| Risk Management Failure | Risk management; risk tolerance; risk thresholds; responsible capability scaling | Direct inverse of formal terms |
| Independent Oversight Failure | Independent assessors; independent review; external verification; conformity assessment | Cross-framework synthesis |
| Incident Response Failure | Incident response; response and recovery; serious incident reporting | Direct inverse of formal terms |
| Third-Party AI Risk Management | Third-party AI risks and benefits; third-party software/data and supply-chain issues | Near-exact NIST label |
| Safety Culture Failure | Culture that considers and communicates AI risk; safety-first mindset | Direct inverse of NIST category |
| Stakeholder Exclusion | Robust engagement with relevant AI actors | Failure-oriented normalization |
| AI Access Control | AI access control | Exact DeepMind taxonomy leaf |
| Containment and Isolation | Environment isolation; containment | Combination of exact lab terms |
| Control Evaluations | Control evaluations | Exact AISI and OpenAI term |
| Action Gating | Synchronous response; Blocking; Escalating to a human | Project-friendly synthesis |
| Capability Restriction | Restricting AI capabilities | Near-exact DeepMind taxonomy leaf |

## Labels that are plausible but not yet canonical enough to add

- **Regulatory Arbitrage Failure:** recognizable governance phenomenon, but not a first-level label in the official AI taxonomies reviewed here; usually better represented by Governance Failure plus Race Dynamics.
- **Regulatory Capture:** important and established in governance generally, but for this project it likely overlaps Power Concentration and Governance Failure unless several scenarios make capture itself the central mechanism.
- **Policy Enforcement Failure:** too close to the Governance Failure umbrella; use Accountability Failure or Risk Management Failure based on the actual mechanism.
- **Control-Plane Security:** useful engineering language, but less canonical as an AI-safety concept than AI Access Control, Environment Isolation, or Defense in Depth.
- **Tripwires:** common AI-safety language, but normally an implementation of Runtime Monitoring plus an Action Gating, Shutdown, or Incident Response mechanism.

## Suggested minimum viable expansion

If adding only a small set, add four governance concepts and four AI-control concepts:

| Parent | Add | Why it earns a separate concept |
| --- | --- | --- |
| Governance Failure | Accountability Failure | Clear decision ownership is distinct from power distribution or recourse |
| Governance Failure | Risk Management Failure | Formal risk process and threshold adherence are distinct from deployment mechanics |
| Governance Failure | Independent Oversight Failure | Independence and verification are distinct from the underlying evaluation |
| Governance Failure | Incident Response Failure | Organizational response, disclosure, and recovery are distinct from runtime detection |
| AI Control | AI Access Control | Explicit roadmap leaf; clear least-privilege mechanism |
| AI Control | Containment and Isolation | Explicit roadmap/lab concept; clear environmental boundary |
| AI Control | Control Evaluations | Tests controls under intentional subversion, not model capability |
| AI Control | Action Gating | Captures the pre-execution intervention point that monitoring and reversibility do not |
