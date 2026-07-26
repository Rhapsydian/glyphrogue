# Glyphrogue dev-session overrides

## Deep-dive planning sessions (BACKLOG.md roadmap)

These sessions are the primary mode of work right now — no engine code
exists yet, and each session's deliverable is one `docs/design/*.md` file.
This changes what "Implement" (step 3 of the dev-session skill) means:

**Do not draft the design doc in one pass after the plan is approved.**
Plan-mode approval on this project covers the *scope and shape* of the
session (which topics, which files change) — it is explicitly **not**
approval to resolve every open decision autonomously and hand back a
finished doc. Work through the plan's decision points one at a time in
conversation: state the question/tension, give a recommendation with
reasoning, and let the user weigh in or redirect before moving to the next
one and before writing doc prose. Only write the actual
`docs/design/*.md` content once the decisions it depends on have been
talked through, not as a batch step at the end.

This applies even when the plan file itself already states this process
(don't let an approved plan's own "work through this in conversation" step
get silently skipped in favor of just executing straight through).

## Everything else

No other overrides — standard dev-session defaults apply (verify,
commit locally only, session-close-out on wrap-up, etc.).
