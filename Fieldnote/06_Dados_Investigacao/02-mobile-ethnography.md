# Mobile ethnography

## Question

What "mobile ethnography" means, how it relates to diary studies, what changes when participants
capture photos, audio and video themselves, and how far the method is established. The answer
decides which entry types Fieldnote offers, how media is handled, and how the project describes
the method without overstating it.

## Why this matters for Fieldnote

Proposal 11 puts mobile ethnography in its title. The term sounds precise, but the literature
shows it is not, and a computer engineering project that presents it as a settled method would be
easy to criticise. The media side matters for the architecture: photos, audio and video are the
heaviest load on the system and the main reason for object storage, a media worker and signed
upload URLs.

## What the term covers

### From ethnography to mobile methods

Classic ethnography places the researcher in the setting, observing over a long period and writing
field notes, which is where the project's name comes from. Two things change when the method
becomes "mobile".

The first is that people are studied while they move. Hein, Evans and Jones (2008) review this
line of work in geography, built on the "mobilities" turn in the social sciences. Their focus is on

> "methods where the research subject and researcher are in motion" (abstract)

and they "seek to understand what difference mobile methods can make to research" (abstract), with
examples such as walking interviews and GIS.

This is not quite what Fieldnote does. In Hein et al.'s mobile methods the researcher usually moves
with the participant. In a Fieldnote study the researcher is absent: participants document their
own experience and send it. We cite Hein et al. for the general argument that methods should follow
people where they are, not as a description of our kind of study.

The second change is that participants do part of the observation themselves, with their own
phones. This is the sense in which tourism and service research uses the term.

### Mobile ethnography as participant self-documentation

Muskat, Muskat, Zehrer and Johns (2013) used mobile ethnography to evaluate a museum visit:

> "Mobile ethnography is applied to the National Museum of Australia in Canberra with a sample of
> Generation Y visitors" (abstract)

Visitors acted as active investigators of their own experience, using a mobile ethnography tool
(MyServiceFellow). The authors argue that this kind of data should involve museum
management in service design. They are also clear about its weight:

> "The most significant limitation is the exploratory nature of the single case study derived from
> a small sample within only one museum." (abstract)

Five years later, the same group reviewed how the term was being used in tourism, health and
retail. Their diagnosis:

> "studies reveal a lack of coherent definition and inconsistencies in validity criteria"
> (Muskat, Muskat and Zehrer, 2018, abstract)

They propose a qualitative, interpretive framing with four dimensions (the researcher's role, the
focus of the research, data collection and tools, and data analysis), in which researchers
"co-create knowledge with their participants" (abstract).

### How it relates to diary studies

In practice a mobile ethnography study and a diary study with media are run the same way: a
researcher defines what to record, participants record it over days or weeks, the researcher
follows the entries as they arrive. The difference is in the stance. A diary study in the
psychology tradition (file 01) treats entries as measurements. Mobile ethnography, in Muskat et
al.'s framing, treats them as material the researcher interprets, ideally with the participant.

## Critical reading

**The method is not settled, and that is the authors' own conclusion.** The strongest sources we
found for mobile ethnography are a single-site exploratory study and a framework paper that starts
from the absence of a coherent definition. This contrasts with diary methods and ESM, which have
decades of validation work and meta-analyses (file 01). We draw two conclusions:

1. Fieldnote is a tool for a family of methods. It does not define the method. The researcher
   decides what counts as valid data, how to interpret it and whether to discuss it with
   participants. The platform's documentation describes what the software does (activities,
   entries, media, tags, export) and leaves methodology to the researcher.
2. Validity criteria are the researcher's problem, but some of them depend on evidence the
   platform keeps: when an entry was recorded and when it was received, and which prompt it
   answered. Fieldnote keeps those so that a researcher who needs them can use them. Entries cannot
   be edited in the current design, which makes this evidence simpler to keep.

**"Ethnography" without the ethnographer can be questioned.** A participant photographing their
own kitchen is not the same as a researcher spending months in a household. Fieldnote does not
claim to replace fieldwork. It gives researchers access to moments they cannot be present for:
early mornings, commutes, private spaces, a two-week period across many participants at once.

## Participant-captured media

### Media changes what people record and remember

Carter and Mankoff (2005) designed three diary studies around different capture media:
photographs, audio recordings, location information and tangible artefacts. They start from a
property of the diary study:

> "The diary study is a method of understanding participant behavior and intent in situ that
> minimizes the effects of observers on participants." (abstract)

and ask how media affect it:

> "How do context information and episodic memory prompts captured by participants vary with
> media?" (abstract)

The abstract describes what the paper produced: modified diary techniques that let participants
annotate and review what they captured, and a lightweight tool for digital capture. We use the
paper for the questions it raises and for that design idea, not for specific results.

### Text dominated when people were asked to capture in the moment

Brandt, Weiss and Klemmer (2007) ran two two-week studies in which participants could send text,
pictures or voice. Two results are directly relevant:

> "when full in situ entries were required in Study 1, only one entry (out of 122) used a media
> other than written text." (Results)

> "participants usually had a strong preference for one type of media." (Results)

One third of the participants used a single medium throughout; five used only text and two only
audio. Audio felt awkward when other people were around. Photo use was low, which the authors
link to phone cameras of the time.

**Our reading.** The study is small (15 participants recruited for each study) and from 2007, when
phone cameras and data plans were very different. The photo result has probably aged. The other two
results probably have not: recording audio in public is still awkward, and people still have a
preferred way of expressing themselves.

### Voice as a convenience medium

Palen and Salzman (2002) used voicemail for diary entries, because

> "Mobile technology requires new methods for studying its use under realistic conditions "in the
> field."" (abstract)

