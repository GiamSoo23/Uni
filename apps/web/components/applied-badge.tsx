/** The Status of the Sheet row for a role already applied to, such as "Submitted". */
export function AppliedBadge({ status }: { status: string }) {
  return (
    <span
      title="From your Google Sheet"
      className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300"
    >
      {status}
    </span>
  )
}
