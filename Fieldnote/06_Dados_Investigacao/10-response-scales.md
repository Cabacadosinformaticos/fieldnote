# Response scales

## Question

What the measurement literature says about rating scales: what Stevens' levels of measurement let an analyst do with a rating, how many points a scale needs, whether faces, sliders or numbered buttons suit participants better, how the options should be laid out on a phone, and what a platform must store so that the analyst can choose the analysis. The file follows up what the interviewees said (file 09): a lecturer's remark that scales are a complicated subject with no ideal scale, the paper by Stevens (1946) that the lecturer gave the team, and the request of three of four interviewees for faces instead of numbers, for older participants.

## Why this matters for Fieldnote

The team decided that the researcher chooses the scale type per activity: numbers with 2 to 11 points, faces with 3 or 5, text labels, or a slider from 0 to 100. The app shows the options as a vertical list of large buttons, all visible. A scroll wheel was rejected because it hides the ends of the scale. The export states the scale type and the number of points. This file checks those decisions against published work. Most of that work concerns adults answering questionnaires, children and patients rating pain, or students in web surveys. Little of it concerns older adults answering one item on a phone in daily life, which is Fieldnote's case.

## Levels of measurement

Stevens (1946) defines measurement as assigning numerals to objects or events according to rules, and sorts the rules into four scale types. Each type is defined by the transformations that leave it unchanged, and these decide which statistics are meaningful.

| Type | Operation | Statistics Stevens lists |
|---|---|---|
| Nominal | Determine equality | Number of cases, mode, contingency correlation |
| Ordinal | Determine greater or less | Median, percentiles |
| Interval | Determine equality of intervals | Mean, standard deviation, rank-order and product-moment correlation |
| Ratio | Determine equality of ratios | Coefficient of variation |

The list is cumulative: a statistic valid for a lower type is valid for a higher one. For rating items the relevant passage is Stevens' own hedge. He observes that "most of the scales used widely and effectively by psychologists are ordinal scales" (p. 679). Means and standard deviations on such scales are strictly improper and are in error to the extent that the intervals are unequal, but he would not outlaw the practice, because it often gives fruitful results. A rating item is therefore an ordinal scale that may aspire to be interval. The digits 1 to 5 are codes for ranked answers, not measurements.

### The debate on Likert-type items

- **Strict side.** Jamieson (2004), a short commentary, holds that Likert-type categories are ordinal, that the intervals between them cannot be presumed equal, and that medians, modes and non-parametric tests are the proper tools. Averaging two verbal answers, she argues, does not give a meaningful half-way answer.
- **Pragmatic side.** Norman (2010) argues that studies back to the 1930s show parametric methods to be robust to small samples, non-normal data and ordinal scales. Sullivan and Artino (2013) agree that parametric tests can be used, but add that a frequency distribution usually describes Likert data better than a mean.
- **A warning.** Liddell and Kruschke (2018) found that every article in three leading psychology journals that mentioned Likert scales and analysed ordinal data used a metric model. They show that this can produce false alarms, missed effects and reversed orderings of group means, and recommend ordered-probit models.

These positions are less opposed than they look: Norman is about the robustness of tests in general, Liddell and Kruschke about conditions where a metric model misleads. We cannot adjudicate, and Fieldnote does not need to. **The platform records the data so that either analysis is possible and claims neither.**

### What the platform should record

Because the permitted statistics depend on the scale type, the export must state it. The anchors matter too: Hjermstad et al. (2011) found 24 different descriptors anchoring the ends of pain scales in 54 studies (15 on numeric scales), and say it still needs testing whether this changes scores. The labels must therefore travel with the data. For each answer the export holds the scale type, the number of points, the position chosen as an integer, the text of every label as shown and its language, the direction of the list, and the face set and version if faces were used. For a slider it holds the raw integer 0 to 100 and whether the participant touched the slider. It contains no computed means and no claim about the level of measurement.

## How many points

Three studies bear on this, all with students or simulated data, and all about stable traits or past experiences, not momentary states.

Preston and Colman (2000) had 149 respondents, 134 of them undergraduates, rate a store or restaurant on paper scales with 2 to 11 categories and on a written 0 to 100 scale. The 2-, 3- and 4-point scales had the lowest reliability, validity and discriminating power. Scores were most reliable with 7 to 10 points, and test-retest reliability tended to fall beyond 10. Respondents found short scales quick but poor for expressing feelings, and found the 11- and 101-point scales hardest. The 10-point scale was preferred overall, then 7 and 9. The authors note that under time pressure 5 or even 3 points may be acceptable.

