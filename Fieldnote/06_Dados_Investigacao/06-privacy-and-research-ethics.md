# Privacy and research ethics

## Question

What European data protection law and research ethics ask of a platform that stores diary entries,
photos, voices and locations of people; which risks are specific to participant-captured media;
and where Fieldnote's design meets these demands, where it goes beyond them, and where it cannot
help. This file supports the Information Security course and the data model.

## Why this matters for Fieldnote

A diary study collects more personal data than most applications: what people do, where, with
whom, in their own words and images, several times a day for weeks. File 00 argues that a research
unit would choose a self-hosted platform partly to keep this data under its control. That argument
only holds if the platform's design makes protection the default.

## What the law asks

### Diary data is personal data, and sometimes special category data

Entries are linked to a participant, and photos, voice recordings and locations identify people
even without a name. Depending on the study, entries can also reveal data the General Data
Protection Regulation (GDPR) protects more strictly under Article 9, such as health, religious
beliefs or sexual orientation. A study on daily eating habits or on visiting places of worship
would be in that category without asking about it directly.

### The provisions that shape the design

| Provision | What it requires | How Fieldnote answers |
|---|---|---|
| Article 5(1)(c), data minimisation | Personal data must be "adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed" | Location is off unless an activity asks for it; GPS metadata is removed from photos otherwise; participants have no email or password in the platform |
| Article 4(5), pseudonymisation | Processing so that data "can no longer be attributed to a specific data subject without the use of additional information", kept separately and protected | Researchers will see aliases; name and email will live in a separate table (`participant_identity`), with restricted and audited access |
| Article 9, special categories | Processing is prohibited unless an exception applies; scientific research is one, under the safeguards of Article 89(1) | The platform cannot know whether a study touches these categories; the researcher's protocol must. The platform provides the safeguards (pseudonymisation, access control, audit) |
| Article 17, right to erasure | People can ask for their data to be deleted, with exceptions, including for research when erasure would make the research impossible or seriously impair it | The design includes erasure of identity, entries and every copy of the files. A request that reaches the team is granted or not by the research team; an erasure started by the participant in the app is carried out automatically after 7 days |
| Article 89(1), research safeguards | Research processing needs technical and organisational measures, in particular data minimisation, and pseudonymisation where it allows the purpose to be met | The design follows this order: aliases by default, identity only where needed |

The European Data Protection Board's guidelines on pseudonymisation (01/2025) stress that
pseudonymised data remains personal data as long as the additional information exists. In
Fieldnote that additional information is the identity table. Protecting the entries is not enough;
the identity table is the most sensitive table in the database.

### Two points that change the design

**Consent under the GDPR and consent in research ethics are different things.** Fieldnote records
which version of the informed consent each participant accepted and when. In research ethics,
informed consent is always required. Under the GDPR, consent is only one of the possible legal
bases for processing, and a university may rely on another (such as a task in the public interest)
for research. The platform records the participant's informed consent as research ethics requires;
it does not decide the legal basis, which belongs to the study's data management plan.

**Erasure is not absolute for research.** We designed erasure as a feature every participant can
trigger, in the app (UC20) or through the researcher. Article 17 includes an exception for research. Fieldnote is
designed to be able to erase completely, and leaves the policy to the research team and its ethics
approval. The audit log records every erasure, with who requested it and when.

## Risks specific to participant-captured media

### Images are harder to anonymise than words

Clark, Prosser and Wiles (2010) review the ethics of image-based research:

> "The paper discusses informed consent, anonymity and confidentiality, specifically in relation to
> how they may differ in image-based compared to word-based research." (abstract)

A transcript can be pseudonymised by replacing names. A photo of a face, a house or a street sign
cannot be pseudonymised by changing a field in the database. The authors argue for "a situated
approach to image-based ethics" (abstract) that considers each concrete situation, which a platform
cannot do on its own.

### People who did not agree to be recorded

When participants photograph or film their surroundings, other people appear in them. Wang and
Redwood-Jones (2001), writing about photovoice projects in which community members photographed
their lives, discuss "the potential for invasion of privacy and how that may be prevented"
(abstract). The bystander in a diary photo did not join the study, did not accept any consent form
and usually does not know the photo exists.

We searched for studies about bystanders specifically in smartphone diary studies and found none.
The closest work is on wearable lifelogging cameras, which record continuously and are a different
case. This is a gap in what we found, not proof that the problem has not been studied.

### Location identifies people even without a name

de Montjoye et al. (2013) analysed 15 months of mobility data for 1.5 million people, with location
known at the level of mobile network antennas, every hour:

> "four spatio-temporal points are enough to uniquely identify 95% of the individuals." (abstract)

They also show that coarser data gives little additional anonymity. Their data came from mobile
operators, not from diaries, so the numbers do not transfer directly. The principle may: a
participant who records several entries with location, under an alias, could be identified by
someone who knows where they live and work. The study does not tell us how many diary entries that
takes, but an alias does not make location data anonymous.

