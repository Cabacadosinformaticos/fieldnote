# Prompt timing and scheduling

## Question

Does the moment a prompt arrives change whether and how people answer? If so, should a platform
decide that moment from live phone context, from a plan made in advance, or leave it to fixed
hours? And once a plan exists, can it reach the phone on time? The answers justify the artificial
intelligence component of Fieldnote, a constraint satisfaction scheduler, and set the limits of
what it can claim.

## Why this matters for Fieldnote

The scheduler is the project's AI component for the Artificial Intelligence course. It has to
solve a real problem of the product, and its evaluation has to measure something true. This file
shows that timing matters, explains why we plan prompts ahead instead of reacting to phone
context, and is explicit about two things the scheduler cannot do: prove that it improves
response rates, and guarantee that a planned prompt reaches a phone that is offline.

## Timing is a design decision with effects

### The schedule is one of the parameters of every study

The survey by van Berkel, Ferreira and Kostakos (2017) on experience sampling with mobile devices
describes the field as having gained new possibilities "while simultaneously leading to new
conceptual, methodological, and technological challenges" (abstract), and analyses "the particular
methodological parameters scientists should consider in their study design" (abstract). When to
signal participants is one of them. A diary platform therefore has to let the researcher state the
rules, and something has to turn those rules into times.

### The type of schedule changes the data

van Berkel et al. (2019, International Journal of Human-Computer Studies) compared three schedules
in a three-week within-subjects study with 20 participants: random times, fixed intervals, and
questions triggered when the participant unlocked the phone.

> "We find that scheduling questions on phone unlock yields a higher response rate and accuracy."
> (abstract)

The questions in that study were about the participant's own phone use, which could be checked
against logs. The authors conclude that the choice of schedule can bias a study's findings.

A second study by the same group (van Berkel et al., 2019, CHI) looked at accuracy over three weeks
and more than 2500 questionnaires. Two findings:

> "response accuracy is higher for questionnaires that arrive when the phone is not in ongoing or
> very recent use" (abstract)

> "long completion times are an indicator of a lower accuracy" (abstract)

Context available on the phone explained up to 13% of the variance in accuracy. The authors also
argue that research has focused on whether people respond and too little on whether their answers
are accurate.

### People's receptivity varies with context

Mehrotra et al. (2016) collected "10372 in-the-wild notifications and 474 questionnaire responses
on notification perception from 20 users" (abstract). Response time and perceived disruption
depended on how the notification was presented, the type of alert, who sent it, and what the person
was doing. They note that

> "even a notification that contains important or useful content can cause disruption." (abstract)

Künzler et al. (2019) studied receptivity to health interventions delivered by a chatbot, "with 189
participants, over a period of 6 weeks" (abstract), and found that "several contextual factors
(day/time, phone battery, phone interaction, physical activity, and location), show significant
associations with the participant receptivity" (abstract).

### A research prompt competes with everything else on the phone

Pielot, Church and de Oliveira (2014) logged notifications for 15 people over a week:

> "We found that our participants had to deal with 63.5 notifications on average per day, mostly
> from messengers and email." (abstract)

They also found that notifications "were typically viewed within minutes" (abstract), whether or
not the phone was in silent mode.

### Critical reading of the timing evidence

These studies support the general claim that timing affects responses. They are weaker for the
specific case of Fieldnote:

- **Small samples.** 20 participants (van Berkel, IJHCS; Mehrotra et al.) and 15 (Pielot et al.)
  are common in this area. Künzler et al. (189) is the exception.
- **Different kinds of prompts.** Mehrotra et al. and Pielot et al. studied ordinary app
  notifications, not research prompts. Künzler et al. studied health interventions. Only van
  Berkel's studies used research questionnaires, and they were short and objective. None studied
  prompts that ask for a photo or a video.
- **Seen is not answered.** Pielot et al. show that notifications are seen within minutes. That
  says nothing about whether the participant then records an entry. A common way to put the point
  is that a prompt at a bad moment is answered "later, carelessly or not at all". Mehrotra et al.'s
  abstract supports "later" and "disruption"; it does not support "carelessly or not at all". The
  link between bad timing and lower accuracy comes from van Berkel et al. (2019, CHI), and we cite
  that instead.

The conclusion we keep is modest: timing changes response time, response rate and accuracy, by
amounts that depend on context and on people. A platform should let researchers control timing and
should not pretend to optimise accuracy without measuring it.