Lozano, Garcia-Cueto and Muniz (2008) simulated responses and found an optimum of 4 to 7 options, with almost no gain beyond 7. Simms et al. (2019) gave 1,358 undergraduates a personality questionnaire with 2 to 11 options or a visual analogue format. Precision was lower for 2 to 5 options, and nothing was gained beyond 6, visual analogue included. Criterion validity did not follow that pattern.

The studies agree that fewer than 4 points loses information and that more than 7 adds little. They differ on 5, which Preston and Colman find less justified than 7 and Simms et al. find less precise. Preference also varies: Preston and Colman rated 11 points among the hardest, while Toepoel and Funke (2018) found 11-point scales evaluated more positively than shorter ones. Fieldnote offers 2 to 11 points without a default, as decided. A 3-point faces scale falls in the zone these studies call weak, so the portal should say so.

## Labels and the middle point

The evidence does not settle odd versus even. Nadler, Weston and Voyles (2015) asked what a midpoint means and got many answers, among them no opinion, unsure, neutral and neither; "neither" was chosen more often than a separate "no opinion" option. The choice depends on the construct.

The evidence on numbers without words is clearer. Menold (2020) found in an eye-tracking and split-ballot study that respondents needed more fixations and time with numeric labels, and that reliability was lower. Gummer and Kunz (2021) found that numeric-only labels pushed answers toward the endpoints and did not shorten response time. **This qualifies the team's decision: a numbered scale should carry words at least at both ends.** Text labels are the safer format, and the numeric option should require end labels from the researcher.

## Faces and pictorial scales

### Where the evidence comes from

Faces scales were built mostly for children rating pain. Tomlinson et al. (2010) reviewed 127 studies of the four best-tested scales and found all adequately supported. Children preferred the Wong-Baker scale, but its smiling and crying anchors confound pain with affect. Hicks et al. (2001) used psychophysical methods to choose faces at equal intervals for the revised scale and report a correlation of 0.93 with a visual analogue scale in 76 children. That is a scale built to approximate interval level, which shows Stevens' question can be answered by design. The Smileyometer shows a weakness: in the review by Read and Horton (2025), about 60 percent of children in one study chose the top face before and after an activity, and over 40 percent of younger children graded everything the same, against under 10 percent of older ones.

### Older participants

The evidence is mixed, and almost all of it is about pain.

- Herr et al. (2004) compared five scales in 86 younger and 89 older adults under experimental heat. All discriminated levels of pain. The numeric scale was most preferred in both age groups, and a verbal descriptor scale, with words, was the most sensitive and reliable. Failures were rare except on the vertical visual analogue scale, linked to cognitive and psychomotor impairment, not age.
- Taylor and Herr (2003) studied 57 volunteers aged 58 and over, mostly with some cognitive impairment. All could use every scale, and both groups preferred the faces scale.
- Pautex et al. (2006) tested 129 patients with severe dementia. Sixty-one percent understood at least one scale, and comprehension was better for the verbal and faces scales than for the third scale, a horizontal visual analogue scale.
- In a satisfaction survey of 3,122 elders, Castle and Engberg (2004) found a four-face format the least liked (5 percent preferred it) and a 10-item visual analogue format the most liked (39 percent). The abstract does not describe the faces.

Faces seem to help where comprehension is the problem, as in cognitive impairment. For cognitively intact older adults numbers and words work well, and one large survey disliked faces. **The interviewees' request is plausible, but the literature does not show that faces are easier for older participants in general.** This supports letting the researcher choose and not making faces the default.

### Risks

- **Middle faces.** A neutral face invites many readings, as the midpoint results above suggest. Faces also carry feeling, so they would sit oddly on an item such as how crowded a place was (our inference from the confound Tomlinson et al. report).
- **Culture.** Jack et al. (2012) had 30 Western and Eastern participants reconstruct the facial movements they associate with six basic emotions. Western representations were distinct and shared within the group, and Eastern ones were not, which the authors take as evidence that expressions are not culturally universal.
- **Rendering.** Miller et al. (2016) found that people disagreed on whether the same emoji was positive, neutral or negative 25 percent of the time, and more across phone platforms. System emoji look different on every phone, so Fieldnote should draw its own faces.
- **Colour.** Tourangeau, Couper and Conrad (2007) found that shading the two ends of a scale in different hues shifted answers toward the high end. The buttons should carry no red-to-green coding.

