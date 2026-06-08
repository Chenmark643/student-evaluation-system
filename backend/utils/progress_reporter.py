"""
Progress reporter for Eel callbacks during long operations.
"""

import eel


class ProgressReporter:
    """Wraps eel.updateProgress() calls for consistent progress reporting.

    Usage:
        reporter = ProgressReporter()
        reporter.update(10, 'Reading input files...')
        reporter.update(50, 'Processing student records...')
        reporter.done('Processing complete!')
    """

    def __init__(self):
        self.current = 0
        self.message = ''

    def update(self, percent: float, message: str = ''):
        """Report current progress percentage and status message.

        Args:
            percent: Progress percentage (0-100)
            message: Human-readable status message
        """
        self.current = min(100.0, max(0.0, percent))
        self.message = message
        try:
            eel.updateProgress(self.current, message)()
        except Exception:
            pass  # Eel might not be connected yet

    def done(self, message: str = '完成!'):
        """Mark the operation as complete."""
        self.update(100.0, message)

    def step(self, start_pct: float, end_pct: float, current_step: int,
             total_steps: int, message: str = ''):
        """Calculate progress within a sub-step range.

        Args:
            start_pct: Start of this sub-step range
            end_pct: End of this sub-step range
            current_step: Current step index (0-based)
            total_steps: Total number of steps
            message: Status message
        """
        if total_steps <= 0:
            pct = start_pct
        else:
            ratio = current_step / total_steps
            pct = start_pct + (end_pct - start_pct) * ratio
        self.update(pct, message)
