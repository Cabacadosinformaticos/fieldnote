# Diary studies and experience sampling

## Question

What diary studies and the experience sampling method are, why researchers use them instead of
asking people afterwards, what the evidence says about how well they work, and where the evidence
is weaker than the usual summaries suggest. The answer decides what Fieldnote has to record about
each entry, which rules a researcher can set, and which claims the project must not make.

## Why this matters for Fieldnote

Every table in the data model and every rule of the scheduler assumes a particular way of running
a study. If the method is misunderstood, the platform records the wrong things. Two examples from
this file changed the design: the evidence that participants back-fill paper diaries is why the
time an entry is recorded is stored separately from the time it reaches the server, and the
contradictory evidence on how many prompts per day participants tolerate is why the daily limit is
a setting the researcher chooses instead of a value the platform imposes.

## The methods

### Diary studies

Bolger, Davis and Rafaeli (2003) open their review in the Annual Review of Psychology with a
definition:

> "In diary studies, people provide frequent reports on the events and experiences of their daily
> lives." (abstract)

The review covers which research questions diaries answer best, the main designs, the technology
used to obtain reports and how the data is analysed. The abstract points to two developments that
define the modern method:

> "Major recent developments include the use of electronic forms of data collection and multilevel
> models in data analysis." (abstract)

The first development is what Fieldnote is. The second matters for the export: multilevel models
treat repeated reports as nested inside participants, so an export must keep, for every entry, the
participant (by alias), the activity, the prompt that triggered it and its timestamps. A flat list
of entries without those keys would be unusable for this analysis.

The method arrived in human-computer interaction in the early 1990s. Rieman (1993) presented the
diary study as "a tool for research in the workplace that achieves a relatively high standard of
objectivity" (abstract), used to complement laboratory experiments with records of what people
actually did at work. Those diaries were on paper.

### Experience sampling and ecological momentary assessment

The experience sampling method (ESM) signals people at moments spread through the day and asks a
short questionnaire each time. Csikszentmihalyi and Larson (1987) wrote the early methodological
review:

> "The article reviews practical and methodological issues of the ESM and presents evidence for
> its short- and long-term reliability" (abstract)

They present ESM as a way to measure the "frequency and patterning of daily activity, social
interaction, and changes in location" (abstract), together with psychological states and thoughts.

In clinical psychology and health the same approach is called ecological momentary assessment
(EMA). Shiffman, Stone and Hufford (2008) give the rationale in one sentence:

> "EMA aims to minimize recall bias, maximize ecological validity, and allow study of
> microprocesses that influence behavior in real-world contexts." (abstract)

and they state what it replaces: assessment that "typically relies on global retrospective
self-reports collected at research or clinic visits" (abstract).

ESM and EMA are close to the diary study and the boundaries between them are not strict. In
practice, ESM and EMA tend to mean short, structured questionnaires triggered by a signal, and
diary study tends to mean longer, often open-ended entries over days or weeks. Fieldnote supports
both: a scale or multiple-choice activity behaves like an ESM item, and a photo or text activity
behaves like a diary entry.

### Diary studies in user experience research

User experience practice adopted diary studies for the same reasons. The Nielsen Norman Group
describes them as studies in which

> "participants report their interactions and experiences as they occur over a period ranging from
> a few days, weeks, to a month or longer." (Flaherty, 2024)

and points to the practical advantage that "diary studies are done remotely and asynchronously,
allowing researchers flexibility and access to distributed users". The article uses examples of one,
two and three weeks. It is a practitioner article, not peer-reviewed research, and we use it for
how studies are run, not as evidence that they work.

### Three ways of triggering a report

The literature distinguishes reports by what triggers them. Shiffman, Stone and Hufford (2008)
describe EMA designs triggered by events or by periodic or random time sampling, and Flaherty (2024)
names the same three logging modes for UX diary studies: event-based, interval-based and
signal-based.

| Design | When the participant reports | How Fieldnote supports it |
|---|---|---|
| Interval-based | At fixed times or intervals, for example every evening | An activity with a fixed daily window and one prompt per day |
| Signal-based | When the device signals them, at times chosen by the study | Prompts planned by the scheduler and sent as notifications |
| Event-based | Every time a defined event happens | Free entries recorded by the participant without a prompt, when the activity allows them |

## What the evidence says, and where it disagrees

### Paper diaries were often filled in after the fact

The strongest single result in this area is a short report in the BMJ. Stone et al. (2002) gave 80
adults with chronic pain either a paper diary or an electronic one for 21 days, with entries due at
10:00, 16:00 and 20:00. The paper binder had a hidden light sensor that recorded when it was
opened. The participants did not know.

