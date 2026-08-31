import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aeterna — Zero-Knowledge Digital Legacy" },
      {
        name: "description",
        content:
          "Aeterna is a quiet place to write down what matters, seal it behind zero-knowledge encryption, and hand it gently to the people you love when the time comes.",
      },
      { property: "og:title", content: "Aeterna — Zero-Knowledge Digital Legacy" },
      {
        property: "og:description",
        content:
          "Write down what matters, seal it behind zero-knowledge encryption, and entrust it to the people you love. Vault, Heartbeat, Handover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function SealMark({ className }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-full bg-seal/85 font-serif text-[10px] font-medium tracking-wide text-paper ${className ?? ""}`}
    >
      A
    </span>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      {/* NAV */}
      <header className="border-b border-mist/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-2.5">
            <SealMark className="size-6" />
            <span className="font-serif text-lg text-ink">Aeterna</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-cool md:flex">
            <a href="#how" className="transition hover:text-ink">
              How it works
            </a>
            <a href="#timeline" className="transition hover:text-ink">
              The timeline
            </a>
            <a href="#pricing" className="transition hover:text-ink">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden text-sm text-cool transition hover:text-ink sm:inline">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex items-center gap-1.5 rounded-[min(1vw,12px)] bg-ink py-2 pr-3 pl-2 text-sm text-paper transition hover:bg-cool"
            >
              Begin <span className="inline-block size-2 rounded-full bg-paper/50" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cool">
              <span className="size-1.5 rounded-full bg-seal" /> Zero-knowledge · We never read your
              letters
            </div>
            <h1 className="mt-6 max-w-[20ch] font-serif text-4xl leading-tight font-medium text-balance text-ink md:text-6xl">
              Your last words, sealed and entrusted.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-pretty text-cool">
              Aeterna is a quiet place to write down what matters, lock it behind a seal only time
              can open, and hand it gently to the people you love. You compose. The courier stays
              silent.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-[min(1vw,12px)] bg-ink py-2.5 pr-4 pl-4 text-sm text-paper transition hover:bg-cool"
              >
                Seal your first letter{" "}
                <span className="pulse-dot inline-block size-2 rounded-full bg-seal ring-4 ring-seal/20" />
              </Link>
              <a href="#timeline" className="py-2.5 pr-1 pl-1 text-sm text-ink transition hover:text-cool">
                See how the handover works
              </a>
            </div>
            <p className="mt-8 text-xs text-fog">
              End-to-end encrypted · No one, not even us, can open a sealed letter.
            </p>
          </div>

          {/* floating sealed envelopes */}
          <div className="relative hidden h-[420px] sm:block md:h-[520px]">
            <div className="soft-float torn absolute top-6 left-6 w-[240px] bg-paper2 p-6 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-cool">
                  Sealed · to Amara
                </span>
                <SealMark className="size-7" />
              </div>
              <p className="mt-4 font-serif text-2xl leading-snug text-ink">
                &ldquo;The garden is yours now.&rdquo;
              </p>
              <p className="mt-4 text-xs text-fog">
                Opened only after final check-in fails · Day 30
              </p>
            </div>
            <div className="torn absolute right-2 bottom-4 w-[260px] bg-mist p-6 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-cool">
                  Awaiting handover
                </span>
                <span className="pulse-dot size-2 rounded-full bg-cool" />
              </div>
              <p className="mt-4 font-serif text-xl text-ink">A note for the children</p>
              <div className="mt-4 h-1.5 w-full rounded-full bg-fog/50">
                <div className="h-1.5 w-2/3 rounded-full bg-cool" />
              </div>
              <p className="mt-2 text-xs text-fog">2 of 3 guardians confirmed</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-mist/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-[48ch]">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-cool">
              How it works
            </span>
            <h2 className="mt-4 font-serif text-3xl font-medium text-balance text-ink md:text-5xl">
              Three quiet steps, like sealing and sending a letter.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Vault",
                d: "Write your letters and choose who holds them. Every word is sealed before it ever leaves your hands.",
              },
              {
                n: "02",
                t: "Heartbeat",
                d: "A gentle check-in, on your terms. As long as the pulse holds, nothing is opened and no one is worried.",
              },
              {
                n: "03",
                t: "Handover",
                d: "If the silence stretches too long, the envelopes are opened and delivered to your guardians, one by one.",
              },
            ].map((s) => (
              <div key={s.n} className="torn bg-paper p-7 ring-1 ring-black/5">
                <span className="font-serif text-4xl text-seal/70">{s.n}</span>
                <h3 className="mt-3 font-serif text-2xl text-ink">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-pretty text-cool">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-[48ch]">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-cool">
              A quiet place to keep things
            </span>
            <h2 className="mt-4 font-serif text-3xl font-medium text-balance text-ink md:text-5xl">
              Your vault, at a calm glance.
            </h2>
          </div>

          <div className="torn mt-12 bg-paper2 p-6 ring-1 ring-black/5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-mist pb-6">
              <div className="flex items-center gap-2.5">
                <SealMark className="size-6" />
                <span className="font-serif text-lg text-ink">Your vault</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-cool">
                <span className="pulse-dot size-2 rounded-full bg-cool" /> Heartbeat healthy · next
                check-in in 3 days
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div className="torn bg-mist/40 p-5 ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-cool">
                    Financials
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-fog">Sealed</span>
                </div>
                <p className="mt-3 font-serif text-lg text-ink">4 letters</p>
                <p className="mt-1 text-xs text-fog">To R. Osei · Day 30</p>
              </div>
              <div className="torn bg-mist/40 p-5 ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-cool">
                    Social media
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-fog">Sealed</span>
                </div>
                <p className="mt-3 font-serif text-lg text-ink">9 letters</p>
                <p className="mt-1 text-xs text-fog">To guardians · Day 21</p>
              </div>
              <div className="torn bg-seal/10 p-5 ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-seal">
                    Personal messages
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-seal/70">Draft</span>
                </div>
                <p className="mt-3 font-serif text-lg text-ink">1 letter</p>
                <p className="mt-1 text-xs text-fog">To the children · unsent</p>
              </div>
            </div>

            <div className="torn mt-5 bg-mist/40 p-5 ring-1 ring-black/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-cool">
                  Check-in countdown — a small, private nudge. No one is notified until it matters.
                </p>
                <div className="flex items-center gap-3">
                  <span className="pulse-dot size-2 rounded-full bg-cool" />
                  <span className="font-serif text-2xl text-ink">3 days</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-fog/50">
                <div className="h-1.5 w-1/3 rounded-full bg-cool" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section id="timeline" className="bg-mist/40">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-cool">
              The escalation timeline
            </span>
            <h2 className="mt-4 max-w-[24ch] font-serif text-3xl font-medium text-balance text-ink md:text-5xl">
              A gentle, staged handover — never a sudden one.
            </h2>
            <p className="mt-6 max-w-[44ch] leading-relaxed text-pretty text-cool">
              Aeterna gives you room to be seen. Each step lets you step back in. Only when the
              silence holds do the letters begin to open.
            </p>
          </div>
          <div className="relative">
            <div className="absolute top-2 bottom-2 left-[7px] w-px bg-fog/60" />
            <div className="space-y-9">
              {[
                {
                  day: "Day 0",
                  title: "You are seen",
                  body: "A check-in arrives. One tap says, \"I'm here.\" Nothing is opened.",
                  dot: "bg-paper ring-2 ring-seal",
                  label: "text-cool",
                },
                {
                  day: "Day 7",
                  title: "A quiet reminder",
                  body: "If you've gone quiet, we check again, softly. You can still wave us off.",
                  dot: "bg-paper ring-2 ring-cool",
                  label: "text-cool",
                },
                {
                  day: "Day 14",
                  title: "Guardians are asked",
                  body: "A trusted guardian is quietly invited to confirm you're alright.",
                  dot: "bg-paper ring-2 ring-cool",
                  label: "text-cool",
                },
                {
                  day: "Day 21",
                  title: "Verification begins",
                  body: "Two guardians must agree. If they can't reach you, the process moves on.",
                  dot: "bg-paper ring-2 ring-cool",
                  label: "text-cool",
                },
                {
                  day: "Day 30+",
                  title: "The letters open",
                  body: "Seals are broken and each letter is delivered, gently, to its recipient.",
                  dot: "bg-seal ring-2 ring-seal/40",
                  label: "text-seal",
                },
              ].map((s) => (
                <div key={s.day} className="relative pl-9">
                  <span
                    className={`absolute top-1.5 left-0 size-[15px] rounded-full ${s.dot}`}
                  />
                  <span className={`text-xs font-medium uppercase tracking-[0.16em] ${s.label}`}>
                    {s.day}
                  </span>
                  <h3 className="mt-1 font-serif text-xl text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-pretty text-cool">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <div className="max-w-[48ch]">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-cool">
              Pricing
            </span>
            <h2 className="mt-4 font-serif text-3xl font-medium text-balance text-ink md:text-5xl">
              A quiet, honest table. No fine print, no pressure.
            </h2>
          </div>
          <div className="torn mt-12 overflow-hidden bg-paper ring-1 ring-black/5">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center gap-4 bg-mist/50 px-8 py-4 text-xs font-medium uppercase tracking-[0.14em] text-cool md:grid">
              <span />
              <span>Free</span>
              <span>Personal</span>
              <span>Family</span>
              <span>Enterprise</span>
            </div>
            {[
              ["Price", "$0", "$29/yr", "$99/yr", "Custom"],
              ["Letters you can seal", "5", "Unlimited", "Unlimited", "Unlimited"],
              ["Check-in cadence", "Weekly", "Custom", "Custom", "Custom"],
              ["Guardians included", "1", "5", "25", "Unlimited"],
              ["Priority legal review", "—", "—", "Included", "Included"],
            ].map((row, i) => (
              <div
                key={row[0]}
                className="grid gap-x-4 border-t border-mist px-8 py-6 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
              >
                {row.map((cell, j) => (
                  <span
                    key={j}
                    className={`text-sm ${
                      j === 0
                        ? "text-ink"
                        : i === 0
                          ? "text-ink"
                          : cell === "—"
                            ? "text-fog"
                            : "text-cool"
                    }`}
                  >
                    {cell}
                  </span>
                ))}
              </div>
            ))}
            <div className="grid items-center gap-x-4 border-t border-mist px-8 py-7 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
              <span className="text-sm text-ink">Start with</span>
              <Link to="/signup" className="text-sm text-ink transition hover:text-cool md:justify-self-start">
                Create free
              </Link>
              <Link to="/signup" className="text-sm text-ink transition hover:text-cool md:justify-self-start">
                Choose Personal
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-[min(1vw,12px)] bg-ink py-2 pr-4 pl-3 text-sm text-paper transition hover:bg-cool md:justify-self-start"
              >
                Choose Family
              </Link>
              <a href="#" className="text-sm text-ink transition hover:text-cool md:justify-self-start">
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ZERO KNOWLEDGE */}
      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:px-10 md:py-28 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-mistblue">
              Zero knowledge
            </span>
            <h2 className="mt-4 max-w-[22ch] font-serif text-3xl font-medium text-balance md:text-5xl">
              The courier never reads the letter.
            </h2>
            <p className="mt-6 max-w-[46ch] leading-relaxed text-pretty text-mist">
              Your letters are sealed end-to-end. We store only what we cannot open — even we could
              not read a single word, even if asked. You alone hold the key.
            </p>
          </div>
          <div className="torn bg-cool/15 p-7 ring-1 ring-paper/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-mistblue">
                Final letter · sealed
              </span>
              <SealMark className="size-7" />
            </div>
            <p className="mt-5 font-serif text-2xl leading-snug text-paper">
              &ldquo;I was here, and I was loved, and you will be fine.&rdquo;
            </p>
            <p className="mt-5 text-xs text-mistblue">
              Encrypted in your browser · key never leaves your device
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-6 py-14 md:flex-row md:items-center md:px-10">
          <div className="flex items-center gap-2.5">
            <SealMark className="size-6" />
            <span className="font-serif text-lg text-ink">Aeterna</span>
          </div>
          <p className="text-sm text-cool">
            A quiet place to entrust what matters. Zero-knowledge, always.
          </p>
          <div className="flex items-center gap-6 text-sm text-cool">
            <a href="#how" className="transition hover:text-ink">
              How it works
            </a>
            <a href="#pricing" className="transition hover:text-ink">
              Pricing
            </a>
            <a href="#" className="transition hover:text-ink">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
