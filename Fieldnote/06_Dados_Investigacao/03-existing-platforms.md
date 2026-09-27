# Existing platforms

## Question

Which platforms already support diary studies, experience sampling and mobile ethnography, what
each one does well, which of their design choices Fieldnote copies, which it rejects, and what is
left that justifies building another one. We also checked the claims of difference that are easy
to make and wrong.

## Why this matters for Fieldnote

A project that builds something that already exists has to say why. "No tool does this" is the
easiest claim to make and the easiest to disprove, so this file compares feature by feature, using
only what each vendor or paper states, and separates three cases: what Fieldnote shares with
existing tools, what it learns from them, and where it differs.

## How the comparison was made

- Commercial platforms are described only from their own public pages, help centres and app store
  listings. We did not have accounts on any of them.
- Academic platforms are described from their peer-reviewed papers and public repositories.
- An empty cell in the tables means the sources we read do not say. It does not mean the product
  lacks the feature.

## Commercial platforms

### Indeemo

Indeemo sells mobile ethnography and diary studies as a hosted service. Participants share videos,
photos, screen recordings and text from their daily lives; researchers set tasks and review, filter
and tag responses in a browser. Two details from its documentation matter for us:

> "Entries recorded in the Indeemo app are securely saved to the device, allowing participants to
> upload them when convenient or when a signal is available." (help centre, respondent walkthrough)

> "Indeemo is ISO 27001 and SOC 2 certified, GDPR-aligned, with EU and US data residency options."
> (mobile ethnography page)

The first shows that offline capture is a standard feature of the category, not something new in
Fieldnote. The second shows how a commercial vendor answers the data-protection question: with
certifications and a choice of region, inside the vendor's infrastructure.

### dscout Diary

dscout organises studies as "missions" made of activities, answered by participants it calls
scouts. Its help centre says that "Dscout diary studies are built for in-context, diary-style
research" and lets researchers "ask participants follow-up questions" as entries "appear in
real-time". Each entry can carry several media: participants "can submit up to 5 photos plus 3
video or screen recording responses". Diary studies are available on its Core, Select and
Enterprise plans, not on the Base plan. Prices are given as a custom quote. On data protection,
dscout states that it "is fully compliant with GDPR" and holds ISO 27001 certification with SOC 2
Type II audits; it does not state where data is stored.

The follow-up question on an entry is a feature Fieldnote does not have. It fits the interpretive
framing of mobile ethnography (file 02), where the researcher builds understanding with the
participant. We list it as future work.

### EthOS

EthOS offers ethnography, diary studies and chat-based
interviews through iOS and Android apps that capture video, pictures, screen recordings and text.
It advertises access to a large participant panel, "a diverse network of over 3 million participants
spanning 150+ countries". Its App Store privacy label lists the data the app collects, including
"Precise Location", photos or videos, and audio. A dedicated location feature is not described on
the pages we read.

The panel shows a dimension of these products that Fieldnote does not address at all: recruitment.
A research unit using Fieldnote recruits its own participants.

### Recollective

Recollective is a qualitative research platform for agencies and brands: online communities,
bulletin boards, diaries, ethnography, concept tests and live interviews. Its page describes a
"mobile-ready platform designed specifically for research" with "rich asynchronous tasks". The page
we read does not detail capture media, offline use or data residency.

## Academic and open platforms

### m-Path

m-Path is an online platform for ecological momentary assessment and intervention, described in a
peer-reviewed paper (Mestdagh et al., 2023). It is the closest academic
counterpart to Fieldnote's researcher dashboard and participant app, and its paper is unusually
open about its design choices:

> "m-Path is currently closed-source for security purposes" (Mestdagh et al., 2023)

> "To push notifications to user's mobile phones, m-Path uses Firebase Cloud Messaging"
> (Mestdagh et al., 2023)

> "m-Path strongly advises participants to specify an alias or nickname in order to guarantee their
> anonymity" (Mestdagh et al., 2023)

Participants join with an invitation code and an alias. That is the same participant identity
design Fieldnote chose independently (invite code, alias, no participant account; see
`04_Documentacao_Tecnica/data-model.md`). An established research platform making the same choice
is a useful confirmation that it is workable.

m-Path's FAQ adds two operational facts: data "are stored securely on Microsoft Azure servers in
Frankfurt, Germany", and "If needed, data can also be stored on your own private servers". Its
pricing page lists a free tier for 50 participants per year and an Essential plan from 1599 EUR
per year (excluding VAT) for 300 participants.

The most important passage for us is about notifications. The paper says that m-Path

> "does not provide offline sampling schemes that deliver notifications when participants do not
> have an active internet connection" (Mestdagh et al., 2023)

