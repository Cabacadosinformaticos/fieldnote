# Visualising entries and adherence

## Question

How a researcher should be shown a study as it runs: all entries of all participants over time, and
how well each participant is answering the prompts planned for them. What the literature on
visualising event data says about timelines and their known problems, how adherence (compliance) is
defined, reported and patterned in experience sampling, what is known about matrix and heatmap
displays and about encodings that do not depend on colour, and what existing platforms state that
they show. The answer checks two decisions taken after the interviews in file 09.

## Why this matters for Fieldnote

Two people asked for a timeline of all entries (a UNIDCOM researcher with the project's lecturer
present, session 1), a designer warned that it easily becomes unreadable (session 2), and a computer
engineering lecturer said there was a better way to show a participant's daily adherence than two
separate bar charts (session 4). The team decided on:

1. A timeline view with one lane per participant, filters (participant, entry type, activity, tag),
   a zoom between week, day and hours, and the details of a selected entry on demand.
2. One adherence heatmap per participant: study days by request slot, with answered, missed or
   expired, and future states, a row for free entries, and a legend that does not rely on colour
   alone.

Both are interface decisions that are cheap to change now and expensive to change after the portal
is built. File 01 already established that the dashboard shows adherence per participant in real
time and that `recorded_at` and `received_at` are stored separately. This file asks whether the
literature supports the two displays and what they must define to be honest. Ideas for recruitment
posters offered by two designers are outside this file.

## Event data over time

### Overview, zoom, filter, details

Shneiderman (1996) states the principle in the abstract of his taxonomy paper as a "Visual
Information-Seeking Mantra: Overview first, zoom and filter, then details-on-demand", and adds in
the same sentence that it is "only a starting point". The paper lists seven tasks (overview, zoom,
filter, details-on-demand, relate, history, extract) and seven data types. For temporal data it
gives the distinction that matters here: "items have a start and finish time and that items may
overlap" (data types section). Fieldnote entries are mostly points, but a video or an open prompt
window has a duration, so overlap applies.

The mantra is a task framework. The paper proposes it and does not test whether following it
produces readable displays. It tells us what the timeline must offer, which the team's decision
already covers (overview of all lanes, zoom, four filters, details on demand). It cannot tell us
whether the result is legible. The designer's warning stands on its own.

### LifeLines

Plaisant et al. (1996) designed LifeLines for the Maryland Department of Juvenile Justice and then
for medical records. A one-screen overview shows facets of a record as horizontal lines on a time
scale, with icons for discrete events, and "rescaling tools or filters" let the user focus on part
of it (abstract). Two points transfer to Fieldnote.

- LifeLines shows one person's history. Fieldnote needs many people on one time axis, which is a
  different problem and the reason for lanes. LifeLines2 and LifeFlow, built later by the same
  group, address sets of records (Monroe et al., 2013, introduction), but we did not read those
  papers.
- When a record had more lines than the screen could show, the authors warned that "scrollbars are
  inadequate - if not harmful - when presenting overviews", because users forget to browse the
  whole image or do not notice that part of it is hidden (section on complex records). A
  portal with 30 participant lanes will hit this limit.

The evaluation was a demonstration of a prototype to about 60 social workers and administrators in
20-minute sessions, not a controlled test. Some of them worried that colour and thickness coding
could bias the reader. The authors concluded that such coding "should be used carefully to avoid
misleading overviews" (design review section). That applies to any colour Fieldnote gives to an
entry type or a prompt state.

### Clutter and its remedies

Three remedies recur in the sources we read.

**Lanes with a shared axis.** Javed, McDonnel and Elmqvist (2010) compared line graphs for multiple
time series. Techniques that give each series its own chart, such as small multiples and horizon
graphs, were "generally more efficient for comparisons across time series with a large visual
span", while shared-space graphs were better over small spans where overlap and clutter are low
(abstract). Their data were continuous series, not events, so the transfer is by analogy. It
supports separating participants into rows once there are more than a few.

