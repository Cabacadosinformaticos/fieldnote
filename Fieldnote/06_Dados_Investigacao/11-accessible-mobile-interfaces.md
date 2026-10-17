# Accessible mobile interfaces for older participants

## Question

What the standards, platform guidelines and research say about the points interviewees raised
(file 09) and the team's answers: less on the participant's main screen and larger type, touch
targets of at least 48 px, labels that do not look like buttons, contrast and colour vision,
visible options for short lists and a dropdown for long ones, and permissions asked when needed.
The file also checks the colours of the current mockups against the contrast rules.

## Why this matters for Fieldnote

Several interviewees worried about older participants, who were not interviewed. The interviews gave
the opinions of design and research professionals. This file looks for evidence behind each opinion,
so that the decisions in the requirements can be traced to something other than taste, and so that
the places where the evidence disagrees with the team are visible.

## WCAG 2.2

WCAG 2.2 is a W3C Recommendation for web content. The portal is a web application. The participant
app is native, and for non-web software the W3C publishes an informative Group Note, WCAG2ICT
(December 2025), on how to read the A and AA criteria outside a browser. We read only its
introduction, and use the criteria as a measuring stick because an interviewee named them. The
text below was read in the Recommendation (https://www.w3.org/TR/WCAG22/).

| Criterion | Level | Normative text | Meaning here |
|---|---|---|---|
| 1.4.3 Contrast (Minimum) | AA | "a contrast ratio of at least 4.5:1"; "at least 3:1" for large-scale text; inactive components exempt | Large-scale means 18 point, or 14 point bold: 24 and about 18.7 CSS px |
| 1.4.11 Non-text Contrast | AA | "at least 3:1 against adjacent color(s)" for "Visual information required to identify user interface components and states" | Input borders, selected states, focus rings, meaningful icons |
| 1.4.1 Use of Color | A | "Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element." | Status, errors, selection |
| 1.4.4 Resize Text | AA | "up to 200 percent without loss of content or functionality" | Today screen at the largest system text size |
| 1.4.10 Reflow | AA | no "scrolling in two dimensions" at "320 CSS pixels" | Mainly the portal |
| 2.5.8 Target Size (Minimum) | AA | "at least 24 by 24 CSS pixels", with exceptions (spacing, equivalent control, inline, user agent, essential) | The floor |
| 2.5.5 Target Size (Enhanced) | AAA | "at least 44 by 44 CSS pixels", with four exceptions | The enhanced level |

The Understanding page for 2.5.8 gives the reason: "Some people with physical impairments cannot
click small buttons that are close together". The page for 1.4.11 says that where a text field is
identified by a border, "that indicator must meet 3:1", and that a text-only button needs no
contrasting border if other cues show it is a button. The page for 1.4.1 lists people with colour
vision deficiency and notes that "many older users do not see color well".

"Checked against WCAG 2.2" therefore means three checks: text contrast (1.4.3), non-text contrast
(1.4.11) and size (2.5.8, or 2.5.5 for the enhanced level). The last section does the first two.

## Touch targets and type size

### Platform guidance

| Source | Target | Text |
|---|---|---|
| Apple HIG, Accessibility and Typography | iOS default 44 x 44 pt, minimum 28 x 28 pt; about 12 pt padding around bezeled controls | Allow enlarging text "by at least 200 percent"; iOS default 17 pt, minimum 11 pt |
| Android Developers | "at least 48dpx48dp"; "Larger is even better" | 4.5:1 below 18 sp (14 sp bold), else 3:1 |
| Google Accessibility Help | 48 dp, 8 dp apart; 48 dp is about 9 mm | |

The interviewee's 42 px sits between Apple's minimum and its default. The team's 48 is Google's
figure. All of these are written for the general population.

### Research on size and age

- Parhi, Karlson and Bederson (2006) studied one-handed thumb use: no significant error difference
  above 9.6 mm for single targets and 7.7 mm for tap sequences; they recommend 9.2 and 9.6 mm
  (abstract; ages not stated there).
- Leitão and Silva (2012), Fraunhofer Portugal AICOS, tested 40 adults aged 65 to 95 (mean 76.9)
  from day care centres in Porto. Tap accuracy was significantly lower below 14 mm and did not differ
  above it. With 97% as the satisfactory level, the authors conclude that 14 to 17.5 mm works best,
  against 7 to 9 mm in the guidelines of the time. Spacing had no significant effect. The phone was an
  early Android model (Samsung Nexus S) and the tasks were games. It is the only study we found with
  Portuguese older adults on a smartphone.
- Sultana and Moffatt (2019): older adults had longer selection times and higher error rates, and
  their errors were more often misses (landing and lifting outside the target) than slips (abstract).
- Findlater et al. (2013): touchscreens narrowed the performance gap between older and younger
  adults compared with a mouse (abstract).

Google's 9 mm for 48 dp matches Parhi et al., which probably explains the figure. For older users
48 dp looks like a floor: on Google's conversion, 14 mm is roughly 75 dp.

### Type

Gomez-Hernandez et al. (2023, below) found no consensus on a minimum size: one study recommends at
least 10 points, another at least 30 for critical text and 20 for secondary text, and the authors say
the topic "needs further research". "Larger type" cannot be set from the literature. The defensible
rule is the platform one: scale with the system setting, support at least 200 percent, and test
the layout at the largest size. React Native scales text with the user's setting by default
(`allowFontScaling` is `true`), so the app must not cap it low.

## Older adults and smartphones

**Review.** Gomez-Hernandez et al. (2023, full text read) kept 40 usability studies with people over
60 from 2010 to 2021 and derived 27 guidelines. Two "golden rules" were each backed by 15 studies:
simplify, and increase the size and distance between interactive controls. Related guidelines:
"Reduce the number of available elements and options in the screen"; "Maintain focus on the current
action" (no secondary functions); "Simplify the navigation, reduce the number of alternative paths",
with a safe exit on every screen; "Clearly show which elements are touchable"; "Add labels to icons";
"Use large font sizes"; "Provide high contrast between foreground and background color". It
synthesises recommendations, not measured effects, and the authors note that the definition of
older adults is context dependent.

**Navigation depth.** Li and Luximon (2020) had 22 older adults do 19 navigation tasks. They
navigated content better than menus and buttons, and struggled to notice menus and understand
icons (abstract). Zaphiris (2001), a review of menu depth and breadth, reports that broader,
shallower menus performed better, and a web study in which seniors completed short-path tasks as
often as younger adults but not tasks needing three or more moves. These are older, mostly
pre-smartphone results reported second-hand. They agree in direction with the interviewee: nested
menus confuse, a few clear options work.

**Vision.** Owsley (2011) reviews 25 years of research on age-related declines in contrast
sensitivity, low-light vision and processing speed (abstract). This is the reason the contrast
ratios are a floor.

**Portugal.** Eurostat's digital skills survey (dataset isoc_sk_dskl_i21) gives the share of people
with at least basic overall digital skills. In 2025 it was 59.15% for all individuals in Portugal
and 20.65% for those aged 65 to 74, against 33.00% in that age group in the EU. For Portugal it was
16.57% in 2021 and 18.52% in 2023. The survey stops at 74. If older Portuguese participants are
recruited, about four in five of those aged 65 to 74 lack basic digital skills, so the app cannot
assume familiarity with menus, icons or permission prompts. We found no source on smartphone use by
older people in Portugal.

## Labels that look like buttons

Gomez-Hernandez et al. state the rule from the other side: show clearly what is touchable. Moran
(2017) of the Nielsen Norman Group eye-tracked 71 web users on nine sites, each in a strong and a
weak-signifier version; weak versions took about 22% longer and drew about 25% more fixations. It is
a practitioner study on desktop pages with general users, and we read a summary. Moving metadata
into plain text follows from both: status that is not a control should not have the shape of one.
The Today mockup does this for its header. Its sync status is an icon-only round button, which
"add labels to icons" would question; session 4 asked for the icon, and nobody has tested whether
older participants understand it.

## Dropdowns or visible options

- Couper et al. (2004): in a web survey, visible options were chosen more often than hidden ones, and
  the authors suggest visibility is a stronger effect than primacy (abstract).
- Heerwegh and Loosveldt (2002), two experiments: "a slight preference for radio buttons might be
  justified", with benefits and drawbacks on both sides (abstract).
- Antoun et al. (2018), review of smartphone questionnaires: prefer simple types (single and
  multiple choice) over drop boxes, large grids and sliders (abstract).
- Apple HIG: a picker suits "medium-to-long lists"; for a short list it suggests a pull-down button,
  which also hides the options. Apple does not support "show everything" for short lists. The survey
  work does.

Both interviewees are right in their context: dropdowns save space; visible options avoid a hidden
state. The evidence is from web surveys with general respondents, supports visible options for short
lists, and gives no number for "short". The mockups use chips for lists of up to 7 options (age
band, occupation, travel mode) and a sheet of 52 px rows for municipalities and parishes. That limit
is the team's choice. Selected chips carry a tick, so selection is not shown by colour alone.

## Permissions

- Android: "Ask for a permission in context, when the user starts to interact with the feature that
  requires it." Do not block the user, and degrade gracefully on denial. After two denials the system
  dialog no longer appears, so asking too early costs the chance to ask later.
- Android 13 and later asks for a notification permission. The documentation says to let people
  "familiarize themselves with your app" first and to ask after a user action.
- Apple HIG: "Avoid requesting permission at launch unless the data or resource is required for your
  app to function"; "wait to request permission until people actually use an app feature that
  requires access".
- Felt et al. (2012): 17% of participants paid attention to install-time permissions and 3% of survey
  respondents answered three comprehension questions correctly (abstract). That is the old
  install-time model. It argues against bundling requests.
- Micinski et al. (2017): a tap on a button can serve as authorisation for a related resource, but
  accesses not tied to an interaction should be authorised separately, possibly at first launch
  (abstract).
- Wijesekera et al. (2015), a 36-person field study: at least 80% of participants would have blocked
  at least one request (arXiv abstract page only). Context decides what is acceptable.

None measures the interviewee's claim that many requests at the start make people give up. They
support the rule without quantifying abandonment. For Fieldnote, notifications are the mechanism of
the study, closer to "required for your app to function" than a camera is. The prompt belongs when the
participant joins a study and confirms their hours, with a sentence saying what will be sent. Camera,
microphone and location are asked the first time a capture type needs them. Because a second denial is
final on Android, the app needs a visible path to system settings.

## Colour vision deficiency

Birch (2012) reviewed population surveys: red-green deficiency affects about 8% of men and 0.4% of
women of European origin (abstract). In a pool of 20 men, expect one or two. Rules agree across
WCAG 1.4.1, Apple ("Convey information with more than color alone", naming red-green and blue-orange
pairs) and Android ("use cues other than color"): pair colour with a word or shape. The mockups mostly
do. The sync button is a green cloud with a tick when all is sent and an amber crossed-out cloud with a
count when entries wait. Required fields carry the word "(obrigatório)". We did not simulate colour
vision deficiency.

## Contrast check of the mockups

**Method.** We read the 43 participant app mockups (`App*.dc.html`, 767 text nodes), read-only, as they
stood during the check. A script parsed the inline styles, resolved each text node's colour (with
inheritance and opacity) against the nearest background, and computed the WCAG ratio from relative
luminance. Text of 24 px, or 18.66 px and bold, counted as large. Disabled controls are exempt under
1.4.3.