and the FAQ explains that phones limit background activity "to protect battery life and privacy".
Once a notification is opened, participants can answer offline and the answers are uploaded later.
Fieldnote has the same structure (prompts planned on the server, delivered by a push service) and
therefore the same weakness. File 04 discusses how Fieldnote answers it.

### Beiwe

Beiwe is a research platform from the Onnela lab at Harvard, described by Torous et al. (2016) as
built for research-quality smartphone sensor and survey data in psychiatry. It is open source
under the BSD-3-Clause licence and is deployed by the research team, but on a specific cloud:
"Beiwe currently supports Amazon Web Services (AWS) cloud computing infrastructure" (repository
README). Its paper describes a privacy design close to Fieldnote's:

> "The only identifier linking subjects to their data in the platform is the participant ID."
> (Torous et al., 2016)

> "Direct identifiers in the collected data are hashed, and data are always encrypted" (Torous et
> al., 2016)

The app keeps encrypted data on the phone and uploads it when Wi-Fi is available, then deletes it
from the phone. That is the store-and-forward pattern of Fieldnote's offline queue. Beiwe is
oriented to passive sensing (digital phenotyping) more than to photo and video diaries, although
its repository mentions an audio diary feature.

### AWARE

AWARE (Ferreira, Kostakos and Dey, 2015) is "an open-source effort to develop an extensible and
reusable platform for capturing, inferring, and generating context on mobile devices". It supports
"a flexible ESMs questionnaire-building schema (defined in JSON) for in situ human-based context
sensing". Questions can be triggered by context events, by time or on demand. The project's site
says it is "primarily an Android app, although there is an iOS port", distributed through GitHub
rather than the Play Store because it uses permissions that store guidelines do not allow.

AWARE triggers questions from what the phone senses. Fieldnote plans them ahead from what the
participant declares (availability). File 04 compares the two approaches.

### Other tools found

| Tool | What it is | Relevance |
|---|---|---|
| PACO (Google) | "an opensource, mobile, behavorial research platform" (README, original spelling), Apache 2.0 | The repository was archived by its owner on 18 April 2026 and is read-only. An open tool used by researchers stopped being maintained, which is a risk any research tool carries, including Fieldnote |
| movisensXS | Commercial experience sampling platform. "Works online and offline Once synchronized, the study operates without requiring an internet connection." States GDPR compliance and pseudonymised storage | Shows offline operation of a whole study, not only of entries |
| LimeSurvey | Open-source survey tool, self-hosted or hosted, with a choice of data centre | Often used for repeated questionnaires, but it is a web survey tool without media diary capture or scheduling |

## Feature comparison

| Feature | Indeemo | dscout | EthOS | m-Path | Beiwe | AWARE | Fieldnote (planned) |
|---|---|---|---|---|---|---|---|
| Activities or tasks sent to participants | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Photo, video or audio capture | Yes | Yes | Yes | | Audio diary | | Yes |
| Location with entries | | | Collected (store label) | | GPS sensing | Sensing | Optional per activity |
| Entries kept on the phone and sent later | Yes | | | After a notification is opened | Yes (Wi-Fi) | Yes | Yes |
| Real-time researcher dashboard | Yes | Yes | | Yes | | | Yes |
| Follow-up questions on an entry | | Yes | Chat interviews | | | | Future work |
| Participant alias or ID only, no account | | | | Yes | Yes | | Yes |
| Deployed by the research team | No | No | No | Optional own servers | Yes, on AWS | Yes | Yes, on the team's own machines |
| Source code available | No | No | No | No | Yes | Yes | Yes |
| Prompt times planned by an optimiser | | | | | | | Yes |

## Critical reading: what is really different

The easy claim is that commercial platforms are hosted by the vendor and Fieldnote is
self-hosted. That is true of Indeemo, dscout, EthOS and Recollective, but it would make Fieldnote
look unique, which it is not: Beiwe and AWARE are deployed by research teams, and m-Path can store
data on a team's own servers. Going through the table feature by feature:

**Not different.** Offline capture, real-time dashboards, tags, media capture, push notifications
and alias-based participants all exist in at least one other platform. Fieldnote implements them
because a diary platform needs them.

**Different in combination.** We did not find a platform that combines all of the following. That is
a statement about what we found, not proof that none exists.

1. Photo, video and audio diary entries, as in the commercial ethnography tools.
2. Open source and deployable on the institution's own hardware without a specific cloud provider.
   Beiwe is open but tied to AWS; m-Path's own-server option is for data storage, and its code is
   closed.
3. Fault tolerance as an explicit property to be tested: replicated database, broker and object
   storage, with a written fault model and planned failure demonstrations. Vendors certify security (ISO 27001,
   SOC 2), but none of the pages we read describes what happens to a confirmed entry when a server
   fails. A self-hosted research tool has to answer that itself.
4. Prompt times planned ahead by a constraint solver from rules the researcher sets.

