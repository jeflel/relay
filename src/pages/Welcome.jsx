import { Button } from '@/components/ui/button'

export default function Welcome({ fullName, workspaceName, onContinue }) {
  const firstName = fullName?.trim().split(' ')[0] || 'there'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 pb-16 text-center">
      <h1 className="text-3xl font-bold text-ink">Welcome, {firstName}.</h1>
      <p className="mt-3 text-lg text-[#6B7280]">You're all set at {workspaceName}.</p>
      <Button
        type="button"
        onClick={onContinue}
        className="mt-16 h-auto w-full rounded-full bg-ink px-4 py-4 text-base font-semibold text-white hover:bg-ink/90"
      >
        Let's go
      </Button>
    </main>
  )
}