Pictorial instruments for pleasure and arousal exist, such as the Self-Assessment Manikin and the Affect Grid. They measure two or more dimensions and need instruction, so they are future work. We read neither beyond its abstract and do not cite them.

## Sliders and visual analogue scales

Recent results for continuous scales are positive. Funke and Reips (2012) found that web scales with 250 steps gave better data quality than 5-point scales, with no side effects. In experience sampling, Haslbeck et al. (2025) randomly assigned students (mean age about 22) to a vertical 7-point scale with labelled ends or a 0 to 100 slider, six prompts a day for 14 days. The slider gave higher means, less skew, fewer exact zeros and correlations with symptom scales 44 to 147 percent larger, with no difference in missing data or response time. The authors call this preliminary. Cloos et al. (2025) asked 3,761 adults (mean age 47) in a 30-day study to enter 31 on a slider and got a mean of 31.01 (SD 3.28). Sullivan and Artino (2013) add that computer-based continuous scales can give interval responses; we did not assess that claim.

The evidence against is also solid, and stronger for some groups. Couper et al. (2006) found no difference in distributions but more missing data and longer completion times with sliders. Funke, Reips and Thomas (2011) found much higher break-off with Java sliders (odds ratio 6.9), especially for less educated participants. Toepoel and Funke (2018) found more nonresponse and lower means with sliders than with buttons. Hjermstad et al. (2011) found that numeric scales had better compliance than visual or verbal scales in 15 of 19 studies reporting it. Liu and Conrad (2019) show that the starting position of the handle matters: with 101 points, handles preset at 25, 50, 75 or 100 attracted answers, while with 7 or 21 points the default made no consistent difference.

The studies differ in technology, sample and device. Older sliders were clumsier, and the positive experience sampling results come from students and adults on current phones, not from older participants with limited dexterity. **Fieldnote offers the slider as one option, never as the default. The handle appears only when the participant touches the scale, and the export records whether it was touched.**

## Layout and presentation on screens

- **Visible versus hidden options.** Couper et al. (2004) compared radio buttons, a closed drop box and a scrollable box, and found that visible options were chosen more often, an effect that looked stronger than primacy. Galesic et al. (2008) tracked eyes in a web survey: people looked longest at the first options and were reluctant to attend to initially hidden ones. We found no peer-reviewed experiment on scroll wheels, so the rejection of the wheel rests on this indirect but consistent evidence.
- **Vertical versus horizontal.** Funke et al. (2011) saw no effect of orientation on data quality. Hohne and Lenzner (2015), with eye tracking in 84 people, found response order effects small but more likely in vertical than horizontal scales, and that respondents do not read every category. A vertical list therefore carries a small primacy risk, which the visibility gain on a narrow screen probably outweighs.
- **Visual cues.** Tourangeau, Couper and Conrad (2004) found that respondents read the visual midpoint of a scale as the typical answer, expect a progression from the top or left, and answer faster when the order is logical. Equal spacing, a fixed direction and a "no answer" option kept apart from the scale follow from this.
- **A limit of our own design.** Eleven large buttons may not fit on a small phone screen. If the list scrolls, the ends are hidden, which is the reason the wheel was rejected. We have not measured this. The 11-point case needs a test on a narrow screen and a rule such as smaller buttons for long scales.

## Single-item mood in experience sampling

Experience sampling often measures momentary affect with one item per emotion to keep burden low. Dejonckheere et al. (2022) point out that single items prevent a reliability check. In two empirical studies they estimated the measurement error at nearly a tenth of the scale, about 27 percent of the variability in participants' answers, and recommend repeating an item within a survey to estimate it. Wilhelm and Schoebi (2007) tested a six-item mood scale with 187 participants four times a day for seven days; it had three factors (calmness, valence, energetic arousal), and two-item scales were reliable and sensitive to change. Because the scale type is set per activity, a researcher can ask two related items as two activities.

## What we conclude