**Aggregation that depends on zoom.** Elmqvist and Fekete (2010) present hierarchical aggregation to
make representations "more visually scalable and less cluttered" (abstract). Their guidelines
include keeping a budget of visual entities on screen (G1) and a warning that "abstractions may lie"
(G5), meaning an aggregate must not hide a pattern the detail contains, and that it must stay
interpretable (G6). For the timeline this means that at week zoom a lane should show a count per
day or per slot, not hundreds of overlapping marks, and that the aggregate must say what it
counts.

**Simplification and filtering.** Monroe et al. (2013) report that real researchers used
user-driven simplifications to make "initially overwhelming" electronic health record datasets
analysable (abstract). One example in their Figure 1 reduced the visual elements from over 2,700 to
492, an 80% reduction in visual complexity. Their data are medical event sequences with a different
user population, but the point is general: filters are part of the answer to clutter, not an extra.

A rough size shows why this matters. Thirty participants, 14 days and about eight entries a day make
3,360 marks (illustrative arithmetic, not from a source), too many to read as individual marks at
week zoom.

## Adherence in experience sampling

### Definition and reporting

Stone and Shiffman (2002) list "rates of compliance with the sampling plan" among seven aspects of
momentary research that are often overlooked in reports (abstract). Trull and Ebner-Priemer (2020)
turn this into a list for ambulatory assessment, in the section on compliance of the accepted
manuscript. They ask investigators to define compliance and lack of it, with the example of whether
a cancelled assessment counts as non-compliance. They also ask for compliance by type of assessment,
for the mean and the range across participants, for a justified inclusion threshold, and for an
examination of "systematic influences or patterns on compliance rates (e.g., time of day; day of
week; day of study)". They add that there is no hard rule for the threshold. In their review, 65% of
papers defined compliance and gave descriptive statistics on overall compliance to prompted
reports.

Platforms define it differently. m-Path's response rate is "completed scheduled beeps* divided by
all scheduled beeps* that have already been sent", and its footnote excludes reminders, test
notifications and self-initiated questionnaires (Visualize page). The Samply documentation defines
compliance as responses divided by prompts sent and counts a notification with its reminders as one
prompt. Both leave future prompts out of the denominator, and both leave out entries the participant
started alone. These are the rules Fieldnote's heatmap needs to state as well.

### Levels and patterns

Levels vary by population and design. Wrzus and Neubauer (2023, file 01) found 79% on average over 496
samples; Jones et al. (2019) found a pooled 75.06% in 126 studies of substance users, below the 80%
they call the recommended rate, with no association with prompt frequency (abstract); Ottenstein and
Werner (2022) extracted data from 488 studies and found that compliance was negatively related to
the total number of measurement occasions and to the number of study days (abstract).

The patterns inside a study matter more for the heatmap. Rintala et al. (2019) pooled 10 experience
sampling studies, 1,717 people and 92,394 assessments, with 4 to 6 days and 10 random prompts a day.
Average compliance was 78%, but it "declined across days" and reached a low on day 5 (73%), and it
varied by time of day: highest between 12:00 and 13:30 (83%) and lowest between 7:30 and 9:00 (56%).
Eisele et al. (2022, file 01) also found a decline over time.

**Our reading.** Three limits apply. First, Rintala's studies used paper diaries, and the abstract
does not say how entry times were checked; file 01 shows that paper entries are often filled in
later, so the time-of-day pattern may partly reflect when people chose to complete the form.
Second, the protocol was random prompts with clinical samples, unlike a qualitative study with media
prompts at planned times. Third, an average hides individuals: Trull and Ebner-Priemer ask for the
range across participants for that reason. What transfers is the structure: adherence varies along
at least two axes, study day and time of day, and the person running the study needs to see both for
each participant.

Hsieh et al. (2008) tested giving participants visualisations of their own responses and reported a
23% higher compliance rate in an exploratory 25-day study (abstract). That addresses participants,
not researchers, and interviewees asked for no points or streaks (file 09). We note it and do not
adopt it.

## Matrix and calendar displays

### When they work