Their choice of voice was about convenience: a phone call was the easiest way to capture an entry
on the move in 2002. Today, a voice note in an app plays the same role.

### Diaries at a distance, at scale

A recent example shows the scale qualitative diaries can reach. Mueller et al. (2023) describe

> "a study with 100 young diarists (aged 15–29) who produced 1418 diary entries over 4 months"
> (abstract)

in a disaster context, and reflect on inclusive design, supporting vulnerable participants, data
quality, data management and budgeting. That is about 14 entries per diarist (our arithmetic).
The abstract does not say whether entries were made in an app, so we use it only as evidence that
qualitative diary studies raise data-management questions at this size.

## What media costs the platform

| Medium | What it adds for the researcher | Cost for the platform |
|---|---|---|
| Text | Reflection in the participant's own words; easy to analyse and search | Small, stored in the database |
| Photo | What the participant sees, with little effort | A few MB per photo from a current phone; may contain GPS coordinates in its EXIF metadata |
| Audio | Tone and spontaneous description, hands free | Roughly 1 MB per minute, depending on the codec |
| Video | Movement, sequence and setting | Tens of MB per minute; phones record in different formats, so conversion is needed for every video to play in the dashboard |
| Scale, multiple choice | Comparable answers across participants and days | Negligible |
| Location and time | Context without asking a question | Small in bytes, high in privacy risk (file 06) |

The sizes are orders of magnitude for typical phone recordings, not measurements made by the
project.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| The term mobile ethnography has no coherent definition (Muskat et al., 2018) | Fieldnote is described as a tool for diary studies and mobile ethnography; it does not define or validate the method | Adopted, in all documents |
| Researchers interpret entries, ideally with participants | Tags on entries in the dashboard; export with participant alias, activity, prompt and both timestamps (file 01). Follow-up questions to a participant about one entry are listed as future work | Tags adopted; follow-up is future work |
| Media changes what is captured (Carter and Mankoff, 2005) | Six entry types: text, photo, video, audio, scale, choice | Adopted |
| Participants prefer one medium; audio is awkward in public (Brandt et al., 2007) | An activity can accept more than one entry type, so the participant chooses (for example "photo or text") | Adopted, changes the activity definition in the data model |
| Video is heavy and comes in many formats | Video limited to 2 minutes per entry; files go straight to object storage through signed URLs; the media worker converts them to H.264 MP4 and creates thumbnails | Adopted, in the architecture |
| Photos carry hidden location | The media worker removes EXIF metadata when the activity does not ask for location | Adopted, in the security design |
| Review and annotation of captured media by the participant (Carter and Mankoff, 2005) | Participant adds a reflection to an earlier entry | Future work, together with completing an entry later (file 01) |
| Qualitative diaries at scale raise data-management issues (Mueller et al., 2023) | Pseudonymous participants, export without identity by default, erasure (file 06) | Adopted |

The decision to let an activity accept several entry types, instead of one type per activity, is
a direct result of this research. Brandt et al.'s finding that
people stick to their preferred medium suggests that a study asking only for audio may lose the
participants who will not speak to their phone in public. Brandt et al. had 15 participants per
study, so this is a reason for the design, not a measured effect.

## Sources

- Brandt, J., Weiss, N. and Klemmer, S. R. (2007). txt 4 l8r: lowering the burden for diary studies
  under mobile conditions. *CHI '07 Extended Abstracts on Human Factors in Computing Systems*,
  2303-2308. https://doi.org/10.1145/1240866.1240998 (author copy:
  https://hci.stanford.edu/cstr/reports/2007-01.pdf)
- Carter, S. and Mankoff, J. (2005). When participants do the capturing: the role of media in diary
  studies. *Proceedings of CHI 2005*, 899-908. https://doi.org/10.1145/1054972.1055098
- Hein, J. R., Evans, J. and Jones, P. (2008). Mobile methodologies: theory, technology and
  practice. *Geography Compass*, 2(5), 1266-1285. https://doi.org/10.1111/j.1749-8198.2008.00139.x
- Mueller, G., Barford, A., Osborne, H., Pradhan, K., Proefke, R., Shrestha, S. and Pratiwi, A. M.
  (2023). Disaster diaries: qualitative research at a distance. *International Journal of
  Qualitative Methods*, 22. https://doi.org/10.1177/16094069221147163
- Muskat, B., Muskat, M. and Zehrer, A. (2018). Qualitative interpretive mobile ethnography.
  *Anatolia*, 29(1), 98-107. https://doi.org/10.1080/13032917.2017.1396482
- Muskat, M., Muskat, B., Zehrer, A. and Johns, R. (2013). Generation Y: evaluating services
  experiences through mobile ethnography. *Tourism Review*, 68(3), 55-71.
  https://doi.org/10.1108/TR-02-2013-0007
- Palen, L. and Salzman, M. (2002). Voice-mail diary studies for naturalistic data capture under
  mobile conditions. *Proceedings of CSCW 2002*, 87-95. https://doi.org/10.1145/587078.587092

All sources accessed in September 2026.

## Limits

- For each paper we read the parts relevant to this file: the abstract, and for Brandt et al.
  (2007) also the methods and results. Nothing is attributed to a paper beyond the parts we read;
  detailed results of Carter and Mankoff (2005) and Mueller et al. (2023) are not used.
- Muskat et al. (2018) appeared online in 2017; it is cited with its 2018 volume.
- This file covers the mobile, participant-captured side of ethnography that Fieldnote supports.
  The classic ethnography methods books (for example Hammersley and Atkinson, or Pink on sensory and
  digital ethnography) are outside its scope and are not cited.
- The media sizes are orders of magnitude, not measurements.