- A rating is at most ordinal, with an interval reading that some analysts accept. The platform should record the scale precisely and leave the analysis to the researcher.
- Fewer than 4 points loses information, and more than 7 adds little. The right number depends on the construct and the participant, so the choice stays with the researcher.
- Words matter. Numbers alone perform worse than numbers with verbal anchors.
- Faces are well supported for children's pain and for people with cognitive impairment. Evidence that they are easier for older adults in general is thin, and one large survey found them the least liked. They carry feeling, culture and rendering risks.
- Sliders are promising in recent experience sampling work and weaker in older web studies, worst for less educated participants. They should not be the default.
- All options visible is supported. Vertical lists carry a small primacy risk. Long scales on small screens are unresolved.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Permitted statistics depend on the scale type (Stevens, 1946) | The export states the scale type and the number of points | Adopted |
| The ordinal versus interval debate is unresolved | The export stores the integer position, label text, language and direction. It computes no means and claims no level of measurement | Planned |
| Fewer than 4 points is weak; more than 7 adds little | The researcher chooses 2 to 11 points with no default. The portal notes that 2 to 3 points is coarse | Adopted for 2 to 11 points, planned for the note |
| Numeric-only labels perform worse than labelled ones | Numeric scales require end labels written by the researcher. Text labels remain an option | Planned |
| Faces help some groups; evidence for older adults is mixed | The researcher chooses faces with 3 or 5 points. They are not the default | Adopted |
| Faces carry affect, culture and rendering risks | Fieldnote draws its own faces in one neutral colour. The export stores the face set, version and position, not an emotion word | Planned |
| Slider results depend on sample and device | A 0 to 100 slider is available, with no preset handle. The export stores the raw value and whether it was touched | Adopted for the slider, planned for the handle |
| Visible options are chosen more often | A vertical list of large buttons with every option visible, and no scroll wheel | Adopted |
| Eleven buttons may not fit on a small screen | Test the 11-point scale at narrow widths and decide a size rule | Planned |
| Order and visual midpoint affect answers | Equal spacing and a fixed direction per activity, stored in the export. "No answer" is kept apart from the scale | Planned |
| Single items cannot be checked for reliability | Two related items are possible as two activities. A repeated-item check is not in the design | Future work |
| Pleasure and arousal need two or more dimensions | Not in the design | Future work |

## Sources

All sources accessed in October 2026. The note in brackets says whether the full text or only the abstract was read.

