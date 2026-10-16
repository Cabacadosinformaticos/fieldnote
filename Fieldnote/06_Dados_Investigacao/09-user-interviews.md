# Interviews with researchers and designers

## Question

What people who would run or design studies with Fieldnote think it needs, what they found wrong
in the first mockups, and what the project changed because of it. File 08 ended with questions
for UNIDCOM "if the team can talk to its researchers". This file records the first such
conversations.

## Why this matters for Fieldnote

Until October 2026 every design decision came from the briefing, the literature (files 00 to 08)
and the team's own judgement. Four sessions in October 2026 put the requirements and the mockups
in front of people from the unit the project is framed around. They confirmed the core of the
design, changed several screens, and opened new research questions, answered in files 10 to 12.

## Method

**Sessions.** Four semi-structured sessions at IADE, each about one hour, on 13 and
15 October 2026. Each session had two parts:

1. Open questions before showing anything: what a mobile ethnography and diary platform should
   do, for the researcher and for the participant. A lecturer advised the team not to explain the
   design first, so that answers would not be biased by it.
2. A walk through the mockups (65 screens of the participant app and the researcher portal), screen
   by screen, asking for honest criticism.

**People.** Names are kept in the team's internal notes and are not published.

| Session | Date | Role of the interviewee | Recorded |
|---|---|---|---|
| 1 | 2026-10-13 | UNIDCOM researcher, with the project's lecturer, also a researcher, present | Yes, 1 h 16 min |
| 2 | 2026-10-15 | Designer with a PhD in games, expected to join UNIDCOM's Moscavide project as a research grant holder | Yes, 1 h 07 min |
| 3 | 2026-10-15 | Master's student in creative computing and artificial intelligence, graphic designer, who wants a tool like this for her thesis | Yes, 1 h 10 min |
| 4 | 2026-10-15 | Computer engineering lecturer and UNIDCOM researcher | No, at the interviewee's request |

**Records.** Recorded sessions were transcribed locally with Whisper large-v3 (whisper.cpp), with
no audio sent to an external service. Session 4 was reconstructed afterwards, from memory, in a
voice note recorded by the interviewer. Each session has an internal synthesis that
separates what was confirmed, new ideas, interface corrections and what was left for a later
version.

**From session to decision.** Ideas were not adopted during the sessions. Each idea was marked as
confirmed, candidate, preferred by the team or next version, and the team decided afterwards. All
candidate and preferred ideas were then moved to the next version, because the time left in the
course is only known about a month later.

## What the interviews confirmed

- The core use case: a few participants answering short prompts during the day (photo, mood,
  place), with everything arriving in one dashboard. Session 1 described it without knowing it was
  already the design.
- Studies made of activities, each with the response types the researcher allows.
- Collected data is never edited, only deleted. "That is the principle of research" (session 1).
- A researcher dashboard on the computer only; offline capture with later sending; join by code,
  QR or a generated poster; raw exports with as many fields as possible.
- No account required, and permissions asked only when a feature needs them. Session 3: "That is
  perfect", because many requests at the start make people give up.
- An audit log and an administrator above researchers. Session 2: "the famous 'it wasn't me'
  problem is a serious problem".
- A dense, conventional dashboard. Session 2 found it "complete, even too complete", session 3
  "clear and coherent", and saw the conventional layout as an advantage for researchers.

## What the interviewees agreed on

| Finding | Sessions | Change |
|---|---|---|
| Faces instead of numbers on the rating scale, easier for older participants | 1, 2, 3 | The researcher chooses the scale type and points (file 10) |
| The instruction of a prompt must be read before answering, at the top of the screen | 1, 2, 3, 4 | Instruction and warnings in one block above the capture choice |
| Participants must be able to declare several availability windows a day, or none | 2, 3, 4 | New availability screen with intervals and weekdays |
| The participant's main screen had too much on it for older people | 3, 4 | Today screen reduced to the open prompt and free entries, larger type |
| A timeline of all entries would help the researcher | 1 and the lecturer, 2 with reservations | Timeline view in the portal (file 12) |

## Where they disagreed

- **Dropdowns or visible options** in the volunteer pool form. Session 2 wanted dropdowns to save
  space; session 3 wanted every option visible. The team adopted a rule: visible options for short
  lists, a dropdown for long ones (file 11).
