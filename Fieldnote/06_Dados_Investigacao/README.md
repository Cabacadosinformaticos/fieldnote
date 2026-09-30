# Research

Background research for Fieldnote: who the platform is for, the research methods it supports, the
platforms that already exist, the evidence behind the scheduler, the foundations of the fault
tolerance design, data protection, and network access. Each file states a question, reads the
sources critically, and ends with what the project does because of them.

## Files

| File | Question it answers |
|---|---|
| [00-research-context-unidcom.md](00-research-context-unidcom.md) | Who would use Fieldnote in our institution (UNIDCOM/IADE), what that research unit does, and what its needs add to the requirements |
| [01-diary-studies-and-experience-sampling.md](01-diary-studies-and-experience-sampling.md) | What diary studies and experience sampling are, what the evidence says about compliance and burden, and where it disagrees |
| [02-mobile-ethnography.md](02-mobile-ethnography.md) | What mobile ethnography means, how settled it is, and what participant-captured media changes |
| [03-existing-platforms.md](03-existing-platforms.md) | Which commercial and academic platforms exist, what Fieldnote shares with them and where it really differs |
| [04-prompt-timing-and-scheduling.md](04-prompt-timing-and-scheduling.md) | Why prompt timing matters, why Fieldnote plans prompts ahead as a constraint satisfaction problem, and whether a planned prompt reaches the phone |
| [05-fault-tolerance-foundations.md](05-fault-tolerance-foundations.md) | The theory and documented guarantees behind the replication design, and the conditions under which they hold |
| [06-privacy-and-research-ethics.md](06-privacy-and-research-ethics.md) | What the GDPR and research ethics ask of a platform with participants' photos, voices and locations |
| [07-network-access-options.md](07-network-access-options.md) | How access would work in a real deployment, and why this proof of concept uses Tailscale |
| [08-from-research-to-design.md](08-from-research-to-design.md) | What the research means as a whole: the argument, contested points, design changes and what the project will not claim |

Suggested reading order: 00, then 08 for the overall argument, then the topic files as needed.

## How the research was done

**Questions first.** Each file starts from a question that a design decision depends on. Sources
were looked for to answer that question, not collected for their own sake.

**Kinds of sources.**

- Peer-reviewed papers and reviews, found through the references of key papers and through PubMed,
  Semantic Scholar and OpenAlex. Each is cited with its DOI, checked against the Crossref record.
- Official documentation of the technologies in the design (Patroni, PostgreSQL, RabbitMQ, Garage,
  Expo, Cloudflare, Tailscale).
- Public pages of commercial products, help centres and app store listings, used only to describe
  what each product states about itself.
- Public pages of UNIDCOM/IADE, Universidade Europeia and the FCT for the institutional context.

**Rules for quotations.** Every quoted passage was copied from the text of the source as it was
read, and is marked with where it comes from (abstract, a section, or a documentation page). For
each source we read the parts that answer the file's question, and nothing is attributed to a
source beyond those parts. Quotations are kept short; the rest is paraphrase.

**Critical reading.** For every important source we asked: who was studied, how many, with what
kind of prompt or system, and whether that transfers to Fieldnote. Where sources disagree, both
sides are presented and the project's position is stated with its reason.

**From finding to decision.** Each topic file ends with a table of findings, the decision taken and
its status. Adopted means the decision is part of the current design documents, which are still
proposals; planned means it is in the design but must be tested before it is relied on; future
work means it is not in the current design.
None of the adopted items is implemented yet. File 08 collects them.

**Accessed.** All sources were accessed in September 2026.

## Summary

- Fieldnote is framed around a concrete user, UNIDCOM/IADE, a design and communication research
  unit whose ethnographic and user-research work could use a diary platform. This framing is the
  team's, not the briefing's, and the files say what it does not allow us to claim.
- Diary studies and experience sampling are well established for structured questionnaires. The
  evidence on how many prompts participants tolerate is split. The experiments we found used
  short questionnaires; none measured the effort of photo, video or audio prompts, which is
  probably higher.
- Mobile ethnography is a family of practices without a coherent definition, according to its own
  proponents. Fieldnote is presented as a tool that supports it, not as a method.
- Offline capture, real-time dashboards and alias-based participants already exist in other
  platforms. What we did not find elsewhere is the combination of media diaries, open source
  self-hosting without a specific cloud, fault tolerance with a written fault model and planned
  failure tests, and a constraint-based scheduler.
- Prompt timing affects response and accuracy. Fieldnote plans ahead from declared availability
  instead of sensing context, for privacy and load control, and declares what that costs. Push
  delivery is best effort, so the app also schedules local notifications and pulls pending prompts
  when it opens.
- The guarantee "no confirmed entry is lost" holds under conditions that the documentation of
  Patroni makes explicit; the API confirms an entry only after a successful synchronous commit, and
  the idempotent resend covers the remaining case.
- Diary data is pseudonymous, not anonymous. Photos, voices and locations identify people, so
  exports leave location and media out by default.
