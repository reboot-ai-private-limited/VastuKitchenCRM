import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { monthLabel, shiftMonth } from '@/lib/hr';

/** Previous / month name / next, the same control as Salary and Attendance. No upper limit: targets are set ahead. */
export function MonthStepper({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
