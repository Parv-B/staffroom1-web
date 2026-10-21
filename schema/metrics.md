# Metrics

Generated from `staffroom.metrics.registry`; do not edit by hand.
Every metric is `null` with a reason when it cannot be computed, and is marked
low confidence (with a reason) when its inputs are unreliable.

## `check_in_count`

Teacher segments labelled as comprehension check-ins ("Is that clear?", "samjhe?"). Counted on teacher-labelled segments only; one label per segment.

- Unit: count
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `closed_question_count`

Teacher segments labelled as closed questions (one short answer). Counted on teacher-labelled segments only; one label per segment.

- Unit: count
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `language_share_ar`

Fraction of all transcript words (every speaker) that the word-level classifier labels Arabic (Arabic script or romanized expressions). Labels are en, hi (incl. romanized Hindi), ar and neutral (numbers, variables, names, fillers); the four shares sum to 1.

- Unit: fraction
- Data source: transcript words, word-level language classifier (staffroom.language)

## `language_share_en`

Fraction of all transcript words (every speaker) that the word-level classifier labels English. Labels are en, hi (incl. romanized Hindi), ar and neutral (numbers, variables, names, fillers); the four shares sum to 1.

- Unit: fraction
- Data source: transcript words, word-level language classifier (staffroom.language)

## `language_share_hi`

Fraction of all transcript words (every speaker) that the word-level classifier labels Hindi (Devanagari or romanized). Labels are en, hi (incl. romanized Hindi), ar and neutral (numbers, variables, names, fillers); the four shares sum to 1.

- Unit: fraction
- Data source: transcript words, word-level language classifier (staffroom.language)

## `language_share_hi_teacher`

Fraction of the teacher's words that the word-level classifier labels Hindi (Devanagari or romanized); denominator includes the teacher's neutral words.

- Unit: fraction
- Data source: transcript words, word-level language classifier (staffroom.language); teacher segments from diarization

## `language_share_neutral`

Fraction of all transcript words (every speaker) that the word-level classifier labels neutral (no language). Labels are en, hi (incl. romanized Hindi), ar and neutral (numbers, variables, names, fillers); the four shares sum to 1.

- Unit: fraction
- Data source: transcript words, word-level language classifier (staffroom.language)

## `longest_teacher_monologue_s`

A teacher monologue is a stretch of consecutive teacher segments, measured from the first segment's start to the last segment's end. Pauses shorter than 3 s with no other speaker are bridged; any student (or unknown-speaker) segment, or a pause of 3 s or more, ends it. This is the longest one. Null when the teacher never spoke.

- Unit: s
- Data source: transcript segments with diarized speaker labels

## `open_question_count`

Teacher segments labelled as open questions (invite a reasoned answer). Counted on teacher-labelled segments only; one label per segment.

- Unit: count
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `open_question_share`

Open questions / (open + closed questions), 0–1. Check-ins and rhetorical questions are excluded. Null when there are no open or closed questions. Counted on teacher-labelled segments only; one label per segment.

- Unit: fraction
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `rhetorical_question_count`

Teacher segments labelled as rhetorical questions (no answer expected). Counted on teacher-labelled segments only; one label per segment.

- Unit: count
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `silence_time_s`

Lecture duration minus the time containing any detected speech. Uses the voice-activity (VAD) speech timeline when audio was ingested; otherwise the gaps between transcript segments (then marked low confidence, since segments can span short pauses).

- Unit: s
- Data source: VAD speech timeline (Silero) if available, else transcript segment gaps

## `student_talk_share`

Student talk time / (teacher talk time + student talk time), 0–1. Unknown speakers are excluded from both sides. Null when neither teacher nor student speech was detected.

- Unit: fraction
- Data source: transcript segments with diarized speaker labels

## `student_talk_time_s`

Total time covered by student-labelled transcript segments (overlapping segments counted once). Speech of unknown speakers is not counted.

- Unit: s
- Data source: transcript segments with diarized speaker labels

## `student_turn_count`

A student turn is a stretch of consecutive student-labelled segments, from the first segment's start to the last segment's end; a teacher or unknown-speaker segment, or a pause of 3 s or more, ends it. Different students speaking back to back cannot be told apart and count as one turn. This is the number of student turns.

- Unit: count
- Data source: transcript segments with diarized speaker labels

## `student_turn_median_s`

