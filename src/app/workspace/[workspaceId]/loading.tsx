export default function WorkspaceLoading() {
  return (
    <div
      className="flex h-full animate-pulse flex-col gap-4 bg-desktop-bg-primary p-6"
      style={{ animationDelay: "100ms", animationFillMode: "both" }}
    >
      <div className="h-8 w-1/3 rounded-xl bg-desktop-bg-secondary" />
      <div className="h-4 w-1/2 rounded-lg bg-desktop-bg-secondary" />
      <div className="mt-4 flex flex-1 gap-4">
        <div className="flex-1 rounded-2xl bg-desktop-bg-secondary" />
        <div className="w-64 rounded-2xl bg-desktop-bg-secondary" />
      </div>
    </div>
  );
}
