export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-line bg-card p-5 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
    </article>
  );
}