Point 3 is what the distributed systems work contributes, point 4 what the artificial intelligence
work contributes, and point 2 follows from the user (file 00). Not finding the combination
elsewhere says nothing about whether it is needed; file 00 argues that it is.

**What the others do better, and we will not match.** Recruitment panels (EthOS), analysis
and AI features (Indeemo), certified security processes (all commercial vendors), years of use in
real studies (m-Path, Beiwe, AWARE), and iOS support at the same level as Android (Fieldnote will
be tested on Android only). These are listed in the descriptive report as limitations, not hidden.

**What the others teach us to avoid.** PACO's archiving shows that a research tool lives only as
long as someone maintains it. Fieldnote is a course project; if UNIDCOM or anyone else were to use
it, maintenance would be an open question. AWARE's distribution
outside the app stores, because of the permissions it uses, is a reminder to keep Fieldnote's
permissions to what it needs: camera, microphone, notifications, and location only when an
activity asks for it.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Offline capture is standard (Indeemo, Beiwe, AWARE) | Keep it, without presenting it as new | Adopted |
| m-Path and Beiwe use aliases or IDs without participant accounts | Confirms the invite code and alias design | Adopted, already in the data model |
| m-Path cannot deliver server-planned prompts to an offline phone | Same weakness in Fieldnote; mitigations in file 04 | Adopted, see file 04 |
| dscout allows several media per entry and follow-up questions | Activities accept one or more entry types (file 02); follow-up questions deferred | Partly adopted |
| Beiwe is open but tied to AWS | Fieldnote uses only components that run anywhere Docker runs (PostgreSQL, RabbitMQ, Garage) | Adopted, in the architecture |
| Self-hosting alone does not make Fieldnote different | Difference stated as a combination of features | Adopted, in all documents |
| PACO was archived | Maintenance after the course is declared as an open question | Adopted, in the report's limitations |

## Sources

- AWARE. AWARE framework. https://awareframework.com/
- Beiwe. beiwe-backend repository. https://github.com/onnela-lab/beiwe-backend
- dscout. What are diary studies in dscout. https://help.dscout.com/diary-studies/what-are-diary-studies-in-dscout
- dscout. Understanding studies, activities and entries for researchers.
  https://help.dscout.com/diary-studies/what-are-diary-studies-in-dscout/understanding-studies-activities-and-entries-for-researchers
- dscout. GDPR, HITRUST, HIPAA, privacy and security.
  https://help.dscout.com/privacy-and-feedback/gdpr-hitrust-hipaa-privacy-and-security
- dscout. Pricing. https://dscout.com/pricing
- EthOS. Platform and mobile diary studies. https://ethosapp.com/platform,
  https://ethosapp.com/mobile-diary-studies
- EthOS Mobile Research. App Store listing. https://apps.apple.com/us/app/ethos-mobile-research/id1569877105
- Ferreira, D., Kostakos, V. and Dey, A. K. (2015). AWARE: mobile context instrumentation
  framework. *Frontiers in ICT*, 2, 6. https://doi.org/10.3389/fict.2015.00006
- Google. PACO repository. https://github.com/google/paco
- Indeemo. Mobile ethnography. https://indeemo.com/solutions/mobile-ethnography
- Indeemo. The respondent experience walkthrough.
  https://help.indeemo.com/moderator-resources/the-respondent-experience-walkthrough
- LimeSurvey. https://www.limesurvey.org/
- m-Path. FAQ and pricing. https://m-path.io/landing/faq/, https://m-path.io/landing/pricing/
- Mestdagh, M. et al. (2023). m-Path: an easy-to-use and highly tailorable platform for ecological
  momentary assessment and intervention in behavioral research and clinical practice. *Frontiers in
  Digital Health*, 5, 1182175. https://doi.org/10.3389/fdgth.2023.1182175
- movisens. movisensXS. https://movisens.com/en/products/movisensxs/
- Recollective. Qualitative research platform.
  https://www.recollective.com/qualitative-research-recollective
- Torous, J., Kiang, M. V., Lorme, J. and Onnela, J.-P. (2016). New tools for new research in
  psychiatry: a scalable and customizable platform to empower data driven smartphone research.
  *JMIR Mental Health*, 3(2), e16. https://doi.org/10.2196/mental.5165

All sources accessed in September 2026.

## Limits

- Commercial descriptions come from marketing pages, help centres and store listings. We did not
  test any product. Architecture, hosting and scheduling methods of the commercial products are
  not public.
- Some pages could not be read: EthOS pricing, the full Recollective feature list, mEMA (a page
  that renders only with JavaScript). Qualtrics was not reviewed.
- Product pages move; the addresses listed above were current when accessed.
- For m-Path, Beiwe and AWARE we read the sections of their papers that describe architecture,
  privacy and notifications. The papers describe each platform at the time of publication.
