import type { ReactNode } from "react";

type PublicLegalPageProps = {
  title: string;
  introduction: string;
  children: ReactNode;
};

export function PublicLegalPage({ children, introduction, title }: PublicLegalPageProps) {
  return (
    <main className="min-h-screen bg-background px-6 pb-10 pt-16 text-foreground sm:px-8 sm:pt-20 lg:px-12">
      <article className="mx-auto grid w-full max-w-3xl gap-10">
        <header className="grid gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{title}</h1>
          <p className="text-base leading-7 text-muted-foreground">{introduction}</p>
        </header>
        <div className="grid gap-8 text-base leading-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:pl-1 [&_p]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc">
          {children}
        </div>
      </article>
    </main>
  );
}