**Result.** There are 38 distinct pairs and none fails 4.5:1 for normal text. The lowest is 4.79:1.
The ten lowest are below. The other 28 range from 7.84:1 to 19.29:1 and pass.

| Foreground | Background | Ratio | AA normal | AA large | Use |
|---|---|---|---|---|---|
| #5B6478 | #E3E7F0 | 4.79 | Pass | Pass | Muted button label (3 nodes) |
| #5B6478 | #EEF1F6 | 5.24 | Pass | Pass | Disabled "Novo registo livre" (exempt) |
| #5B6478 | #F4F6FB | 5.49 | Pass | Pass | Helper text on the page, 65 nodes, 13 to 15 px |
| #FFFFFF | #2F5BEA | 5.52 | Pass | Pass | Primary button labels, 46 nodes |
| #5B6478 | #FFFFFF | 5.93 | Pass | Pass | Helper text in cards, 108 nodes, from 12 px |
| #DDE2F3 | #1E3FB0 | 6.79 | Pass | Pass | "Pedido às 14:15" on the Today card |
| #0B5C40 | #E3F4EC | 7.03 | Pass | Pass | "Enviado" status |
| #9B1C1C | #FDECEC | 7.14 | Pass | Pass | Erasure status |
| #9B1C1C | #F4F6FB | 7.54 | Pass | Pass | "(obrigatório)" |
| #1E3FB0 | #EAF0FF | 7.69 | Pass | Pass | "Recomendado" badge |

