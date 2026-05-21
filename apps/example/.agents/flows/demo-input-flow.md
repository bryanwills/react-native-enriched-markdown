# Demo Input Flow

Demonstrates mentions, channel mentions, bold, underline, spoiler formatting, and channel navigation.

## Execution Prerequisite

App is open on the home screen (or any tab). Simulator is booted and Metro is running.

## Steps

### Part 1 — Navigate to Input tab and scroll to bottom

1. Tap the **Input** tab in the bottom navigation bar.
2. PAUSE — wait for user to start screen recording before continuing.
3. Scroll down slowly until the very bottom of the message list.

### Part 2 — Type spoiler text (under bold "Do not MISS")

4. Tap the message input area at the bottom of the screen to focus it and reveal the keyboard.
5. Type the markdown spoiler text:
   `||spoiler text||`
   (This renders as a spoiler under the bold "Do not MISS" message in the list.)

### Part 3 — Compose message with mentions, bold, channel mention, underline

6. Type `@` — the **mentions autocomplete window** should open.
7. Tap **Alice** in the mentions list.
8. Type `let's ` (with a trailing space).
9. Press the **Bold** toolbar button (B icon) to enable bold.
10. Type `meet`.
11. Press the **Bold** toolbar button again to disable bold.
12. Type ` at ` then `#` — the **channel mentions autocomplete window** should open.
13. Tap **#swm-stand** in the channel list.
14. Press the **Underline** toolbar button (U icon) to enable underline.
15. Type `before the talk`.
16. Press the **Underline** toolbar button again to disable underline.
17. Type `!`.

### Part 4 — Send the message

18. Tap the **Send** button (arrow icon, bottom right of the input area).
19. Wait ~500 ms for the message to appear in the list.

### Part 5 — Open #swm-stand channel and reveal spoiler

20. Tap the **#swm-stand** channel mention in the message that was just sent.
21. Wait for the channel screen to fully open/animate in.
22. Scroll to the **bottom** of the channel message list.
23. Tap the **spoiler** element under the bold **"Update"** message to reveal it.

## Notes

- Step 2 (pause) should be handled with a `flow-add-echo` marker so the live recording pauses naturally for the user to start their screen recorder before automation resumes.
- When re-recording, use `describe` or `debugger-component-tree` before every tap to get fresh coordinates — never reuse old ones.
- Flow name for Argent: `demo-input-flow`
- Expected final state: #swm-stand channel open, spoiler revealed at bottom.
