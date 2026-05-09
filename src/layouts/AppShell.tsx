import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="flex items-center gap-6 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-base font-semibold text-white shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                MailBuddy
              </h1>
              <p className="mt-1 text-base font-medium text-slate-500">
                From inbox to action
              </p>
            </div>
          </div>
        </div>
      </header>

      <main>
        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