The weakest real pairs are the secondary greys at 5.49 to 5.93, used for helper text from 12 px. They
pass, but small grey text is the combination to watch for older eyes. The non-text and size checks
are weaker:

| Item | Value | Verdict |
|---|---|---|
| Input and textarea border #DCE1EC on white | 1.31:1 (1.21:1 on the page colour) | Below 3:1. Fields have labels, so a risk rather than a certain fail. #7E8799 gives 3.61:1 on white. Corrected to #858EA1 (3.29:1) |
| Outlined secondary buttons, 1.5 px #DCE1EC | 1.31:1 | Allowed for text-only buttons, weak as a signifier |
| Focus ring #2F5BEA on the Today card #1E3FB0 | 1.59:1 | Fails 3:1; passes on white (5.52) and on the page colour (5.10). Corrected with a white inner ring |
| Amber button #FFB020 on the card | 4.80:1 | Passes |
| Buttons, links and labels with a declared height | 91 of 275 are 44 px, none lower | Meets 2.5.8 and 2.5.5, not the team's 48. Back button (44 x 44), choice chips, hour steppers. All raised to 48 px |
| Text nodes under 14 px | 133 of 767 (46 at 12 px) | Today uses 12 px for tab labels, 13 to 14 px for metadata |
| Today layout | Fixed 412 x 915 frame, `overflow: hidden`, 7:3 flex split | Will clip at 200% text unless the real screen scrolls |

