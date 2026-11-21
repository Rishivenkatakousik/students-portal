import { ArrowUpRight, GraduationCap } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-full px-4 py-2 text-sm font-medium no-underline transition-colors max-[420px]:px-3',
    isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
  )
}

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-10 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="px-4 pt-5 print:hidden">
        <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 rounded-full border bg-card py-2 pr-2 pl-4">
          <Link
            to="/students"
            className="inline-flex items-center gap-2.5 font-display text-base font-semibold tracking-tight no-underline"
          >
            <span
              className="inline-flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <GraduationCap className="size-[18px]" />
            </span>
            Results Portal
          </Link>
          <nav aria-label="Main" className="flex gap-1 rounded-full border bg-background p-1">
            <NavLink to="/import" className={navLinkClass}>
              Import
            </NavLink>
            <NavLink to="/students" className={navLinkClass}>
              Students
            </NavLink>
          </nav>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground no-underline hover:text-foreground md:inline-flex"
          >
            API docs <ArrowUpRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </header>
      </div>
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pt-12 pb-16 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </>
  )
}
