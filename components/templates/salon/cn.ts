/** Minimal classname joiner for the salon template (source used clsx+tw-merge). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