**Not covered.** Only colours in inline styles were measured. Text over camera previews and photos,
run-time states (`{{...}}` bindings such as selected backgrounds and error borders) and icons were
not. Sizes are CSS px at a 412 px frame, read as dp. This checks mockups, not a built app.

## What we conclude

- The mockups meet AA for text contrast in every pair, with a lowest ratio of 4.79:1. They did not meet
  non-text contrast for input borders (1.31:1), and the focus ring on the main card failed (1.59:1).
  Both were corrected in the mockups after this check.
- 48 dp is Android's floor, and every source that tested size found small targets hurt. The one study
  with Portuguese older adults found accuracy fell below about 14 mm, nearly 1.5 times Google's 48 dp.
  The 64 px call to action and 52 to 56 px rows follow this. The 44 px chips and back button did not meet
  even 48 and were raised to 48 px.
- "Larger type" has no number in the literature. System scaling to 200 percent, tested at the largest
  size, is better supported than any fixed pixel value, and 12 to 14 px text on the Today screen
  works against it.
- Visible options for short lists is supported in direction by web survey work. The threshold is a
  design choice. Permissions in context is supported by Android and Apple, but no source measured
  abandonment.
- Nothing here was tested with older participants, and the single Portuguese sample lived in day care
  centres, which is not the likely pool of a design research unit.

## How Fieldnote proceeds

