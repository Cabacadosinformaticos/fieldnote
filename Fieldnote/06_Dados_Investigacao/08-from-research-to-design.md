# From research to design: what we found and how it changed Fieldnote

## Question

What, taken together, the research in files 00 to 07 means for the project: which arguments hold
the design together, where the sources disagree and which side we took, what changed in the design because of it, and what the project
will not claim. This file is the bridge between `06_Dados_Investigacao` and
`04_Documentacao_Tecnica`.

## The argument in one page

Each step below rests on a source or on a decision recorded in the files.

1. **There is a plausible user.** Researchers in design and communication, such as those of
   UNIDCOM/IADE, use ethnographic and user-research methods that a diary and mobile ethnography
   tool could support. The need itself reached the team through informal contact and is not
   documented publicly (file 00).
2. **That user needs control of the data.** Diary data is personal, often visual and sometimes
   sensitive (file 06). A research unit must answer to an ethics committee and to the GDPR for
   where the data is and who can see it. Commercial platforms keep the data in the vendor's
   infrastructure (file 03).
3. **Self-hosting is how we give the user that control, and it moves the responsibility for not
   losing data from the vendor to the team.** Some vendors offer EU data residency (file 00), and a
   unit whose ethics committee accepts one could use it. We chose self-hosting because it keeps the
   data where the institution decides. If a vendor runs the platform, the vendor's infrastructure
   keeps entries safe. If the research unit runs it, its own system has to.
4. **Losing an entry is unrecoverable.** Diary and experience sampling data is valuable because it
   is recorded in the moment (file 01). An entry lost by the platform cannot be recorded again
   later; a lost day can remove a participant from the analysis.
5. **So the platform must be fault tolerant, with a guarantee stated precisely.** No entry
   confirmed to the participant is lost when one logical node fails. File 05 shows the condition
   under which this holds (confirmation only after a successful synchronous commit) and the
   mechanisms behind it (Raft majorities, Patroni synchronous mode, quorum queues, three copies of
   every file, the outbox).
6. **The phone is part of the distributed system.** Participants record on the move, offline
   (files 01 and 02). The app's queue and the resend with the same identifier are what make the
   server's choice of consistency over availability acceptable to participants (file 05).
7. **When to ask is a problem the product must solve.** Timing changes response and accuracy
   (file 04). Planning prompts ahead from the researcher's rules is a constraint satisfaction
   problem, which is the AI component.
8. **Planning has to respect privacy and the server.** Planning from declared availability needs
   no continuous sensing (file 06), and a cap per slot spreads media uploads (file 04).

The distributed systems, security and AI work are tied to the same user and method, with one
exception we state openly: choosing a constraint satisfaction scheduler also follows from the
Artificial Intelligence unit (file 04). The other links are argued from the sources in this
folder.

## Where the sources disagree, and the side we took

### How many prompts a day

A meta-analysis by Wrzus and Neubauer (2023), with 496 samples, and an experiment by Eisele et al.
(2022) found that the number of prompts per day did not predict compliance; a meta-analysis by
Vachon et al. (2019) found higher compliance with fewer evaluations per day. **Our position:** the
limit stays as a researcher setting, presented as a safeguard and not as a proven way to improve
compliance. In the one experiment that tested it (Eisele et al., 2022), the length of each prompt
mattered more than their number, so the dashboard shows the expected effort of each day.

### Fixed or varied times

Varied times sample the whole day; fixed times were associated with higher compliance (Vachon et
al., 2019). **Our position:** neither is right for every study. The researcher chooses fixed,
balanced or varied, and the scheduler's soft score follows that choice. Balanced is an
intermediate weight between the two.

### React to context or plan ahead

Context-triggered prompts improved response rate and accuracy in small studies (van Berkel et al.,
2019). **Our position:** plan ahead, because context triggering needs continuous sensing of
participants, makes server load unpredictable and needs data we will not have. The cost is stated
as a limitation and context adjustment is future work.

### Consistency or availability

Gilbert and Lynch (2002) show we cannot have both during a partition. **Our position:** the server
chooses consistency; the phone gives participants availability by queueing.

### Vendor or self-hosted