## Two ways to decide when to ask

| | Context-triggered (react to the phone) | Planned ahead (Fieldnote) |
|---|---|---|
| How | The app watches the phone (unlock, screen use, activity, location) and asks when the context is favourable | The server plans each day's prompts from declared availability and study rules, then sends them |
| Evidence | van Berkel et al. (2019, both papers), Künzler et al. (2019) show context predicts response and accuracy | None found for research prompts. Planning is justified by the constraints below, not by evidence about response |
| Examples | AWARE triggers questions from context events (Ferreira, Kostakos and Dey, 2015) | m-Path and most diary tools send prompts at planned times |
| Privacy | Needs continuous sensing of phone use, activity or location | Needs only the hours the participant declares |
| Battery and platform limits | Continuous background sensing is restricted by Android and iOS | One plan download per sync, plus notifications |
| Server load | Unpredictable: many phones may trigger at once | Controlled: a cap per time slot spreads uploads |
| Explainable to participants | "We ask when your phone suggests you are free" | "We ask inside the hours you gave us" |

**Why Fieldnote plans ahead.** The evidence for context-triggered sampling is real, so this is a
trade-off and not a clear win. We chose planning for four reasons:

1. **Data minimisation.** Context triggering needs data about phone use, movement or location all
   day, for a purpose the participant does not see. File 06 argues that Fieldnote should collect
   location only when an activity asks for it. Continuous sensing for scheduling would contradict
   that.
2. **Load control.** A diary platform receives media. If many participants are prompted in the
   same minute, uploads arrive together. Planning lets the scheduler cap prompts per slot, which
   is a constraint the distributed system needs.
3. **Platform constraints.** The m-Path team explains that phones limit background activity "to
   protect battery life and privacy" (m-Path FAQ). Reliable context triggering on both Android and
   iOS is a project of its own.
4. **The course.** The Artificial Intelligence unit covers constraint satisfaction; planning prompts
   is a natural, non-trivial CSP. Context triggering would need a learned model of receptivity,
   which needs response data from a real study that this project will not have.

The price is stated in the scheduler's limits: Fieldnote cannot use the context effects van Berkel
et al. measured. Using phone context to adjust a planned prompt within its slot is future work.

## Prompt planning as a constraint satisfaction problem

### From study rules to constraints

| Rule of the study | Constraint |
|---|---|
| Do not disturb outside declared hours | A prompt's slot is inside the participant's availability |
| Ask "around lunch" | The slot is inside the activity's window |
| Do not ask twice in a row | Two prompts to the same participant are at least a minimum gap apart |
| Do not overload people | At most a daily number of prompts per participant |
| Do not overload the server | At most a number of prompts in the same slot across the study |
| Sample the whole day, or keep a routine | Soft preference for varied slots, or for the same slots every day, chosen by the researcher |

Russell and Norvig (2021, chapter 6) define a constraint satisfaction problem by variables, their
domains and constraints over them. Here the variables are prompts (participant, activity,
occurrence), the domains are 15-minute slots, and the constraints are those in the table. The full
formulation is in `04_Documentacao_Tecnica/scheduler.md`.

### The methods and where they come from

| Method | Source | What it does in the scheduler |
|---|---|---|
| Arc consistency (AC-3) | Mackworth (1977); Russell and Norvig (2021), section 6.2.2 | Before the search, removes slots that cannot satisfy the minimum-gap constraint with any slot of another prompt |
| Backtracking search | Russell and Norvig (2021), section 6.3 | Assigns slots one prompt at a time and undoes choices that lead to a dead end |
| Minimum remaining values (MRV) | Russell and Norvig (2021), section 6.3.1 | Plans first the prompt with the fewest valid slots left |
| Least constraining value (LCV) | Russell and Norvig (2021), section 6.3.1 | Tries first the slot that removes the fewest options from other prompts |
| Forward checking | Russell and Norvig (2021), section 6.3.2 | After each assignment, removes slots that became invalid |

Mackworth (1977) describes the motivation for consistency algorithms: to "eliminate local (node,
arc and path) inconsistencies before any attempt is made to construct a complete solution"
(abstract), because backtracking alone wastes time rediscovering the same conflicts. The
complexity of the arc consistency algorithms was analysed later by Mackworth and Freuder (1985).

### Alternatives we considered