> "With the paper diary, reported compliance was 90%, but actual compliance was 11% (20% with the
> wider 90 minute window)." (Methods and results)

> "Hoarding was common with the paper diary: 32% of days contained no diary openings" (Methods and
> results)

"Hoarding" here means filling in several entries at once, later, and writing the expected times on
them. Most of the participants on paper (75%) did it at least once. With the electronic diary,
which only accepted entries inside the window and sounded an alarm, "actual compliance was 94%".
The full study (Stone et al., 2003, Controlled Clinical Trials) concludes that "The findings call
into question the use of paper diaries" (abstract).

**Our reading.** The result is often quoted as proof that electronic diaries solve compliance. That
goes further than the study. Three things limit it:

- The electronic diary refused late entries. It did not measure whether people would have
  back-filled it if they could; it made back-filling impossible. A tool that accepts late entries
  can be back-filled too.
- The population was chronic-pain patients on a rigid schedule, paid 150 USD, which is very
  different from a two-week qualitative study about using a service.
- The paper declares that three authors were connected to the company that made the electronic
  diary. The result has been influential and the design is clever, but the conflict of interest is
  part of reading it.

**What it changes in Fieldnote.** Fieldnote has an offline queue: entries recorded without network
are sent later. That is necessary (file 02 and the fault model), but it reopens the door Stone's
electronic diary closed. A participant could record three entries in the evening and the server
would receive them together. The design answer is to store two times for every entry:
`recorded_at`, taken by the app at the moment of capture, and `received_at`, taken by the server.
The dashboard shows both, and the researcher can see when entries were captured in a burst. A
participant can still create an entry late; the difference is that the platform does not hide it.
This decision is in the data model.

We also decided against the alternative of refusing entries outside the activity window. It would
imitate the design that gave Stone's electronic diary its 94% compliance, but it would also discard entries that were recorded on time and only
reached the server late because the phone was offline. In a platform designed so that no entry is
lost, rejecting late arrivals would contradict the main requirement.

### How many prompts per day: the evidence is split

The scheduler has a rule "no more than N prompts per participant per day". The intuitive reason is
that more prompts tire people and they stop answering. The literature does not settle this.

**Evidence that frequency does not matter much.** The largest study is a meta-analysis by Wrzus and
Neubauer (2023) of EMA studies across research fields: 477 articles, 496 samples, 677 536
participants.

> "on average EMA studies scheduled six assessments per day, lasted for 7 days, and obtained a
> compliance of 79%." (Wrzus and Neubauer, 2023)

> "the number of assessments did not predict compliance or dropout rates." (Wrzus and Neubauer, 2023)

An experimental study points the same way. Eisele et al. (2022) randomly assigned 163 students to
questionnaires of 30 or 60 items, sent 3, 6 or 9 times a day for 14 days, in a preregistered design:

> "Our findings offer support for increased burden and compromised data quantity and quality with
> longer questionnaires, but not with increased sampling frequency." (abstract)

Earlier, Stone et al. (2003, Pain) had found with 91 chronic-pain patients that "Compliance with
the electronic diary protocol was 94% or better, and was not related to sampling density"
(abstract).

**Evidence that frequency does matter.** Vachon et al. (2019) ran a meta-analysis of ESM studies in
people with depression, bipolar disorder and psychotic disorders:

> "Compliance was positively associated with the use of a fixed sampling scheme (P=.02), higher
> incentives (P=.03)" (abstract)

and with "fewer evaluations per day (P=.008)" (abstract). Wrzus and Neubauer also report, in an
exploratory analysis, that "Compliance was lower with more assessments per day, and this effect
flattened with more assessments", with a linear term at p = .055, just above the usual .05
threshold, so we treat it as a hint.

**Our reading.** These results do not cancel each other. They measure different populations and
different burdens:

- Wrzus and Neubauer and Eisele et al. studied mostly short questionnaires. Answering six items on
  a scale takes seconds. Recording a video of a place takes minutes and sometimes a decision about
  whether it is appropriate to film. None of these studies measured the cost of asking for media.
  Eisele et al. found that the length of each questionnaire (30 or 60 items) mattered more than how
  often it came, which suggests that effort per prompt may be the variable that counts. We assume,
  by analogy and without evidence, that a photo or video prompt costs the participant more than a
  short questionnaire.
- Vachon et al. studied clinical populations, where the burden of each prompt can be higher.
- Mean compliance figures hide the fact that, according to Wrzus and Neubauer, dropout was reported
  in only 140 of 496 samples (28.2%), with a mean of 10.58% where reported. Studies with high
  dropout may be the ones that did not report it.

**What it changes in Fieldnote.**

1. `max_prompts_per_day` stays, but as a safeguard the researcher sets, with no default presented as
   "the right number". The documentation does not claim it improves compliance.
