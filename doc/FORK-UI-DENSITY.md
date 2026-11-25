# UI density requirement (fork standing rule)

Added 2026-11-26 at Trevor's request. Applies to every new or changed screen in this fork.

Paperclip should feel like the Claude app: compact, calm and efficient with screen space. Current Inbox decision cards (large bordered boxes, big black buttons, generous whitespace) are the reference for what to move away from.

## Rules

1. **Rows before cards.** Lists of tasks, decisions, runs and history render as compact rows (≈32–40px, `py-1.5`, a hairline divider) rather than padded bordered cards. Use a card only when the item needs inline interaction such as a form or answer choices.
2. **Small, quiet actions.** Row actions are `size="sm"` ghost or text buttons, or a plain link with an arrow. Primary filled buttons are reserved for the single main action of a page or dialog.
3. **Tight type scale.** Body and list text `text-sm`; secondary lines `text-xs text-muted-foreground`; section headings `text-sm font-semibold`, never `text-lg` inside a page. One `text-xl` page title at most.
4. **Tight spacing.** Section gaps `space-y-4/5`, intra-section `space-y-1.5`. Card padding no more than `p-3`; never `p-6` in lists.
5. **One line where possible.** Truncate long titles with `truncate` and join secondary facts with " · " on one line instead of stacking paragraphs.
6. **Use the width.** Prefer multi-column grids for parallel lists (Blocked / In progress / Completed) on desktop; collapse to one column on mobile.
7. **Repeat nothing.** Don't show the same title twice in one item (e.g. a heading plus a task link with the same text).

## Review checklist

Before merging a UI PR, compare the screen against the Claude app at the same window size: is anything bigger, taller or louder than it needs to be?