A student turn is a stretch of consecutive student-labelled segments, from the first segment's start to the last segment's end; a teacher or unknown-speaker segment, or a pause of 3 s or more, ends it. Different students speaking back to back cannot be told apart and count as one turn. This is the median turn length. Null when there are no turns.

- Unit: s
- Data source: transcript segments with diarized speaker labels

## `teacher_monologue_median_s`

A teacher monologue is a stretch of consecutive teacher segments, measured from the first segment's start to the last segment's end. Pauses shorter than 3 s with no other speaker are bridged; any student (or unknown-speaker) segment, or a pause of 3 s or more, ends it. This is the median length over all of them. Null when the teacher never spoke.

- Unit: s
- Data source: transcript segments with diarized speaker labels

## `teacher_question_count`

Teacher segments labelled as any kind of question (open, closed, check-in or rhetorical). Counted on teacher-labelled segments only; one label per segment.

- Unit: count
- Data source: question labels (classifier stage) on teacher-labelled transcript segments

## `teacher_resumed_before_response_rate`

Wait time is the gap from the end of a teacher segment labelled as an open or closed question to the start of the next transcript segment by anyone (0 if it overlaps). Check-ins ("samjhe?") and rhetorical questions are excluded, since no answer is expected. Questions with no later speech in the lecture are excluded. This is the share (0–1) of those questions after which the teacher spoke again within wait_time_resume_window_ms (default 3 s) with no student speech in between. It does NOT mean the teacher answered their own question: audio timing cannot tell a self-answer from a rephrase, a hint or calling on a student.

- Unit: fraction
- Data source: question labels + transcript segment timing (speech by anyone)

## `teacher_talk_time_s`

Total time covered by teacher-labelled transcript segments (overlapping segments counted once). Includes the short pauses inside a segment.

- Unit: s
- Data source: transcript segments with diarized speaker labels

## `teacher_wpm`

Teacher words divided by teacher talk time in minutes (talk time as in teacher_talk_time_s). Null when the teacher never spoke.

- Unit: words/min
- Data source: transcript word timestamps on teacher-labelled segments

## `teacher_wpm_series`

Teacher speaking rate per time bin over the whole lecture (bin width series_bin_ms, default 60 s; the last bin may be shorter). Each bin is teacher words in the bin / teacher talk minutes in the bin. Bins with less than 5 s of teacher speech are null (too little speech for a rate), never 0.

- Unit: words/min
- Data source: transcript word timestamps on teacher-labelled segments

## `time_on_task_admin_s`

Total time of lesson sections classified as 'admin'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `time_on_task_explanation_s`

Total time of lesson sections classified as 'explanation'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `time_on_task_qa_s`

Total time of lesson sections classified as 'qa'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `time_on_task_student_practice_s`

Total time of lesson sections classified as 'student practice'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `time_on_task_unclassified_s`

Total time of lesson sections classified as 'unclassified'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `time_on_task_worked_example_s`

Total time of lesson sections classified as 'worked example'. A section runs from its start to the next section's start (the last to the end of the lecture); time before the first section counts as unclassified, so the time_on_task metrics sum to the lecture duration.

- Unit: s
- Data source: lesson structure sections (LLM-classified activity types)

## `wait_time_median_s`

Wait time is the gap from the end of a teacher segment labelled as an open or closed question to the start of the next transcript segment by anyone (0 if it overlaps). Check-ins ("samjhe?") and rhetorical questions are excluded, since no answer is expected. Questions with no later speech in the lecture are excluded. This is the median (linear interpolation).

- Unit: s
- Data source: question labels + transcript segment timing (speech by anyone)

## `wait_time_p25_s`

Wait time is the gap from the end of a teacher segment labelled as an open or closed question to the start of the next transcript segment by anyone (0 if it overlaps). Check-ins ("samjhe?") and rhetorical questions are excluded, since no answer is expected. Questions with no later speech in the lecture are excluded. This is the 25th percentile (linear interpolation).

- Unit: s
- Data source: question labels + transcript segment timing (speech by anyone)

## `wait_time_p75_s`

Wait time is the gap from the end of a teacher segment labelled as an open or closed question to the start of the next transcript segment by anyone (0 if it overlaps). Check-ins ("samjhe?") and rhetorical questions are excluded, since no answer is expected. Questions with no later speech in the lecture are excluded. This is the 75th percentile (linear interpolation).

- Unit: s
- Data source: question labels + transcript segment timing (speech by anyone)