Van Wijk and van Selow (1999) used a calendar to show which days belong to which cluster of daily
patterns, to "identify patterns and trends on multiple time scales (days, weeks, seasons)
simultaneously" (abstract). Their data were energy use and staff counts, and their claim is a
worked application, not a test with users. A days-by-slots grid has the same property on a smaller
scale: a row is a day, a column is a moment of the day, and the eye can follow a vertical streak
(the same slot missed every day) or a horizontal one (a day lost).

We found no controlled study comparing a matrix with bar charts for showing adherence. The decision
rests on this structural argument and on the lecturer's advice, not on measured performance.

### Colour scales

Matrix displays usually encode value with colour, and the evidence on colour is cautionary. Kraus et
al. (2020) tested 2D and 3D heatmaps with 48 people and found that the 2D heatmap performs better
for overview tasks, while height gave lower error rates for reading single values (abstract). Han and
Nacenta (2020) state that "color perception is subject to context-based perceptual bias and high
error", and report that overlaying digits on the colour raised accuracy by 10 to 60 percentage
points depending on the task, at some cost in time (abstract). Crameri, Shephard and Heron (2020)
argue against rainbow-like and red-green colour maps because they distort data and are unreadable to
people with colour-vision deficiency (abstract), and give estimates of 0.5% of women and 8% of men
worldwide (main text).

These studies concern continuous values. Fieldnote's cells are mostly categorical (about five states),
for which exact value reading does not arise. They still support three practical points. A heatmap is
good for overview and weak for reading a single cell. Digits or symbols in cells fix that. Palettes
should not depend on the red-green contrast.

### Encodings beyond colour

WCAG 2.2 success criterion 1.4.1 requires that "Color is not used as the only visual means of
conveying information", and the Understanding document lists "Using color and pattern" (G111) and
giving the same information in text (G14) as techniques. Criterion 1.4.11 asks for a contrast ratio
of at least 3:1 for graphical objects that are required to understand the content; the document
adds that chart parts whose values are also given as text are not required for understanding.
Kim et al. (2021) surveyed 56 papers on visualisation accessibility, focused on blind and low-vision
users, and excluded papers on colour deficiency. They map a design space that includes screen
readers, tactile and audio modalities. For a heatmap it means a structured text equivalent, such as
a table, next to the image.

For Fieldnote this gives a concrete rule: each state has a colour, a symbol or fill pattern, and a
text name in the legend, every cell has an accessible name that includes the date, slot, planned
time and state, and the same data is available as a table.

## What existing platforms state they show

Only what the pages we read say. Absence from the table means we did not find it, not that the
feature does not exist.

| Platform | Adherence or progress view stated | Timeline, calendar or matrix stated |
|---|---|---|
| m-Path | Response rate on each participant's card, sortable; beeps sent, scheduled and days with responses, compared with the week before (Data monitoring, Visualize) | A Visualize page per participant with "beeps", "time" and table views; no calendar or slot matrix described |
| Indeemo | Task Completion view: per-respondent progress per task, upload icons by type, last upload and last reminder | None described on that page; it is a table |
| dscout | Manage page: entries submitted against entries required per activity; statuses Unstarted, In Progress, Min. # of Entries; due dates on hover | Entries grid sortable by date, with filters including participant groups and tags; a map and chart views; no timeline or calendar described |
| Recollective | Response Summary table with Completed, Started, Incomplete and Not Started, and coloured dots per task; the page does not explain the colours | None described |
| ExpiWell | Its blog says the dashboard shows "survey responses and compliance rates as they stream in"; release notes list five chart types (vertical bar, horizontal bar, scatter, table, point-line) | Not described in the pages we read |
| MetricWire | Its page on treatment compliance describes alerts and reminders, not a monitoring view | Not found; its knowledge base pages were not readable |
| movisensXS | The FAQ mentions a "Missing" column in the export for forms not completed | Not found |
| Samply (University of Konstanz) | Per-participant compliance table with a low-compliance flag (default 60%, configurable) | Charts of response rate by hour of day and a retention curve by study day relative to each participant's day 0 |
| Avicenna | A "session status report" with completed, expired and canceled sessions | A calendar by day, week, month or year in which each cell is a session; clicking opens details |