A vendor offers certified security, support and recruitment; self-hosting offers control of the
data and of the cost (files 00 and 03). **Our position:** self-hosted, because control of the data is
the need we inferred for the user (file 00) and because the course asks for a distributed system. A
unit whose ethics committee accepts a vendor with EU data residency would not need this. We do not
claim it is cheaper or more secure than a certified vendor; we claim it keeps the data where the
institution decides.

### Participant accounts or invite codes

An account would let participants recover access on a new phone by themselves. Invite codes with
aliases collect less data and stop diaries from being linked across studies. m-Path, an
established research platform, uses the same alias and invitation code design (file 03). **Our
position:** invite codes and aliases, with the researcher issuing a new code for a new phone.

## What changed in the design because of the research

| Change | Origin | Where it is documented |
|---|---|---|
| `recorded_at` from the app and `received_at` from the server, both shown | Back-filling of paper diaries (Stone et al., 2002) | Data model |
| Late entries from the offline queue are accepted, never rejected by window | Rejecting them loses data | Data model, architecture |
| Daily prompt limit is a researcher setting, no compliance claim | Contradictory evidence on frequency | Scheduler |
| Study setting for fixed, balanced or varied times | Vachon et al. (2019) | Scheduler |
| Expected effort per activity and per day in the dashboard | Eisele et al. (2022) | Dashboard requirements (backlog) |
| Activities accept one or more entry types | Media preference (Brandt et al., 2007) | Data model |
| Per-activity setting for free entries and their daily cap | Fabricated entries (NN/g) | Data model |
| Local notifications scheduled on the phone from the next 24 hours of plan, cancelled by prompt id | Push is best effort (Expo); m-Path's offline limit | Architecture, scheduler |
| Prompt shown and opened times reported by the app | Delivery can be measured with the team's own phones, without a study | Data model, scheduler evaluation |
| Confirmation only after a successful commit; no timeout that cancels the synchronous wait | Patroni documentation | Architecture, fault model |
| One Garage zone per logical node; host declared as a shared failure domain | Garage documentation | Architecture, fault model |
| Exports leave location and media files out by default; including them is audited | de Montjoye et al. (2013); Clark et al. (2010) | Security |
| Reads of the identity table are audited | EDPB guidelines on pseudonymisation | Security |
| Portuguese interface for the app | UNIDCOM framing, participants in Portugal | App requirements (backlog) |
| One-page data protection summary for ethics committees | Wiles et al. (2012) | Planned for the final delivery |

## What the project will not claim

- That Fieldnote improves response rates, compliance or data quality. The scheduler's evaluation
  measures plan validity, load spread and solve time, with generated data.
- That Fieldnote has been used by UNIDCOM or validated by its researchers, unless that happens and
  is documented with a date.
- That mobile ethnography is a settled method. Its own authors say it is not (file 02).
- That the platform is anonymous. It is pseudonymous; photos, voices and locations can identify
  people.
- That no data is ever lost. The guarantee covers confirmed entries, one failed logical node, and
  the conditions in file 05. The physical host is a single point of failure.
- That Fieldnote is the only self-hosted research platform, or that its features are individually
  new.

## Open questions

Questions for the lecturers:

- Distributed Systems: we assume that three logical nodes on one host are acceptable for the
  failure demonstration, because the algorithms involved only require independent failure of
  members (file 05). We would like to confirm this.
- Artificial Intelligence: whether an evaluation of plan quality and load, with generated studies
  and no large-scale tests with people, is enough for the scheduler, or whether a simulated response model is expected.
- Information Security: whether encryption at rest should be at the volume level or in the
  application, given the key management questions in the security design.

For UNIDCOM, if the team can talk to its researchers:

- Which studies they would run, for how long, with how many participants, and with which media.
- Which export format their qualitative analysis software needs.
- What their ethics committee asks for data from participant-captured media.
- Whether participants would need the app in languages other than Portuguese and English.

## Sources

This file cites no new sources. Every claim refers to a file in this folder, where the sources and
the exact passages are listed.

## Limits

- The argument depends on the UNIDCOM framing (file 00), which is the team's own and not part of
  the briefing. Without it, steps 1 and 2 rest on the generic users named in proposal 11, and
  step 3 (self-hosting) loses part of its motivation. Steps 4 to 8 do not depend on the user.
- The design changes listed above are decisions; none is implemented yet.