| Finding | Decision | Status |
|---|---|---|
| Fewer elements, one main action (Gomez-Hernandez et al.) | One main card on Today; secondary actions below | Adopted |
| Touchable things must look touchable | Metadata in plain text; no pill backgrounds on non-controls | Adopted |
| 48 dp is a floor; Portuguese older adults needed about 14 mm | 48 dp minimum for every control; 56 dp or more for primary actions and scale options; raise 44 px chips, back button and steppers to 48 | Adopted |
| Units | Sizes written in dp, not px | Planned |
| No numeric type minimum; Apple and WCAG ask for 200% | System text scaling, not capped below 200%; test Today and capture at the largest size; replace the fixed 7:3 layout with one that scrolls | Planned |
| Small grey helper text is the weakest pairing | Body and metadata at least 14 px; helper text darker or larger; review 12 px tab labels | Planned |
| Text contrast passes AA | Keep the palette; run the script on any new colour | Adopted |
| Input borders 1.31:1, focus ring 1.59:1 | Borders at least 3:1 (#858EA1); white inner focus ring on the blue card | Adopted |
| Colour must not carry meaning alone | Colour always with a word or shape; ticks on selected chips | Adopted |
| Icon-only sync button | Keep the icon, add a short word when entries are waiting | Planned |
| Visible options for short lists, picker for long | Chips or rows up to 7 options, sheet for longer; revisit after any pilot | Adopted |
| Permissions in context | Notifications when joining a study and confirming hours; camera, microphone, location at first use; explanation screen; path to settings after denial | Planned |
| Colour vision deficiency | Simulate deuteranopia and protanopia on the main screens | Future work |
| Nested menus confuse older users | Four top-level tabs, no menu inside a menu in the participant app | Adopted |
| No older participant has seen the mockups | Try Today and capture with a few older people if the timeline allows | Future work |

## Sources

- W3C (2023). Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/WCAG22/ and the
  Understanding pages for Target Size (Minimum), Target Size (Enhanced), Non-text Contrast and Use of
  Color, https://www.w3.org/WAI/WCAG22/Understanding/.
- W3C (2025). Guidance on Applying WCAG 2 to Non-Web Information and Communications Technologies
  (WCAG2ICT). Group Note. https://www.w3.org/TR/wcag2ict-22/
- Apple. Human Interface Guidelines: Accessibility, Typography, Privacy, Pickers.
  https://developer.apple.com/design/human-interface-guidelines/
- Android Developers. Make apps more accessible; Principles for improving app accessibility; Request
  runtime permissions; Notification runtime permission. https://developer.android.com/
- Google Accessibility Help. Touch target size. https://support.google.com/accessibility/android/answer/7101858
- React Native. Text. https://reactnative.dev/docs/text
- Leitão, R. and Silva, P. A. (2012). Target and spacing sizes for smartphone user interfaces for
  older adults: design patterns based on an evaluation with users. PLoP 2012.
  https://mural.maynoothuniversity.ie/6045/ (no DOI found)
- Parhi, P., Karlson, A. K. and Bederson, B. B. (2006). Target size study for one-handed thumb use on
  small touchscreen devices. *MobileHCI '06*, 203-210. https://doi.org/10.1145/1152215.1152260
- Sultana, A. and Moffatt, K. (2019). Effects of aging on small target selection with touch input.
  *ACM Transactions on Accessible Computing*, 12(1), 1-35. https://doi.org/10.1145/3300178
- Findlater, L., Froehlich, J. E., Fattal, K., Wobbrock, J. O. and Dastyar, T. (2013). Age-related
  differences in performance with touchscreens compared to traditional mouse input. *CHI '13*,
  343-346. https://doi.org/10.1145/2470654.2470703
- Gomez-Hernandez, M., Ferre, X., Moral, C. and Villalba-Mora, E. (2023). Design guidelines of mobile
  apps for older adults: systematic review and thematic analysis. *JMIR mHealth and uHealth*, 11,
  e43186. https://doi.org/10.2196/43186
- Li, Q. and Luximon, Y. (2020). Older adults' use of mobile device: usability challenges while
  navigating various interfaces. *Behaviour & Information Technology*, 39(8), 837-861.
  https://doi.org/10.1080/0144929X.2019.1622786
- Zaphiris, P. (2001). Age differences and the depth-breadth tradeoff in hierarchical online
  information systems. In C. Stephanidis (ed.), *Universal Access in HCI*, 540-544. Lawrence Erlbaum.
  https://ktisis.cut.ac.cy/bitstream/20.500.14279/2995/5/Age%20differences%20and%20the%20depth-breadth.pdf
- Owsley, C. (2011). Aging and vision. *Vision Research*, 51(13), 1610-1622.
  https://doi.org/10.1016/j.visres.2010.10.020
- Eurostat. Individuals' level of digital skills (from 2021 onwards), isoc_sk_dskl_i21, indicator
  basic or above basic overall digital skills, updated 17 April 2026.
  https://ec.europa.eu/eurostat/databrowser/view/isoc_sk_dskl_i21
- Couper, M. P., Tourangeau, R., Conrad, F. G. and Crawford, S. D. (2004). What they see is what we
  get: response options for web surveys. *Social Science Computer Review*, 22(1), 111-127.
  https://doi.org/10.1177/0894439303256555
- Heerwegh, D. and Loosveldt, G. (2002). An evaluation of the effect of response formats on data
  quality in web surveys. *Social Science Computer Review*, 20(4), 471-484.
  https://doi.org/10.1177/089443902237323
- Antoun, C., Katz, J., Argueta, J. and Wang, L. (2018). Design heuristics for effective smartphone
  questionnaires. *Social Science Computer Review*, 36(5), 557-574.
  https://doi.org/10.1177/0894439317727072
- Felt, A. P., Ha, E., Egelman, S., Haney, A., Chin, E. and Wagner, D. (2012). Android permissions:
  user attention, comprehension, and behavior. *SOUPS '12*, article 3.
  https://doi.org/10.1145/2335356.2335360
- Micinski, K., Votipka, D., Stevens, R., Kofinas, N., Mazurek, M. L. and Foster, J. S. (2017). User
  interactions and permission use on Android. *CHI '17*, 362-373.
  https://doi.org/10.1145/3025453.3025706
- Wijesekera, P., Baokar, A., Hosseini, A., Egelman, S., Wagner, D. and Beznosov, K. (2015). Android
  permissions remystified: a field study on contextual integrity. *24th USENIX Security Symposium*,
  499-514. https://arxiv.org/abs/1504.03747
- Birch, J. (2012). Worldwide prevalence of red-green color deficiency. *Journal of the Optical
  Society of America A*, 29(3), 313. https://doi.org/10.1364/JOSAA.29.000313
- Moran, K. (2017). Flat UI elements attract less attention and cause uncertainty. Nielsen Norman
  Group. https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/

All sources accessed in October 2026. DOIs were checked against the Crossref record.

## Limits

- Read in full or in the relevant sections: the WCAG criteria and Understanding pages, the cited
  passages of the Apple pages (through the JSON data behind them) and the Android pages,
  Gomez-Hernandez et al., and Leitão and Silva (method, results, first pattern). Read as abstracts
  only: Parhi et al., Sultana and Moffatt, Findlater et al., Li and Luximon, Owsley, Couper et al.,
  Heerwegh and Loosveldt, Antoun et al., Felt et al., Micinski et al. and Birch. Wijesekera et al.
  was read as the arXiv abstract page, Zaphiris to section 3 (it reports other studies second-hand),
  and Moran as a summary. Nothing is attributed beyond what was read.
- WCAG is written for web content. Applying it to a native app is by analogy. We did not read EN
  301 549 or the European Accessibility Act, which may apply to a product offered publicly.
- Target size studies differ in device, task and age. The 14 mm figure comes from one study of 40
  people, and converting mm to dp depends on the device.
- The dropdown evidence is from web surveys on mostly larger screens. We found no study of dropdowns
  against visible options for older adults on a phone, and none on abandonment caused by early
  permission prompts.
- The Eurostat figures cover ages 16 to 74. They were read through the Eurostat API in a fetch tool;
  only the 2025 value for Portugal aged 65 to 74 (20.65%) was checked against its raw record.
- The contrast check covers inline-style colours at one moment while other people were editing some
  mockups. It tests ratios, not legibility, and no colour vision simulation was done.
- Nobody used the app. The conclusions concern design, not observed use.
