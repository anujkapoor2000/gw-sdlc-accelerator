Drop demo recordings here, named by agent id:

  story-forge.gif
  code-review.gif            ← included (generated)
  test-strategist.gif
  release-navigator.gif
  defect-triage.gif          ← included (generated)

The showcase page checks for /media/<id>.gif and uses it automatically;
if absent, the built-in animated preview renders instead.
Recommended: ~800px wide, under 4 MB, 10-20s loop.

Regenerate:
  python scripts/generate-code-review-gif.py
  python scripts/generate-defect-triage-gif.py
