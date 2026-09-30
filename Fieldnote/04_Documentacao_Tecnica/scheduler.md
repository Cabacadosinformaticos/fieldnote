# Scheduler: activity planning as a constraint satisfaction problem

Status: proposed, 29 September 2026. This is the artificial intelligence component of the project,
from the constraint satisfaction topic of the Artificial Intelligence course.

## The problem

A diary study asks each participant for a few activities per day. Asking at the wrong time, too
often, or always at the same hour can change whether and how well participants answer, although the
evidence on frequency is mixed (see `06_Dados_Investigacao/01` and `04`). Asking everyone at the
same minute also sends a burst of uploads to the server. Deciding when to send each prompt is a
constraint satisfaction problem.

## Formulation

The scheduler plans one day at a time, every night, for each running study. All times are in the
study's time zone; a study has a single time zone in this version.

| Element | Definition |
|---|---|
| Variables | One per prompt to plan: (participant, activity, occurrence), with as many occurrences as the activity's `prompts_per_day`. A study with 50 participants and 3 prompts per day has 150 variables |
| Domains | 15-minute slots inside the participant's declared availability and the activity's window. From 08:00 to 22:00 that is at most 56 values, usually fewer. After node consistency and AC-3, every domain gets one more value, "not planned" (⊥) |
| Binary constraints | Two prompts to the same participant are at least `min_gap_minutes` apart. When two activities have different gaps, the larger one applies |
| Global constraints | Per participant, no more than the study's `max_prompts_per_day`. Per slot, no more than the study's `max_prompts_per_slot` across all participants, to spread the upload load |
| Soft preferences | Set per study by the researcher: varied (cover different parts of the day and avoid repeating yesterday's slot), fixed (keep each participant's slots the same every day) or balanced. The literature does not settle which gives better data: varied times sample the whole day, fixed times were associated with higher compliance (see `06_Dados_Investigacao/04-prompt-timing-and-scheduling.md`) |

The hard constraints (binary and global) decide which plans are valid. The soft preferences give
each valid plan a score, and the solver keeps the best plan it finds within a time limit.

`max_prompts_per_slot` limits one study. Two studies running at the same time can still add up
in the same slot; a global budget across studies is future work.

### Soft preference score

This score is proposed and will be finalised in implementation.

The day is split into four parts: 08:00-11:00, 11:00-14:00, 14:00-18:00 and 18:00-22:00. Two terms
are computed for a plan, using yesterday's plan and the last 3 days of each participant:

- Variety term V: +1 for each prompt at least 60 minutes away from the equivalent prompt of
  yesterday, plus +1 for each participant and each part of the day that the participant did not
  have in the last 3 days and that today's plan covers.
- Routine term F: +1 for each prompt in the same 15-minute slot as the equivalent prompt of
  yesterday. With 15-minute slots, "the same time" means the same slot.

The study style selects the weights: varied uses V, fixed uses F, and balanced uses
0.5 V + 0.5 F. The score of a plan is the sum of its terms. One part is added per prompt and
another per participant.

### Partial plans

The slot cap can be too low for the number of participants, so a complete plan may not exist. To
handle this without a separate case, every domain has the extra value ⊥ ("not planned"):

- A plan with ⊥ values is valid. Plans are compared lexicographically: first by the number of
  planned prompts, then by the soft score.
- ⊥ is ordered last in value ordering, so the search tries real slots first and ⊥ only when no
  slot fits.
- MRV counts the size of a domain without ⊥.
- When a participant's daily counter reaches `max_prompts_per_day`, only ⊥ remains in the domains
  of that participant's remaining prompts.
- ⊥ is never removed by propagation, so no domain becomes empty during the search and the search
  always returns a plan.

The formulation is close to Max-CSP, where the goal is to satisfy as many constraints, here as many
prompts, as possible.

## Algorithm

The team implements the algorithms instead of calling a solver library, to show the methods taught
in the course:

1. Node consistency when the domains are built, which applies the availability and the activity
   window. Then AC-3 over the binary minimum-gap constraints, to remove slots that can never be
   part of a valid plan. After both steps, ⊥ is added to every domain.
2. Backtracking search with the MRV heuristic (plan first the prompt with the fewest valid slots
   left, not counting ⊥; ties go to the participant with more prompts still to plan) and LCV
   ordering of values (try first the slot that removes the fewest
   options from other prompts, with ties broken by the soft score, and ⊥ last).
3. Forward checking after each assignment of a slot. For the binary constraints it removes the
   slots too close to the assigned one. For the global constraints it keeps a counter per
   participant and per slot. When a slot counter reaches its limit, that slot is removed from the
   unassigned prompts. When a participant counter reaches its limit, only ⊥ is left for that
   participant's remaining prompts.
4. Anytime behaviour: the search keeps the best plan found so far and replaces it only when a
   plan is better in the lexicographic order (planned prompts, then soft score). It stops when it
   has explored every branch or when the time limit of 10 s per study is reached.

When a branch is abandoned, the removed values and the counter changes are undone with a trail (an
undo stack): each change is recorded and reverted in reverse order.

