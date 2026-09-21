import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <Image
          alt="Pagina non trovata"
          className="h-auto w-full"
          height={1254}
          priority
          src="/images/404.png"
          width={1254}
        />
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href="/"
        >
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
