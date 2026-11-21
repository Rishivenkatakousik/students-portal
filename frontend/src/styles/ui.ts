// Tailwind class lists for building blocks used on several pages, so each
// page reads as layout rather than a wall of repeated utilities.

// Each size is a complete class list. Tailwind can't override one utility
// by adding another (e.g. min-h-10 then min-h-8): the winner depends on
// stylesheet order, not markup order. So sizes are chosen, never stacked.
const button =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-semibold no-underline disabled:cursor-not-allowed disabled:opacity-55'
const regular = 'min-h-10 px-4'
const small = 'min-h-8 px-2.5 text-sm'
const primary = 'border-accent bg-accent text-white hover:bg-accent-hover'
const secondary = 'border-line bg-white text-ink hover:bg-subtle'
export const btnPrimary = `${button} ${regular} ${primary}`
export const btnSecondary = `${button} ${regular} ${secondary}`
export const btnPrimarySmall = `${button} ${small} ${primary}`
export const btnSecondarySmall = `${button} ${small} ${secondary}`

export const card = 'rounded-xl border border-line bg-white p-5 shadow-sm print:shadow-none'
export const stateCard = `${card} px-4 py-12 text-center`
export const stateText = 'mb-5 text-muted'

export const alertError = 'my-4 rounded-lg border border-danger-line bg-danger-soft px-4 py-3.5 text-danger'
export const alertSuccess = 'my-4 rounded-lg border border-success-line bg-success-soft px-4 py-3.5 text-success'

const badge = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold'
export const badgePass = `${badge} bg-success-soft text-success`
export const badgeFail = `${badge} bg-danger-soft text-danger`

export const control = 'min-h-10 rounded-lg border border-line bg-white px-3 text-ink'

export const tableWrap = 'overflow-x-auto rounded-xl border border-line bg-white print:break-inside-avoid'

export const table = [
  'w-full border-collapse text-[0.95rem]',
  '[&_th]:border-b [&_th]:border-line [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:whitespace-nowrap',
  '[&_thead_th]:bg-subtle [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-wide [&_thead_th]:text-muted [&_thead_th]:uppercase',
  '[&_td]:border-b [&_td]:border-line [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:whitespace-nowrap',
  '[&_tbody_tr:last-child>*]:border-b-0',
].join(' ')

/** A table that turns into labelled cards on narrow screens (cells need data-label). */
export const stackedTable = [
  table,
  'max-sm:[&_thead]:sr-only',
  'max-sm:[&_tbody_tr]:block max-sm:[&_tbody_tr]:border-b max-sm:[&_tbody_tr]:border-line max-sm:[&_tbody_tr]:px-3.5 max-sm:[&_tbody_tr]:py-2.5 max-sm:[&_tbody_tr:last-child]:border-b-0',
  'max-sm:[&_td]:grid max-sm:[&_td]:grid-cols-[7.5rem_minmax(0,1fr)] max-sm:[&_td]:gap-2 max-sm:[&_td]:border-0 max-sm:[&_td]:px-0 max-sm:[&_td]:py-0.5 max-sm:[&_td]:whitespace-normal',
  'max-sm:[&_td]:before:text-xs max-sm:[&_td]:before:font-semibold max-sm:[&_td]:before:text-muted max-sm:[&_td]:before:content-[attr(data-label)]',
  'max-sm:[&_td>*]:justify-self-start',
].join(' ')

export const skeleton =
  'inline-block h-3 animate-shimmer rounded bg-[linear-gradient(90deg,var(--color-subtle)_25%,#e6e8f0_50%,var(--color-subtle)_75%)] bg-size-[200%_100%] motion-reduce:animate-none'

export const spinner = 'size-4 animate-spin rounded-full border-2 border-white/40 border-t-white'