- **A solver library (for example a constraint programming or integer programming solver).** It
  would probably find better plans faster. We implement the algorithms ourselves because the
   Artificial Intelligence unit asks for them, and because each daily problem is small (a study with 50
  participants and 3 prompts per day has 150 variables with at most 56 values each). The evaluation
  reports solve times so that this choice can be judged.
- **A learned model of response probability.** It would let the scheduler prefer slots where each
  participant tends to answer. It needs response histories from a real study. A model trained on
  generated data would only learn the generator. It is future work.
- **Fixed hours for everyone.** This is the baseline of the evaluation: the same hours for every
  participant, as many diary tools do. Vachon et al. (2019) found fixed sampling schemes associated
  with higher compliance in clinical populations (file 01), so the baseline is not a straw man. It
  is not the same as the researcher's "fixed" setting, where the scheduler keeps each participant's
  slots the same every day while still respecting the gap, daily and slot limits.

## Can a planned prompt reach the phone?

A plan is useless if the notification does not arrive. Fieldnote sends notifications through Expo's
push service, which forwards them to Google's and Apple's services. Expo's documentation is
direct about the guarantees:

> "Expo makes a best effort to deliver notifications to the push notification services operated by
> Google and Apple." (Expo, sending notifications)

> "The Expo push notification service does not have an SLA and the FCM and APNs services also may
> have occasional outages." (same page)

It adds that on iOS, normal-priority messages "may be grouped and delivered in bursts", and that on
Android a short time-to-live can stop normal-priority notifications from reaching phones in doze
mode. Expo's documentation says delivery is attempted at least once, so a duplicate notification is
more likely than a missing one. For background (data-only) notifications,
the Expo documentation reports Apple's recommendation not to "send more than two or three per
hour".

m-Path, which uses Firebase Cloud Messaging, faces the same problem and states that it does not
deliver planned notifications to phones without an internet connection (file 03).

**What Fieldnote does about it.**

1. **Pull on open.** Every time the app opens, it asks the API for pending prompts. A participant
   who missed a notification still sees the activity. This was already in the design.
2. **Local notifications as a fallback.** When the app syncs, it downloads the participant's plan
   for the next 24 hours and schedules local notifications on the phone, which the operating system
   fires without network. If the push notification for the same prompt arrives, or the participant
   answers, the local one is cancelled; both carry the prompt id, so a prompt is shown once. The
   plan is then fixed on the phone; a change of availability is applied at the next sync. This is
   planned and must be tested on Android before it is relied on, because manufacturers apply their
   own battery restrictions.
3. **Duplicates are harmless.** Because delivery is at least once, the app ignores a notification
   for a prompt it has already shown or answered. On the server, the prompt row has a unique key
   and a status (see the fault model).
4. **Measure delivery.** The app reports when a prompt was shown and when it was opened. The
   difference between planned, shown and opened times is data on delivery the project can collect
   without a real study, using the team's own phones and any small tests with colleagues.

## What the scheduler's evaluation can and cannot show

The evaluation in `04_Documentacao_Tecnica/scheduler.md` uses generated studies of 10, 50 and 100
participants and compares the scheduler with fixed hours. It measures:

| Measure | What it shows |
|---|---|
| Hard constraint violations | Correctness: must be zero |
| Prompts left unplanned | Whether the rules can be met for that study size |
| Solve time | Whether backtracking is fast enough for the problem size |
| Largest number of prompts in one slot | Load spread for the server |
| Soft score | How well the plan follows the researcher's preference (variety or routine) |

It does not show that participants answer more, faster or more accurately with the scheduler than
with fixed hours. That would need a real study, and the literature (Vachon et al., 2019)
even suggests fixed hours may give higher compliance. The project's claim is therefore limited to
this: the scheduler produces valid plans that respect every rule the researcher sets, spreads load
on the server, and lets the researcher choose between variety and routine. It does not claim better
data.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Timing affects response and accuracy (van Berkel et al., 2019) | Researchers control timing through rules; the platform plans within them | Adopted |
| Context triggering works but needs continuous sensing | Plan ahead from declared availability; context adjustment is future work | Adopted, limitation declared |
| Fixed hours may raise compliance (Vachon et al., 2019) | Variety is a researcher setting: fixed, balanced or varied | Adopted |
| Push is best effort, no SLA (Expo) | Pull on open, local notifications as fallback, idempotent display, delivery measured | Pull adopted; local fallback planned and to be tested |
| No real study during the course | Evaluation measures plan quality and load, never compliance | Adopted |
| Learned response model needs real data | Not built | Future work |

