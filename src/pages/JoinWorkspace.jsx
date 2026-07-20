import JoinWorkspaceForm from '../components/JoinWorkspaceForm'

export default function JoinWorkspace({ user, onJoined }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-16">
      <p className="mb-8 text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
      <h1 className="mb-2 text-center text-2xl font-semibold text-ink">Join your workspace</h1>
      <p className="mb-8 text-center text-sm text-[#6B7280]">Enter the code your facility gave you</p>
      <JoinWorkspaceForm user={user} onSuccess={onJoined} submitLabel="Join" />
    </main>
  )
}