### Is ethical review an obstacle?

Visual methods raise questions that ethics committees ask about. Wiles et al. (2012) interviewed UK
visual researchers about ethical review and found that

> "Researchers only rarely identified significant barriers to conducting visual research from
> ethical approval processes" (abstract)

although review sometimes led to "subtle but significant self-censorship in the dissemination of
findings" (abstract). For a research unit, a platform that makes the committee's questions easy to
answer (where data is, who sees it, how long it is kept, how it is erased) reduces friction.

## Critical reading of the design

Reading the sources above showed four weaknesses in our design:

1. **EXIF removal protects location only.** Removing GPS metadata from photos was presented as the
   privacy measure for media. It does nothing for faces, voices, documents or house numbers in the
   picture.
2. **The export can undo pseudonymisation.** Exports leave identity out by default, but an export
   with photos and locations can identify participants without any name. Exports were already
   audited; the default content of an export was not discussed.
3. **The identity table is the real target.** If it leaks, every alias becomes a person. It was
   described as "separate"; it needs to be the most protected table, not just a separate one.
4. **Erasure and backups.** Daily backups are kept for 7 days. Data erased by the team
   remains in up to 7 daily backups until they expire; data erased from the app is left out of the backups from the request (NFR-44). We accept this because backups have to
   exist, and it must be stated to participants before they join.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Data minimisation (Article 5(1)(c)) | Location off by default per activity; EXIF removed when location is not asked; no participant password, and no email unless the person chooses the email sign-in (stored encrypted, NFR-76) | Adopted |
| Pseudonymised data is still personal data (EDPB 01/2025) | `participant_identity` readable only by the study owner and administrators; every read is written to the audit log | Adopted, in the security design |
| Location identifies people (de Montjoye et al., 2013) | Exports leave location out by default; the researcher includes it explicitly, and the choice is audited | Adopted |
| Images cannot be pseudonymised by the platform (Clark et al., 2010) | Exports leave media files out by default; including them is an explicit, audited choice | Adopted |
| Bystanders (Wang and Redwood-Jones, 2001) | Activities show the researcher's instruction on whom not to photograph; the consent text explains it; automatic face blurring in exports is future work | Instruction adopted; blurring is future work |
| GDPR consent is not research consent | The platform records informed consent with its version; the legal basis is documented by the study, not by the platform | Adopted, documented |
| Erasure has a research exception (Article 17) | Erasure is an administrator action or, from the app, a participant action (NFR-70), always logged; for requests that reach the team the policy is the research team's | Adopted |
| Backups keep data erased by the team for up to 7 days; data erased from the app is left out of the backups from the request, so none remains on the erasure date | Stated in the security document; planned for the consent text | Adopted |
| Ethics review of visual methods is manageable (Wiles et al., 2012) | A one-page data protection summary for ethics committees (where data is, who sees it, retention, erasure) is part of the documentation | Planned for the final delivery |

### What the course project does not do

- The demonstration uses generated data and the team's own test entries. No personal data of real
  participants is processed during the course.
- No study is submitted to an ethics committee. The documentation describes what one would need.
- This file is a design analysis by computer engineering students, not legal advice.

## Sources

- Clark, A., Prosser, J. and Wiles, R. (2010). Ethical issues in image-based research. *Arts &
  Health*, 2(1), 81-93. https://doi.org/10.1080/17533010903495298
- de Montjoye, Y.-A., Hidalgo, C. A., Verleysen, M. and Blondel, V. D. (2013). Unique in the crowd:
  the privacy bounds of human mobility. *Scientific Reports*, 3, 1376.
  https://doi.org/10.1038/srep01376
- European Data Protection Board (2025). Guidelines 01/2025 on pseudonymisation.
  https://www.edpb.europa.eu/system/files/2025-01/edpb_guidelines_202501_pseudonymisation_en.pdf
- Regulation (EU) 2016/679 (General Data Protection Regulation), Articles 4, 5, 9, 17 and 89.
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Wang, C. C. and Redwood-Jones, Y. A. (2001). Photovoice ethics: perspectives from Flint
  Photovoice. *Health Education & Behavior*, 28(5), 560-572.
  https://doi.org/10.1177/109019810102800504
- Wiles, R., Coffey, A., Robison, J. and Prosser, J. (2012). Ethical regulation and visual methods:
  making visual research impossible or developing good practice? *Sociological Research Online*,
  17(1), 3-12. https://doi.org/10.5153/sro.2274

All sources accessed in September 2026.

## Limits

- For the academic sources we read the parts relevant to this file, and nothing is attributed to
  them beyond those parts. Specific procedures from Wang and Redwood-Jones (2001) are not used.
- The GDPR articles are summarised for design purposes. Their application to a real study depends
  on the legal basis, the controller and national law, which are outside the scope of the project.
- We found no study on bystanders in smartphone diary photos; the bystander measures are reasoned,
  not evidence-based.
