import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-lg font-semibold text-white shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                MailBuddy
              </h1>
              <p className="text-sm font-medium text-slate-500">
                From inbox to action
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 sm:flex">
            Demo workspace
          </div>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