- **Free entries next to an open prompt.** Session 4 wanted free entries only after the prompt is
  answered, to avoid distraction. The team kept them visible as a secondary action, because free
  entries capture spontaneous moments that a prompt does not.
- **A timeline view.** Session 1 asked for it; session 2 warned that it easily becomes unreadable.
  The design uses one lane per participant and a zoom between week, day and hours.

## What changed in the design

Adopted means that it is in the current mockups and is being written into the requirements.

| Change | Origin | Status |
|---|---|---|
| Fixed study roles (principal investigator, co-investigator, member) with a permission matrix | Session 1 | Adopted (decided 2026-10-14) |
| Scale type and number of points chosen per activity; export states both | Sessions 1 to 4, Stevens (1946) | Adopted |
| Scale shown as a vertical list of large options, all visible | Sessions 3 and 4 | Adopted |
| Availability as a list of intervals with weekdays, plus "any time" | Sessions 2 to 4 | Adopted |
| Today screen: one main prompt card, plain-text metadata, sync status as an icon | Session 4 | Adopted |
| Instruction and warnings in one block above the capture choice | Sessions 1 to 4 | Adopted |
| Study-defined questions when joining (for example, how the person travels to the place studied) | Session 1 | Adopted |
| Timeline view of entries with filters and zoom | Session 1 | Adopted |
| Adherence of a participant as one heatmap of days by prompt slot | Session 4 | Adopted |
| Several poster styles; the researcher chooses code, QR or both | Sessions 2 to 4 | Adopted |
| "Disconnect phone" was misread as removing the person; the action became "Remove from the study", as if the participant had left, and a phone change is done with a new invite code | Session 4 | Adopted |
| A short celebration when an entry is saved, with no points or streaks | Sessions 3 and 4 | Adopted |
| Colour contrast and touch target sizes checked against WCAG 2.2, and corrected in the mockups | Session 2 | Adopted (file 11) |
| Send an activity now to some participants, outside the plan | Session 1 | Next version; earlier if time allows |
| Researcher's own field notebook (notes, files, photos, sounds), not a study | Session 1 | Next version; earlier if time allows, first in line |
| Route recording while an activity is open | Session 1 | Next version; earlier if time allows, first in line |
| Free finger sketching, also over an image given by the researcher | Session 1 | Next version; earlier if time allows |
| Upload from the gallery or files; automatic context (weather) on entries; reusable activity templates | Session 1 | Next version; earlier if time allows |
| More activity types | Team | Next version |
| Configurable permissions per study, netnography, participant teams, paid market studies | Session 1 | Next version |

## What the interviews do not allow us to claim

- That Fieldnote was tested with participants. Nobody used a working app. The sessions reviewed
  mockups with researchers and designers.
- That UNIDCOM validated the platform. Two of the four people are UNIDCOM researchers; their
  feedback is input to the design, not an endorsement.
- That the findings generalise. Four people from one institution, chosen by availability, all
  familiar with design or research. Older participants, whom several interviewees worried about,
  were not interviewed.
- That session 4 is reported exactly. It was not recorded and was reconstructed from memory.

## How the project proceeds because of this

- The adopted changes are in the mockups and go into the requirements, use cases and data model.
- The other ideas are planned for the next version, after the course. If time is left once the
  adopted changes are built, some may come into this version, starting with the field notebook and
  route recording.
- Topics the interviewees raised that the earlier research did not cover were researched
  afterwards: response scales (file 10), accessible mobile interfaces for older participants
  (file 11), and visualising entries and adherence (file 12).
- Usability tests with participants, as the lecturer advised, need a working pilot. They are
  planned only if the timeline allows and are not promised.

## Sources

Stevens, S. S. (1946). On the theory of scales of measurement. *Science*, 103(2684), 677-680.
https://doi.org/10.1126/science.103.2684.677. Given to the team by the interviewee of session 4.

The sessions themselves are internal records (transcripts and syntheses) and are not published.

## Limits

- The interviewer is a member of the team and showed the team's own work, which invites polite
  answers. Asking for honest criticism and the open first part reduce this, but do not remove it.
- Transcripts are automatic and were not checked word by word against the audio.
- The interviewees saw mockups, not a prototype; reactions to interaction and timing are guesses.