## Sources

- Expo. Send notifications with the Expo push service.
  https://docs.expo.dev/push-notifications/sending-notifications/
- Expo. Notifications (SDK reference). https://docs.expo.dev/versions/latest/sdk/notifications/
- Ferreira, D., Kostakos, V. and Dey, A. K. (2015). AWARE: mobile context instrumentation
  framework. *Frontiers in ICT*, 2, 6. https://doi.org/10.3389/fict.2015.00006
- Künzler, F., Mishra, V., Kramer, J.-N., Kotz, D., Fleisch, E. and Kowatsch, T. (2019). Exploring
  the state-of-receptivity for mHealth interventions. *Proceedings of the ACM on Interactive,
  Mobile, Wearable and Ubiquitous Technologies*, 3(4), 1-27. https://doi.org/10.1145/3369805
- m-Path. FAQ. https://m-path.io/landing/faq/
- Mackworth, A. K. (1977). Consistency in networks of relations. *Artificial Intelligence*, 8(1),
  99-118. https://doi.org/10.1016/0004-3702(77)90007-8
- Mackworth, A. K. and Freuder, E. C. (1985). The complexity of some polynomial network consistency
  algorithms for constraint satisfaction problems. *Artificial Intelligence*, 25(1), 65-74.
  https://doi.org/10.1016/0004-3702(85)90041-4
- Mehrotra, A., Pejovic, V., Vermeulen, J., Hendley, R. and Musolesi, M. (2016). My phone and me:
  understanding people's receptivity to mobile notifications. *Proceedings of CHI 2016*,
  1021-1032. https://doi.org/10.1145/2858036.2858566
- Mestdagh, M. et al. (2023). m-Path: an easy-to-use and highly tailorable platform for ecological
  momentary assessment and intervention in behavioral research and clinical practice. *Frontiers in
  Digital Health*, 5, 1182175. https://doi.org/10.3389/fdgth.2023.1182175
- Pielot, M., Church, K. and de Oliveira, R. (2014). An in-situ study of mobile phone
  notifications. *Proceedings of MobileHCI 2014*, 233-242. https://doi.org/10.1145/2628363.2628364
- Russell, S. and Norvig, P. (2021). *Artificial Intelligence: A Modern Approach*, 4th edition.
  Pearson. Chapter 6, Constraint Satisfaction Problems. Contents: https://aima.cs.berkeley.edu/contents.html
- Vachon, H., Viechtbauer, W., Rintala, A. and Myin-Germeys, I. (2019). Compliance and retention
  with the experience sampling method over the continuum of severe mental disorders. *Journal of
  Medical Internet Research*, 21(12), e14475. https://doi.org/10.2196/14475
- van Berkel, N., Ferreira, D. and Kostakos, V. (2017). The experience sampling method on mobile
  devices. *ACM Computing Surveys*, 50(6), article 93, 1-40. https://doi.org/10.1145/3123988
- van Berkel, N., Goncalves, J., Lovén, L., Ferreira, D., Hosio, S. and Kostakos, V. (2019). Effect
  of experience sampling schedules on response rate and recall accuracy of objective self-reports.
  *International Journal of Human-Computer Studies*, 125, 118-128.
  https://doi.org/10.1016/j.ijhcs.2018.12.002
- van Berkel, N., Goncalves, J., Koval, P., Hosio, S., Dingler, T., Ferreira, D. and Kostakos, V.
  (2019). Context-informed scheduling and analysis: improving accuracy of mobile self-reports.
  *Proceedings of CHI 2019*, 1-12. https://doi.org/10.1145/3290605.3300281

All sources accessed in September 2026.

## Limits

- For each paper we read the parts relevant to scheduling and notifications: the abstract, and
  for AWARE and m-Path the sections on triggering and notification delivery. The textbook sections are identified from the official table of contents of the fourth edition; the
  descriptions of MRV, LCV and forward checking are the standard ones taught in the course.
- The attribution of the AC-3 algorithm to Mackworth (1977) is the standard one; the paper's
  abstract describes arc consistency without using the name AC-3.
- The timing studies used questionnaires and ordinary notifications. None measured prompts asking
  for media.
- The local notification fallback is a design decision that has not been tested. Its reliability
  on Android depends on the manufacturer's battery management.
- Expo's documentation describes the service as of September 2026 and may change.