- Castle, N. G. and Engberg, J. (2004). Response formats and satisfaction surveys for elders. *The Gerontologist*, 44(3), 358-367. https://doi.org/10.1093/geront/44.3.358 (abstract)
- Cloos, L., Siepe, B. S., Piccirillo, M. L., Fried, E. I., Wang, S. B., Helmich, M. A., Johnson, S. U., Hoffart, A. and Ebrahimi, O. V. (2025). Accuracy and consistency of visual analog scales in ecological momentary assessment and digital studies. *Collabra: Psychology*, 11(1), 142735. https://doi.org/10.1525/collabra.142735 (abstract)
- Couper, M. P., Tourangeau, R., Conrad, F. G. and Crawford, S. D. (2004). What they see is what we get: response options for web surveys. *Social Science Computer Review*, 22(1), 111-127. https://doi.org/10.1177/0894439303256555 (abstract)
- Couper, M. P., Tourangeau, R., Conrad, F. G. and Singer, E. (2006). Evaluating the effectiveness of visual analog scales: a web experiment. *Social Science Computer Review*, 24(2), 227-245. https://doi.org/10.1177/0894439305281503 (abstract)
- Dejonckheere, E., Demeyer, F., Geusens, B., Piot, M., Tuerlinckx, F., Verdonck, S. and Mestdagh, M. (2022). Assessing the reliability of single-item momentary affective measurements in experience sampling. *Psychological Assessment*, 34(12), 1138-1154. https://doi.org/10.1037/pas0001178 (abstract)
- Funke, F. and Reips, U.-D. (2012). Why semantic differentials in web-based research should be made from visual analogue scales and not from 5-point scales. *Field Methods*, 24(3), 310-327. https://doi.org/10.1177/1525822X12444061 (abstract)
- Funke, F., Reips, U.-D. and Thomas, R. K. (2011). Sliders for the smart: type of rating scale on the web interacts with educational level. *Social Science Computer Review*, 29(2), 221-231. https://doi.org/10.1177/0894439310376896 (abstract)
- Galesic, M., Tourangeau, R., Couper, M. P. and Conrad, F. G. (2008). Eye-tracking data: new insights on response order effects and other cognitive shortcuts in survey responding. *Public Opinion Quarterly*, 72(5), 892-913. https://doi.org/10.1093/poq/nfn059 (abstract)
- Gummer, T. and Kunz, T. (2021). Using only numeric labels instead of verbal labels: stripping rating scales to their bare minimum in web surveys. *Social Science Computer Review*, 39(5), 1003-1029. https://doi.org/10.1177/0894439320951765 (abstract)
- Haslbeck, J. M. B., Jover Martinez, A., Roefs, A. J., Fried, E. I., Lemmens, L. H. J. M., Groot, E. and Edelsbrunner, P. A. (2025). Comparing Likert and visual analogue scales in ecological momentary assessment. *Behavior Research Methods*, 57(8), 217. https://doi.org/10.3758/s13428-025-02706-2 (most of the open-access text)
- Herr, K. A., Spratt, K., Mobily, P. R. and Richardson, G. (2004). Pain intensity assessment in older adults: use of experimental pain to compare psychometric properties and usability of selected pain scales with younger adults. *Clinical Journal of Pain*, 20(4), 207-219. https://doi.org/10.1097/00002508-200407000-00002 (abstract)
- Hicks, C. L., von Baeyer, C. L., Spafford, P. A., van Korlaar, I. and Goodenough, B. (2001). The Faces Pain Scale-Revised: toward a common metric in pediatric pain measurement. *Pain*, 93(2), 173-183. https://doi.org/10.1016/S0304-3959(01)00314-1 (abstract)
- Hjermstad, M. J., Fayers, P. M., Haugen, D. F., Caraceni, A., Hanks, G. W., Loge, J. H., Fainsinger, R., Aass, N. and Kaasa, S. (2011). Studies comparing numerical rating scales, verbal rating scales, and visual analogue scales for assessment of pain intensity in adults: a systematic literature review. *Journal of Pain and Symptom Management*, 41(6), 1073-1093. https://doi.org/10.1016/j.jpainsymman.2010.08.016 (abstract)
- Hohne, J. K. and Lenzner, T. (2015). Investigating response order effects in web surveys using eye tracking. *Psihologija*, 48(4), 361-377. https://doi.org/10.2298/PSI1504361H (abstract)
- Jack, R. E., Garrod, O. G. B., Yu, H., Caldara, R. and Schyns, P. G. (2012). Facial expressions of emotion are not culturally universal. *Proceedings of the National Academy of Sciences*, 109(19), 7241-7244. https://doi.org/10.1073/pnas.1200155109 (abstract)
- Jamieson, S. (2004). Likert scales: how to (ab)use them. *Medical Education*, 38(12), 1217-1218. https://doi.org/10.1111/j.1365-2929.2004.02012.x (full text, author's accepted manuscript)
- Liddell, T. M. and Kruschke, J. K. (2018). Analyzing ordinal data with metric models: what could possibly go wrong? *Journal of Experimental Social Psychology*, 79, 328-348. https://doi.org/10.1016/j.jesp.2018.08.009 (abstract)
- Liu, M. and Conrad, F. G. (2019). Where should I start? On default values for slider questions in web surveys. *Social Science Computer Review*, 37(2), 248-269. https://doi.org/10.1177/0894439318755336 (abstract)
- Lozano, L. M., Garcia-Cueto, E. and Muniz, J. (2008). Effect of the number of response categories on the reliability and validity of rating scales. *Methodology*, 4(2), 73-79. https://doi.org/10.1027/1614-2241.4.2.73 (abstract)
- Menold, N. (2020). Rating-scale labeling in online surveys: an experimental comparison of verbal and numeric rating scales with respect to measurement quality and respondents' cognitive processes. *Sociological Methods and Research*, 49(1), 79-107. https://doi.org/10.1177/0049124117729694 (abstract)
- Miller, H., Thebault-Spieker, J., Chang, S., Johnson, I., Terveen, L. and Hecht, B. (2016). "Blissfully happy" or "ready to fight": varying interpretations of emoji. *Proceedings of the International AAAI Conference on Web and Social Media*, 10(1), 259-268. https://doi.org/10.1609/icwsm.v10i1.14757 (abstract)
- Nadler, J. T., Weston, R. and Voyles, E. C. (2015). Stuck in the middle: the use and interpretation of mid-points in items on questionnaires. *Journal of General Psychology*, 142(2), 71-89. https://doi.org/10.1080/00221309.2014.994590 (abstract)
- Norman, G. (2010). Likert scales, levels of measurement and the "laws" of statistics. *Advances in Health Sciences Education*, 15(5), 625-632. https://doi.org/10.1007/s10459-010-9222-y (abstract)
- Pautex, S., Michon, A., Guedira, M., Emond, H., Le Lous, P., Samaras, D., Michel, J.-P., Herrmann, F., Giannakopoulos, P. and Gold, G. (2006). Pain in severe dementia: self-assessment or observational scales? *Journal of the American Geriatrics Society*, 54(7), 1040-1045. https://doi.org/10.1111/j.1532-5415.2006.00766.x (abstract)
- Preston, C. C. and Colman, A. M. (2000). Optimal number of response categories in rating scales: reliability, validity, discriminating power, and respondent preferences. *Acta Psychologica*, 104(1), 1-15. https://doi.org/10.1016/S0001-6918(99)00050-5 (full text, author-deposited copy)
- Read, J. C. and Horton, M. (2025). Using the Smileyometer to measure UX with children. *Interacting with Computers*, iwaf016. https://doi.org/10.1093/iwc/iwaf016 (parts of the open-access text)
- Simms, L. J., Zelazny, K., Williams, T. F. and Bernstein, L. (2019). Does the number of response options matter? Psychometric perspectives using personality questionnaire data. *Psychological Assessment*, 31(4), 557-566. https://doi.org/10.1037/pas0000648 (abstract)
- Stevens, S. S. (1946). On the theory of scales of measurement. *Science*, 103(2684), 677-680. https://doi.org/10.1126/science.103.2684.677 (full text, scanned copy)
- Sullivan, G. M. and Artino, A. R. (2013). Analyzing and interpreting data from Likert-type scales. *Journal of Graduate Medical Education*, 5(4), 541-542. https://doi.org/10.4300/JGME-5-4-18 (full text, open access)
- Taylor, L. J. and Herr, K. (2003). Pain intensity assessment: a comparison of selected pain intensity scales for use in cognitively intact and cognitively impaired African American older adults. *Pain Management Nursing*, 4(2), 87-95. https://doi.org/10.1016/S1524-9042(02)54210-7 (abstract)
- Toepoel, V. and Funke, F. (2018). Sliders, visual analogue scales, or buttons: influence of formats and scales in mobile and desktop surveys. *Mathematical Population Studies*, 25(2), 112-122. https://doi.org/10.1080/08898480.2018.1439245 (abstract)
- Tomlinson, D., von Baeyer, C. L., Stinson, J. N. and Sung, L. (2010). A systematic review of faces scales for the self-report of pain intensity in children. *Pediatrics*, 126(5), e1168-e1198. https://doi.org/10.1542/peds.2010-1609 (abstract)
- Tourangeau, R., Couper, M. P. and Conrad, F. (2004). Spacing, position, and order: interpretive heuristics for visual features of survey questions. *Public Opinion Quarterly*, 68(3), 368-393. https://doi.org/10.1093/poq/nfh035 (abstract; the Crossref record lists only the first author)
- Tourangeau, R., Couper, M. P. and Conrad, F. (2007). Color, labels, and interpretive heuristics for response scales. *Public Opinion Quarterly*, 71(1), 91-112. https://doi.org/10.1093/poq/nfl046 (abstract)
- Wilhelm, P. and Schoebi, D. (2007). Assessing mood in daily life: structural validity, sensitivity to change, and reliability of a short-scale to measure three basic dimensions of mood. *European Journal of Psychological Assessment*, 23(4), 258-267. https://doi.org/10.1027/1015-5759.23.4.258 (abstract)