Two of these are close to Fieldnote's design. Avicenna's calendar of sessions with statuses is a
matrix of planned prompts. Samply's two charts show adherence by time of day and by study day, the
two axes of Rintala's results, but separately. We did not find a platform page that describes a
participant's days by slots in one view with a free-entry row, so the combination is plausible but
we cannot say it is new. Recollective's coloured dots without a stated meaning is the failure the
legend decision avoids.

## What we conclude

- The timeline follows the standard recipe (overview, zoom, filter, details) and the team's
  decisions match it. The recipe does not guarantee legibility. The remedies the sources support are
  separate lanes, aggregation that depends on the zoom level, filters, and a rule that every
  aggregate says what it counts.
- Adherence reporting has an accepted structure: a definition, a rate by type of report, the range
  across participants, and patterns by time of day and study day. A per-participant matrix serves
  the last item. By itself it does not give the range across participants.
- The heatmap is a reasonable choice for overview. We found no study that shows it beats two bar
  charts, and the colour evidence says to add symbols and text.
- Two qualifications to the decision. First, the scheduler may vary prompt times between days
  (file 01), so the same "slot" column can mean 08:00 on one day and 15:00 on the next, which hides
  the time-of-day pattern Rintala reports. Second, a prompt the scheduler could not plan, and an
  entry recorded in the window but received late from the offline queue, are not the participant
  missing a prompt. Counting them as missed would blame participants for the system's limits.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Overview first, zoom and filter, then details (Shneiderman, 1996) | Timeline with all lanes at week zoom, zoom to day and hours, four filters, selected entry in a details panel | Adopted |
| Scrolling hides parts of an overview (Plaisant et al., 1996) | Keep a fixed overview of all lanes (a strip of per-participant totals) and show a count of lanes outside the view | Planned |
| Separate rows scale better than shared space (Javed et al., 2010) | One lane per participant on a shared time axis | Adopted |
| Aggregates must stay interpretable (Elmqvist and Fekete, 2010) | At week zoom show a count per slot or day, labelled; marks appear individually from day zoom | Planned |
| Colour coding can mislead (Plaisant et al., 1996) | Entry type shown by colour and symbol; no red or severity colours for participant behaviour | Planned |
| Late arrival from the offline queue (file 01) | Position marks by `recorded_at`; show the `received_at` gap in the details panel and flag entries received long after capture | Planned |
| Define compliance (Trull and Ebner-Priemer, 2020) | Rate = answered prompts divided by prompts already due; excludes future, unplanned and free entries; the denominator is shown ("14 of 18") | Adopted for the portal text, to be written in the requirements |
| Range across participants (Trull and Ebner-Priemer, 2020) | Participant list sortable by adherence, with a researcher-set flag threshold and no default presented as correct | Planned |
| Patterns by day and by time of day (Rintala et al., 2019) | Heatmap of days by slots with the planned time in each cell label; an option to group columns by hour of day | Adopted (labels), future work (grouping) |
| Prompt not planned, or recorded on time and received late | Separate states ("not sent", "answered, received late"), not counted as missed | Planned |
| Colour alone is weak (Han and Nacenta, 2020; WCAG 1.4.1, 1.4.11) | Each state has colour, symbol or pattern and a legend name; 3:1 contrast against neighbours; digits in the free-entry row; a table equivalent | Adopted |
| Participant-facing feedback raised compliance (Hsieh et al., 2008) | Not included; interviewees asked for no points or streaks | Future work |

## Sources

- Crameri, F., Shephard, G. E. and Heron, P. J. (2020). The misuse of colour in science communication.
  *Nature Communications*, 11, 5444. https://doi.org/10.1038/s41467-020-19160-7
- Eisele, G. et al. (2022). See file 01.
- Elmqvist, N. and Fekete, J.-D. (2010). Hierarchical aggregation for information visualization:
  overview, techniques, and design guidelines. *IEEE Transactions on Visualization and Computer
  Graphics*, 16(3), 439-454. https://doi.org/10.1109/TVCG.2009.84 (open copy:
  https://inria.hal.science/hal-00696751)