2. The effort of each activity matters at least as much as the count. The dashboard shows, for
   each activity, the entry type and the expected duration (for example "video, up to 2 minutes"),
   so the researcher sees the total load of a day. This is a display, not a rule: we have no
   evidence on which to base a rule about media effort.
3. The scheduler's evaluation measures what it can measure without a real study: constraint violations,
   unplanned prompts, solve time and load spread. It does not measure compliance, and the project
   will not claim that the scheduler increases response rates (see file 04).

### Fixed or varied times: a real trade-off

A natural default for a scheduler is to prefer varied times across days, so that a study samples
the whole day and not always the same moment. Vachon et al. found the opposite effect on
compliance: fixed schemes were associated with higher compliance. Both goals are legitimate. Variety reduces the
bias of always sampling the same hour; fixed times are easier for participants to fit into their
routine.

The decision is to let the researcher choose. The soft preference for variety becomes a study
setting with three levels: fixed (the scheduler tries to keep each participant's slots the same
every day), varied (it avoids repeating yesterday's slots and spreads prompts over the day) and
balanced, an intermediate weight between the two. Fixed is not a separate algorithm; it changes the weight of the
soft preference in the score that ranks valid plans.

### Participants drop out and report less over time

Eisele et al. found that "Compliance was found to decrease over time" (Results) within their 14-day
study. Flaherty (2024) advises researchers to "Consider overrecruiting in preparation for potential
dropouts so that you have enough data points in the end", and to monitor entries as they arrive so
that follow-up questions can be asked while memory is fresh.

The second recommendation is the one a platform can act on. Fieldnote's dashboard shows adherence
per participant in real time, so the researcher can see who has gone quiet on the third day and
contact them, instead of discovering it at the end.

### Asking people in the moment has a cost

Brandt, Weiss and Klemmer (2007) observed that

> "when participants are asked to capture data while mobile or active, they are often unwilling or
> unable to invest time in thorough, reflective entries." (abstract)

Their answer, the snippet technique, let participants send a few seconds of text, a picture or a
voicemail in the field and complete the full entry later on a website. In two two-week studies,
entries started from snippets were significantly longer than entries written in the moment. They
also found something that cuts against a media-rich platform: when full entries were required in
the moment, "only one entry (out of 122) used a media other than written text" (Results). We
discuss media choice in file 02.

**What it changes in Fieldnote.** Quick capture is a requirement: an entry must be recordable in a
few taps, with the app keeping it locally until it can be sent. Completing an entry later (adding a
reflection to a photo taken in the street) is a good idea that the current design does not
include. It is listed as future work, because it adds an editable state to entries, and every
editable state complicates the guarantee that a confirmed entry is never lost or duplicated.

### Fabricated entries

Flaherty (2024) warns that unlimited paid entries create an incentive "to avoid having respondents
manufacture fake interactions to earn more money", and recommends capping submissions. This is the
event-based design's weak point: if every event is worth a reward, participants have a reason to
invent events. Fieldnote does not handle incentives, but it lets the researcher decide, per
activity, whether free entries are allowed and how many per day. The scheduler's daily limit only
covers prompts; a cap on free entries is a separate setting.

## What we conclude

- Diary studies and ESM rest on a solid idea that is well supported: reports close to the
  experience are better than reports from memory. The evidence for that is in psychology and
  health, with structured questionnaires.
- Several claims commonly made about these methods are weaker than they look. Electronic diaries
  may be better than paper partly because they refused late entries; the study cannot separate the
  two. More prompts per day lowers compliance in some studies and not in others. Questionnaire
  length mattered in the one experiment that tested it, and we reason, without measurements, that
  photo and video prompts are costly.
- A platform cannot make a study good. It can make the researcher's choices explicit and keep the
  evidence (timestamps, adherence) that shows how the study really went.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Paper diaries were back-filled (Stone et al., 2002) | Store `recorded_at` from the app and `received_at` from the server; show both in the dashboard | Adopted, in the data model |
| Rejecting late entries raises "compliance" but loses data | Accept late entries from the offline queue | Adopted |
| Frequency and compliance: contradictory evidence | Daily prompt limit is a researcher setting, no claim that it improves compliance | Adopted |
| Effort per prompt matters (Eisele et al., 2022) | Show expected effort per activity and per day in the dashboard | Planned, dashboard scope |
| Fixed times give higher compliance, varied times better coverage (Vachon et al., 2019) | Researcher chooses fixed, balanced or varied | Adopted, scheduler setting |
| Dropout over time | Real-time adherence per participant | Adopted, already in scope |
| Multilevel analysis needs nested data | Export keeps participant alias, activity, prompt and both timestamps for each entry | Adopted |
| Snippet then full entry (Brandt et al., 2007) | Complete an entry later | Future work |
| Fabricated free entries | Per-activity setting for free entries and a daily cap | Adopted |

## Sources

- Bolger, N., Davis, A. and Rafaeli, E. (2003). Diary methods: capturing life as it is lived.
  *Annual Review of Psychology*, 54(1), 579-616.
  https://doi.org/10.1146/annurev.psych.54.101601.145030
- Brandt, J., Weiss, N. and Klemmer, S. R. (2007). txt 4 l8r: lowering the burden for diary studies
  under mobile conditions. *CHI '07 Extended Abstracts on Human Factors in Computing Systems*,
  2303-2308. https://doi.org/10.1145/1240866.1240998 (author copy:
  https://hci.stanford.edu/cstr/reports/2007-01.pdf)
- Csikszentmihalyi, M. and Larson, R. (1987). Validity and reliability of the experience-sampling
  method. *Journal of Nervous and Mental Disease*, 175(9), 526-536.
  https://doi.org/10.1097/00005053-198709000-00004
- Eisele, G., Vachon, H., Lafit, G., Kuppens, P., Houben, M., Myin-Germeys, I. and Viechtbauer, W.
  (2022). The effects of sampling frequency and questionnaire length on perceived burden,
  compliance, and careless responding in experience sampling data in a student population.
  *Assessment*, 29(2), 136-151. https://doi.org/10.1177/1073191120957102
- Flaherty, K. (2024). Diary studies: understanding long-term user behavior and experiences.
  Nielsen Norman Group, 29 March 2024. https://www.nngroup.com/articles/diary-studies/
- Rieman, J. (1993). The diary study: a workplace-oriented research tool to guide laboratory
  efforts. *Proceedings of INTERACT '93 and CHI '93*, 321-326. https://doi.org/10.1145/169059.169255
- Shiffman, S., Stone, A. A. and Hufford, M. R. (2008). Ecological momentary assessment. *Annual
  Review of Clinical Psychology*, 4, 1-32. https://doi.org/10.1146/annurev.clinpsy.3.022806.091415
- Stone, A. A., Shiffman, S., Schwartz, J. E., Broderick, J. E. and Hufford, M. R. (2002). Patient
  non-compliance with paper diaries. *BMJ*, 324(7347), 1193-1194.
  https://doi.org/10.1136/bmj.324.7347.1193 (open access: https://pmc.ncbi.nlm.nih.gov/articles/PMC111114/)
- Stone, A. A., Shiffman, S., Schwartz, J. E., Broderick, J. E. and Hufford, M. R. (2003). Patient
  compliance with paper and electronic diaries. *Controlled Clinical Trials*, 24(2), 182-199.
  https://doi.org/10.1016/S0197-2456(02)00320-3
- Stone, A. A., Broderick, J. E., Schwartz, J. E., Shiffman, S., Litcher-Kelly, L. and Calvanese, P.
  (2003). Intensive momentary reporting of pain with an electronic diary: reactivity, compliance,
  and patient satisfaction. *Pain*, 104(1), 343-351. https://doi.org/10.1016/S0304-3959(03)00040-X
- Vachon, H., Viechtbauer, W., Rintala, A. and Myin-Germeys, I. (2019). Compliance and retention
  with the experience sampling method over the continuum of severe mental disorders: meta-analysis
  and recommendations. *Journal of Medical Internet Research*, 21(12), e14475.
  https://doi.org/10.2196/14475
- Wrzus, C. and Neubauer, A. B. (2023). Ecological momentary assessment: a meta-analysis on
  designs, samples, and compliance across research fields. *Assessment*, 30(3), 825-846.
  https://doi.org/10.1177/10731911211067538 (open access:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC9999286/)

All sources accessed in September 2026.

## Limits

- For each source we read the parts that answer the question of this file: the abstract, and for
  Brandt et al. (2007), Stone et al. (2002), Eisele et al. (2022), Wrzus and Neubauer (2023) and the
  Nielsen Norman Group article also the methods and results. Nothing is attributed to a source
  beyond the parts we read. Bolger et al. (2003) is behind a paywall; we cite it only for what its
  abstract says.
- The van Berkel et al. (2017) survey of mobile ESM is cited in file 04 only for the point that the
  notification schedule is a design decision.
- Almost all of the quantitative evidence comes from psychology and health, with questionnaires.
  We found no study that measures compliance for photo, video or audio diary prompts. The
  decisions above that depend on media effort are reasoned, not measured.
- Fieldnote will not be used in a real study during the course, so the project does not replicate
  these findings. The team may run a few small tests with people, such as colleagues using the app for some days,
  but never at the scale of a real study, and it promises no results from them.