## Limits

- Full text was read for Stevens (1946), Jamieson (2004), Sullivan and Artino (2013) and Preston and Colman (2000), most of the text for Haslbeck et al. (2025), and parts of Read and Horton (2025). Every other source was read as abstract only, mostly through PubMed or a publisher record, and what we say about it does not go beyond the abstract. This includes Norman (2010) and Liddell and Kruschke (2018), so our account of their arguments is limited to their abstracts.
- The one direct quotation in this file comes from a scanned copy of Stevens (1946). Everything else is paraphrase.
- The evidence on faces and older adults comes from pain studies, a satisfaction survey and dementia care. We found no study of faces for mood in older adults answering on a phone in daily life. Offering faces is reasoned from the interviews and from indirect evidence, not measured.
- The studies on the number of points used students or simulated data and measured stable traits or past experiences. They do not say how many points suit one momentary item for an older participant.
- We found no peer-reviewed experiment on scroll wheels or on 11 vertical buttons on a small phone. The rejection of the wheel and the concern about 11 buttons rest on indirect evidence and reasoning.
- Haslbeck et al. (2025), the strongest evidence for sliders in experience sampling, is one exploratory study with students and no power analysis. Its authors call it preliminary.
- We did not test the Fieldnote mockups with any scale. Nobody has used the scale screens with participants (file 09).