- Han, H. L. and Nacenta, M. A. (2020). The effect of visual and interactive representations on human
  performance and preference with scalar data fields. *Graphics Interface 2020*.
  https://graphicsinterface.org/wp-content/uploads/gi2020-23.pdf (no DOI found in Crossref)
- Hsieh, G., Li, I., Dey, A., Forlizzi, J. and Hudson, S. E. (2008). Using visualizations to increase
  compliance in experience sampling. *Proceedings of the 10th International Conference on Ubiquitous
  Computing (UbiComp '08)*, 164-167. https://doi.org/10.1145/1409635.1409657
- Javed, W., McDonnel, B. and Elmqvist, N. (2010). Graphical perception of multiple time series.
  *IEEE Transactions on Visualization and Computer Graphics*, 16(6), 927-934.
  https://doi.org/10.1109/TVCG.2010.162
- Jones, A., Remmerswaal, D., Verveer, I., Robinson, E., Franken, I. H. A., Wen, C. K. F. and Field, M.
  (2019). Compliance with ecological momentary assessment protocols in substance users: a
  meta-analysis. *Addiction*, 114(4), 609-619. https://doi.org/10.1111/add.14503
- Kim, N. W., Joyner, S. C., Riegelhuth, A. and Kim, Y. (2021). Accessible visualization: design space,
  opportunities, and challenges. *Computer Graphics Forum*, 40(3), 173-188.
  https://doi.org/10.1111/cgf.14298
- Kraus, M., Angerbauer, K., Buchmuller, J., Schweitzer, D., Keim, D. A., Sedlmair, M. and Fuchs, J.
  (2020). Assessing 2D and 3D heatmaps for comparative analysis: an empirical study. *Proceedings of
  the 2020 CHI Conference on Human Factors in Computing Systems*, 1-14.
  https://doi.org/10.1145/3313831.3376675
- Monroe, M., Lan, R., Lee, H., Plaisant, C. and Shneiderman, B. (2013). Temporal event sequence
  simplification. *IEEE Transactions on Visualization and Computer Graphics*, 19(12), 2227-2236.
  https://doi.org/10.1109/TVCG.2013.200
- Ottenstein, C. and Werner, L. (2022). Compliance in ambulatory assessment studies: investigating
  study and sample characteristics as predictors. *Assessment*, 29(8), 1765-1776.
  https://doi.org/10.1177/10731911211032718
- Plaisant, C., Milash, B., Rose, A., Widoff, S. and Shneiderman, B. (1996). LifeLines: visualizing
  personal histories. *Proceedings of CHI '96*, 221-227. https://doi.org/10.1145/238386.238493
  (read in the technical report version: https://drum.lib.umd.edu/bitstream/1903/440/2/CS-TR-3523.pdf)
- Rintala, A., Wampers, M., Myin-Germeys, I. and Viechtbauer, W. (2019). Response compliance and
  predictors thereof in studies using the experience sampling method. *Psychological Assessment*,
  31(2), 226-235. https://doi.org/10.1037/pas0000662
- Shneiderman, B. (1996). The eyes have it: a task by data type taxonomy for information
  visualizations. *Proceedings of the 1996 IEEE Symposium on Visual Languages*, 336-343.
  https://doi.org/10.1109/VL.1996.545307 (read in the technical report version CS-TR-3665)
- Stone, A. A. and Shiffman, S. (2002). Capturing momentary, self-report data: a proposal for
  reporting guidelines. *Annals of Behavioral Medicine*, 24(3), 236-243.
  https://doi.org/10.1207/S15324796ABM2403_09
- Trull, T. J. and Ebner-Priemer, U. W. (2020). Ambulatory assessment in psychopathology research: a
  review of recommended reporting guidelines and current practices. *Journal of Abnormal
  Psychology*, 129(1), 56-63. https://doi.org/10.1037/abn0000473 (read in the accepted manuscript)
- van Wijk, J. J. and van Selow, E. R. (1999). Cluster and calendar based visualization of time series
  data. *Proceedings of the IEEE Symposium on Information Visualization (InfoVis '99)*, 4-9.
  https://doi.org/10.1109/INFVIS.1999.801851
- Vachon, H. et al. (2019); Wrzus, C. and Neubauer, A. B. (2023). See file 01.
- W3C. Understanding SC 1.4.1: Use of Color; Understanding SC 1.4.11: Non-text Contrast. *Web Content
  Accessibility Guidelines 2.2*. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html,
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Avicenna Research. Monitor participants' past compliance and upcoming survey schedule (forum
  how-to, 10 June 2025). https://forum.avicennaresearch.com/t/monitor-participants-past-compliance-and-upcoming-survey-schedule/1210
- dscout. Manage a diary study; Analyzing your diary study.
  https://help.dscout.com/diary-studies/manage-a-diary-study,
  https://help.dscout.com/diary-studies/analyzing-your-diary-mission
- ExpiWell. What is ecological momentary assessment (EMA)?; Elevate your research: meet our latest
  feature enhancements (26 October 2021, with later entries to May 2025).
  https://expiwell.com/post/what-is-ecological-momentary-assessment,
  https://expiwell.com/post/release-notes-newly-enhanced-features-to-help-improve-the-work-you-do
- Indeemo. Tracking task completion and respondent activity.
  https://help.indeemo.com/moderator-resources/tracking-task-completion-and-respondent-activity
- m-Path. Data monitoring (updated 10 March 2025); Visualize.
  https://m-path.io/manual/knowledge-base/data-monitoring/,
  https://m-path.io/manual/knowledge-base/visualize/
- MetricWire. Treatment compliance. https://metricwire.com/portfolio/treatment-compliance/
- movisens. movisensXS FAQ. https://docs.movisens.com/movisensXS/faq/
- Recollective. Tracking participant progress. https://helpdesk.recollective.com/article/181-tracking-participant-progress
- Samply, University of Konstanz. Analytics. https://samply.uni-konstanz.de/docs/analytics

All sources accessed in October 2026.

## Limits

- Read in the parts that answer the question: Shneiderman (abstract, mantra, data types and tasks, in
  the technical report), Plaisant et al. (abstract, introduction, complex records, user feedback, in
  the technical report), Elmqvist and Fekete (abstract and design guidelines), Monroe et al.
  (abstract, introduction, Figure 1), Javed et al. (abstract and introduction), van Wijk and van
  Selow (abstract and introduction), Kraus et al. and Han and Nacenta (abstract and introduction),
  Trull and Ebner-Priemer (the compliance section), Crameri et al. (abstract and the passage on
  colour-vision deficiency), Kim et al. (abstract and method, author copy) and Hsieh et al.
  (abstract and introduction).
- Read as abstracts only: Stone and Shiffman (2002), Jones et al. (2019), Ottenstein and Werner
  (2022), Rintala et al. (2019), all through PubMed. The figures above come from those abstracts, and
  how compliance was measured in each was not checked. Wrzus and Neubauer, Eisele et al. and Vachon
  et al. are used only as reported in file 01.
- The LifeLines and Shneiderman papers were read as University of Maryland technical reports with the
  same titles as the published versions; page numbers and wording may differ slightly.
- Platform pages were read through a page-summarising fetch tool, except m-Path, whose two pages were
  read as raw text. Quotations from other platform pages and from the WCAG pages come from that tool
  and should be checked against the live page before they are reused in a report. No product was
  tested, and no platform has a public statement of what it does not show.
- MetricWire's knowledge base pages returned errors, ExpiWell's own help centre was not found, and
  movisensXS documentation was read only on one page. Samply and Avicenna are not in file 03.
- The evidence on timelines and heatmaps is about line charts, medical records and continuous values.
  We found no study of event timelines of diary entries or of adherence matrices in experience
  sampling, so the transfer is by analogy and the team's choices have not been tested with users.
- Fieldnote has no working portal yet. A usability test of both displays with researchers is the way to
  check legibility, and is not promised (file 09).