An optional branch and bound cuts a branch when it cannot beat the best plan in the same
lexicographic order. The bound is a pair: the planned prompts so far plus the unassigned prompts
that still have a real slot in their domain, and the score so far plus the maximum that each
remaining prompt and each participant can still add. A branch is cut only when this pair cannot
beat the best plan's pair, that is, when its planned bound is lower, or equal with a score bound
that is not higher. Whether to include it is decided in implementation.

### What the end of the search proves

If the search finishes before the 10 s limit, the plan is optimal for (planned prompts, soft
score), because backtracking search is complete. If a prompt is left at ⊥ in that plan, no plan
with more planned prompts exists. If the limit cuts the search, the plan is the best found in that
time, with no optimality claim, and the run records that it was cut.

### Replanning during the day

If a participant changes availability during the day, the scheduler replans only that
participant's remaining prompts with the same search, keeping the rest of the plan fixed:

- The prompts of that participant already sent today are fixed values. They count towards
  `max_prompts_per_day` and towards the counters of their slots, and `min_gap_minutes` applies
  against them.
- The slot counters include the prompts of the other participants, so `max_prompts_per_slot` is
  still respected.

### When a prompt is left unplanned

A prompt that is not planned becomes `unplanned`, with a reason stored in
`prompt.unplanned_reason` and shown to the researcher in the dashboard. There are five reasons:

| Reason (`unplanned_reason`) | Where it is detected |
|---|---|
| The window is outside the participant's availability (`outside_availability`) | The domain is empty at node consistency, before the search |
| The minimum gap does not fit in the window, for example two prompts 3 hours apart in a 2-hour window (`min_gap_infeasible`) | AC-3 empties the domain, before the search |
| The daily limit of the participant is reached (`daily_cap`) | Forward checking leaves only ⊥ once the participant's counter reaches `max_prompts_per_day` |
| The slot cap leaves no room (`slot_cap`) | The search chooses ⊥ for the prompt in a plan that finished before the time limit |
| The search was cut by the time limit (`search_cut`) | The prompt is at ⊥ in the best plan found, but the search did not finish, so a slot may exist |

Prompts with the first two reasons are removed from the problem before the search. When a study is
created, the dashboard suggests a slot cap from the number of participants and their availability,
so the slot cap case is rare.

## Running the scheduler with two replicas

Only one scheduler replica plans and sends at a time. The leader holds a lease row in the database
and renews it every 5 s; a lease not renewed for 15 s can be taken by the standby. Before sending a
notification, the leader marks the prompt as sent in the same statement that checks it still holds
the lease. If any database call fails, the leader stops sending until it has renewed the lease.
The worst case is one notification sent twice during a takeover, which the fault model accepts.

## Evaluation

The scheduler will be tested with generated studies of 10, 50 and 100 participants. Each run
records the random seed of the generator, so results can be reproduced.

For comparability and reproducibility, the evaluation and ablation runs use a fixed node budget
(for example 1 million nodes) instead of the wall-clock limit, and record whether each run
finished or was cut. With the same instance, seed and tie-breaking order, the search visits the
same nodes in any machine, and only the time changes.

| Measure | Target |
|---|---|
| Hard constraint violations in any returned plan | Zero |
| Prompts left `unplanned` | Reported for each study size, with the reason |
| Solve time | Measured for each study size |
| Nodes expanded and backtracks | Measured for each study size |
| Delivery delay | Difference between planned, shown and opened times (`prompt.shown_at`, `prompt.opened_at`), measured with the team's own phones |
| Load spread | Largest number of prompts in one slot, compared with the baseline |
| Soft score | Compared with the baseline |

The baseline is the same hours for every participant, as many diary tools do. It differs from the
researcher's "fixed" style, where each participant keeps their own slots from day to day and all
constraints are respected.

### Ablation study

The same instances are solved by five variants of the algorithm, each adding one technique to the
previous one:

1. Plain backtracking.
2. Plus forward checking.
3. Plus MRV.
4. Plus LCV.
5. Plus AC-3.

For each variant the study measures nodes expanded, backtracks and time, with the same node budget
for all variants, and records whether each run finished. The results show what each technique
contributes. AC-3 may remove few values when the windows are wide, because it does not see the slot
cap, and the results report that as measured.

## Scope limits

- The evaluation measures plan validity, load spread, search effort and solve time with generated
  studies. It does not measure whether participants answer more or more accurately, and the
  project makes no such claim. The daily prompt limit is a safeguard the researcher sets, not a
  proven way to improve compliance, because the evidence on prompt frequency is mixed.
- Prompts are planned from declared availability, not from live phone context, which the
  literature shows can improve response and accuracy. Using context is future work.
- Delivery depends on push notifications, which are best effort. When the app syncs, it schedules
  local notifications for the next 24 hours of its plan, cancelled by prompt id when the push
  arrives or the prompt is answered (see the architecture).
- The scheduler plans; it does not learn from past answers. Predicting the chance of an answer
  from each participant's history is listed as future work.
- Planning is per study and per day, which keeps each problem small enough for backtracking.
