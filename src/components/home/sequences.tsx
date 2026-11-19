"use client";

import {
  bakingFramePath,
  doughFramePath,
  removingFramePath,
  toppingsFramePath,
} from "@/lib/frames";
import { BlueprintCard, SequenceSection, StageIcon, type CardContext, type Stage } from "./SequenceSection";

const ICONS = {
  code: <StageIcon strokeWidth={2.5} d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />,
  brush: (
    <StageIcon
      d={[
        "M9.53 16.122A3 3 0 0 0 12.879 17l4.99-4.997a3 3 0 0 0 0-4.244L12.88 2.77a3 3 0 0 0-4.243 0L3.647 7.763a3 3 0 0 0 0 4.244l1.282 1.283A16.2 16.2 0 0 0 9.53 16.12Z",
        "m18.5 11.5 3 3L17 19l-3-3",
      ]}
    />
  ),
  bolt: <StageIcon d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
  cloud: (
    <StageIcon d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
  ),
  database: (
    <StageIcon d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
  ),
  grid: (
    <StageIcon d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5z" />
  ),
  badge: (
    <StageIcon d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12z" />
  ),
  flame: (
    <StageIcon
      d={[
        "M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18z",
        "M12 2.25V5.25M12 18.75V21.75M5.25 12H2.25M21.75 12H18.75M18.894 5.106l-2.122 2.122M7.228 16.772l-2.122 2.122M18.894 18.894l-2.122-2.122M7.228 7.228l-2.122-2.122",
      ]}
    />
  ),
  globe: (
    <StageIcon d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
  ),
  lock: (
    <StageIcon d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
  ),
  network: (
    <StageIcon d="M9 9l10.5-3m0 0L21 9M19.5 6L15 15M9 15l-3-6m0 0L3 12m3-3L15 6M9 9V2.25m0 6.75L3.75 6.75M9 15H3.75M9 15v6.75M9 15l6.75-6.75M15 15l6.75 4.5M15 15v6.75" />
  ),
  eye: (
    <StageIcon
      d={[
        "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z",
        "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
      ]}
    />
  ),
  squares: (
    <StageIcon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25z" />
  ),
  share: (
    <StageIcon d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185z" />
  ),
};

const FILE_CLASSES = ["text-smoke-light", "text-oven-orange", "text-cream"] as const;
const codeSize = (variant: CardContext["variant"]) =>
  variant === "mobile" ? "space-y-0.5 leading-none text-[10px]" : "space-y-0.5 mb-3 text-xs lg:text-[13px]";

/* ───────────────────────── Dough ───────────────────────── */

const DOUGH_STAGES: [Stage, Stage, Stage] = [
  {
    title: "HTML Structure",
    summary: "Forming the raw, semantic bones and wireframe skeleton.",
    detail:
      "Forming the raw, semantic bones and wireframe skeleton. Every great website starts with a solid HTML foundation — structuring content with meaning and purpose.",
    icon: ICONS.code,
  },
  {
    title: "CSS Styling",
    summary: "Styling layouts, adding warm ambient themes and aesthetics.",
    detail:
      "Styling layouts, adding warm ambient themes and aesthetics. We layer color, spacing, and typography to transform bare markup into a visual masterpiece.",
    icon: ICONS.brush,
  },
  {
    title: "JavaScript Interactivity",
    summary: "Breathing dynamic life and reactive pulses into the website.",
    detail:
      "Breathing dynamic life and reactive pulses into the website. Interactions, animations, and real-time behavior bring every element to life.",
    icon: ICONS.bolt,
  },
];

function PizzaBoxPreview({ variant, active }: { variant: CardContext["variant"]; active: boolean }) {
  const mobile = variant === "mobile";
  return (
    <div
      className={`${mobile ? "mt-2 p-2 rounded leading-none" : "mt-4 p-4 rounded-xl"} bg-[#FFF8F0] text-stone-900 ${active ? "border-2 border-[#E87040] relative overflow-hidden" : "border border-amber-200/50"} flex flex-col justify-between items-center transition-all duration-300`}
    >
      <div className="flex justify-between w-full border-b border-amber-100 pb-1.5 mb-1.5">
        <span className={`font-serif font-bold text-stone-800 ${mobile ? "text-[11px] leading-none" : "text-[13px] lg:text-[15px]"}`}>
          PizzaScript
        </span>
        <span className={`text-stone-500 ${mobile ? "text-[10px] leading-none" : "text-[11px] lg:text-[12px]"}`}>Menu</span>
      </div>
      <span
        className={`${mobile ? "text-[9.5px] leading-none" : "text-[11px] lg:text-[12px]"} uppercase tracking-widest ${active ? "font-semibold text-orange-600" : "text-stone-500"}`}
      >
        {active ? "Interactivity Active" : "Handcrafted Polish Applied"}
      </span>
      <span
        className={`${mobile ? "mt-1.5 px-2 py-0.5 text-[9.5px] leading-none" : "mt-2.5 px-3 py-1 text-[11px] lg:text-[12px]"} bg-[#E87040] text-white font-bold rounded uppercase tracking-wider ${active ? "relative overflow-hidden" : ""}`}
      >
        Order
        {active && <span className="absolute inset-0 bg-white/20 animate-ping rounded" />}
      </span>
    </div>
  );
}

function DoughCard({ stage, variant }: CardContext) {
  const mobile = variant === "mobile";
  if (stage === 0) {
    return (
      <BlueprintCard stage={0} variant={variant} file="index.html" fileClassName={FILE_CLASSES[0]} comment="<!-- Forming the raw, semantic bones and wireframe skeleton. -->">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>
            <span className="text-orange-400">&lt;div</span> class=<span className="text-amber-200">&quot;pizza-box&quot;</span>
            <span className="text-orange-400">&gt;</span>
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-orange-400">&lt;h1&gt;</span>PizzaScript<span className="text-orange-400">&lt;/h1&gt;</span>
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-orange-400">&lt;button&gt;</span>Order<span className="text-orange-400">&lt;/button&gt;</span>
          </div>
          <div>
            <span className="text-orange-400">&lt;/div&gt;</span>
          </div>
        </div>
        <div
          className={`border border-dashed border-stone-800 text-center rounded text-stone-500 font-bold uppercase tracking-wider ${mobile ? "mt-2 p-2 text-[9.5px] leading-none" : "mt-4 p-4 text-xs lg:text-sm"}`}
        >
          [ Raw Wireframe Skeleton ]
        </div>
      </BlueprintCard>
    );
  }
  if (stage === 1) {
    return (
      <BlueprintCard stage={1} variant={variant} file="style.css" fileClassName={FILE_CLASSES[1]} comment="/* Styling layouts, adding warm ambient themes and aesthetics. */">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>
            <span className="text-amber-200">.pizza-box</span> &#123;
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-orange-400">background</span>: var(--color-cream);
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-orange-400">border-radius</span>: 24px;
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-orange-400">color</span>: var(--color-charcoal);
          </div>
          <div>&#125;</div>
        </div>
        <PizzaBoxPreview variant={variant} active={false} />
      </BlueprintCard>
    );
  }
  return (
    <BlueprintCard stage={2} variant={variant} file="app.js" fileClassName={FILE_CLASSES[2]} comment="// Breathing dynamic life and reactive pulses into the website.">
      <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
        <div>
          btn.<span className="text-orange-300">addEventListener</span>(<span className="text-amber-200">&apos;click&apos;</span>, () =&gt; &#123;
        </div>
        <div>
          &nbsp;&nbsp;<span className="text-blue-300">oven</span>.<span className="text-orange-300">ignite</span>();
        </div>
        <div>
          &nbsp;&nbsp;<span className="text-orange-300">animateDough</span>();
        </div>
        <div>&#125;);</div>
      </div>
      <PizzaBoxPreview variant={variant} active />
    </BlueprintCard>
  );
}

export function DoughSection() {
  return (
    <SequenceSection
      id="dough"
      eyebrow="The Foundation"
      heading={
        <>
          Watch the <span className="italic text-oven-orange">Dough Rise</span>
        </>
      }
      description="Every great website starts with a solid foundation. We knead each layer with care, letting the HTML, CSS, and JavaScript elements rise naturally into an interactive masterpiece."
      stages={DOUGH_STAGES}
      frameCount={100}
      framePath={doughFramePath}
      visualSide="right"
      renderCard={DoughCard}
    />
  );
}

/* ───────────────────────── Toppings ───────────────────────── */

const TOPPINGS_STAGES: [Stage, Stage, Stage] = [
  {
    title: "Dynamic APIs",
    summary: "Fetching dynamic ingredients and content payloads in real time.",
    detail:
      "Fetching dynamic ingredients and content payloads in real time. We integrate server endpoints to deliver fresh database content instantly.",
    icon: ICONS.cloud,
  },
  {
    title: "Relational Schemas",
    summary: "Mapping database records to structure ingredients correctly.",
    detail:
      "Mapping database records to structure ingredients correctly. Robust data modeling ensures fast queries and smooth relational data integrity.",
    icon: ICONS.database,
  },
  {
    title: "Spring Animations",
    summary: "Styling dynamic gestures and micro-transitions for premium feel.",
    detail:
      "Styling dynamic gestures and micro-transitions for premium feel. We apply fluid spring physics and hover states to hook users and elevate interface feel.",
    icon: ICONS.bolt,
  },
];

function ToppingsCard({ stage, variant }: CardContext) {
  const mobile = variant === "mobile";
  if (stage === 0) {
    return (
      <BlueprintCard stage={0} variant={variant} file="api_fetcher.ts" fileClassName={FILE_CLASSES[0]} comment="// Fetching dynamic ingredients and content payloads in real time.">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>
            <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span>{" "}
            <span className="text-orange-300">fetch</span>(<span className="text-amber-200">&apos;/api/toppings&apos;</span>);
          </div>
          <div>
            <span className="text-purple-400">const</span> toppings = <span className="text-purple-400">await</span> res.json();
          </div>
        </div>
        {mobile ? (
          <div className="mt-2 p-2 rounded bg-black/60 border border-stone-800 font-mono text-[9.5px] leading-none space-y-1">
            <div className="flex justify-between border-b border-stone-900 pb-1.5 mb-1.5">
              <span className="text-green-500">[GET] /api/toppings</span>
              <span className="text-stone-600">200ms</span>
            </div>
            <div className="text-stone-400 text-[9px] leading-none whitespace-nowrap overflow-hidden text-ellipsis">
              {`[{"id":"db_top_01","name":"Fresh Basil","quantity":12}]`}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-black/60 border border-stone-800/80 font-mono text-xs lg:text-[13px] space-y-1 text-stone-400">
            {[
              ["mozzarella", "200ms"],
              ["pepperoni", "180ms"],
              ["fresh_basil", "120ms"],
            ].map(([name, ms]) => (
              <div className="flex justify-between" key={name}>
                <span className="text-green-500">[GET] /api/toppings/{name}</span>
                <span className="text-stone-600">{ms}</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-stone-900 text-stone-500 text-[11px] lg:text-[12px]">
              Response payload loaded. Status: OK.
            </div>
          </div>
        )}
      </BlueprintCard>
    );
  }
  if (stage === 1) {
    return (
      <BlueprintCard stage={1} variant={variant} file="schema.prisma" fileClassName={FILE_CLASSES[1]} comment="// Mapping database records to structure ingredients correctly.">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>
            model <span className="text-yellow-300">Topping</span> &#123;
          </div>
          <div>
            &nbsp;&nbsp;id&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-300">String</span>&nbsp;&nbsp;&nbsp;@id @default(uuid())
          </div>
          <div>
            &nbsp;&nbsp;name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-300">String</span>
          </div>
          <div>
            &nbsp;&nbsp;quantity&nbsp;&nbsp;<span className="text-blue-300">Int</span>
          </div>
          <div>&#125;</div>
        </div>
        <div
          className={`${mobile ? "mt-2 p-2 rounded text-[9.5px] space-y-1" : "p-3 rounded-lg text-xs lg:text-[13px] space-y-2"} bg-black/40 border border-amber-900/20 font-mono`}
        >
          <div className="flex justify-between items-center text-amber-100">
            <span className="font-bold">TABLE: toppings</span>
            <span className="text-stone-600">PostgreSQL</span>
          </div>
          <div className={`grid grid-cols-2 gap-1 text-stone-400 ${mobile ? "text-[9px] leading-none" : "text-[11px] lg:text-[12px]"}`}>
            <div>🔑 id [PK]</div>
            <div className="text-right">&quot;db_top_01&quot;</div>
            <div>🍕 name</div>
            <div className="text-right">&quot;Fresh Basil&quot;</div>
            <div>📦 quantity</div>
            <div className="text-right">12</div>
          </div>
        </div>
      </BlueprintCard>
    );
  }
  return (
    <BlueprintCard stage={2} variant={variant} file="animation.ts" fileClassName={FILE_CLASSES[2]} comment="// Styling dynamic gestures and micro-transitions for premium feel.">
      <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
        <div>
          <span className="text-orange-300">animate</span>(toppingElement, &#123;
        </div>
        <div>
          &nbsp;&nbsp;y: [ -<span className="text-amber-200">200</span>, <span className="text-amber-200">0</span> ],
        </div>
        <div>
          &nbsp;&nbsp;transition: &#123; type: <span className="text-amber-200">&apos;spring&apos;</span>, stiffness:{" "}
          <span className="text-amber-200">120</span> &#125;
        </div>
        <div>&#125;);</div>
      </div>
      <div className={`${mobile ? "h-10 mt-2 px-3" : "h-16 px-4"} relative bg-black/60 rounded border border-stone-800 flex items-end overflow-hidden`}>
        <svg className="w-full h-full" viewBox="0 0 100 40">
          <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,248,240,0.05)" strokeDasharray="3,3" />
          <path
            d="M 0 35 Q 25 -10 50 25 T 75 20 T 100 20"
            fill="none"
            stroke="var(--color-oven-orange)"
            strokeWidth={mobile ? 1.5 : 2}
            className="animate-[dash_2s_infinite_linear]"
          />
        </svg>
        <span className={`absolute font-mono text-stone-500 ${mobile ? "bottom-1 right-2 text-[8.5px]" : "bottom-2 right-3 text-[10px]"}`}>
          bounce: 0.25
        </span>
      </div>
    </BlueprintCard>
  );
}

export function ToppingsSection() {
  return (
    <SequenceSection
      id="toppings"
      eyebrow="Branding & Features"
      heading={
        <>
          Add the <span className="italic text-oven-orange">Flavours</span>
        </>
      }
      description="Layering key features onto your site. Custom API integrations, structured database schemas, and smooth spring physics animations placed with pinpoint precision."
      stages={TOPPINGS_STAGES}
      frameCount={100}
      framePath={toppingsFramePath}
      visualSide="left"
      renderCard={ToppingsCard}
    />
  );
}

/* ───────────────────────── Baking ───────────────────────── */

const BAKING_STAGES: [Stage, Stage, Stage] = [
  {
    title: "Bundle Compilation",
    summary: "Shrinking asset size overheads and minifying client scripts.",
    detail:
      "Shrinking asset size overheads and minifying client scripts. We run production compilers to compress asset footprints and speed up loading.",
    icon: ICONS.grid,
  },
  {
    title: "Automated Test Suites",
    summary: "Simulating layout integrity, routing safety, and callback responses.",
    detail:
      "Simulating layout integrity, routing safety, and callback responses. Strict test coverage ensures every user interaction works flawlessly under stress.",
    icon: ICONS.badge,
  },
  {
    title: "Lighthouse Audits",
    summary: "Fine-tuning indices to hit absolute 100/100 performance scores.",
    detail:
      "Fine-tuning indices to hit absolute 100/100 performance scores. Optimizing images, metadata, and scripts to achieve the perfect web audit rating.",
    icon: ICONS.flame,
  },
];

function LighthouseGauge({ score, size }: { score: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" className="transform -rotate-90">
      <circle cx="45" cy="45" r="36" className="lighthouse-circle-bg" />
      <circle
        cx="45"
        cy="45"
        r="36"
        className="lighthouse-circle-fill"
        style={{ strokeDasharray: "226", strokeDashoffset: String(226 - (226 * score) / 100) }}
      />
    </svg>
  );
}

function BakingCard({ stage, variant, progress }: CardContext) {
  const mobile = variant === "mobile";
  const score = progress < 0.7 ? 0 : Math.min(100, Math.floor(80 + ((progress - 0.7) / 0.3) * 20));
  if (stage === 0) {
    return (
      <BlueprintCard stage={0} variant={variant} file="build.log" fileClassName={FILE_CLASSES[0]} comment="// Shrinking asset size overheads and minifying client scripts.">
        {mobile ? (
          <div className="font-mono text-stone-400 text-[10px] space-y-1 leading-none text-left">
            <div>next build — compiling production bundle...</div>
            <div className="flex justify-between">
              <span>style.css</span> <span>73.6KB → 33.1KB</span>
            </div>
            <div className="flex justify-between">
              <span>app.js</span> <span>2.4MB → 359KB</span>
            </div>
          </div>
        ) : (
          <div className="font-mono text-stone-500 text-xs lg:text-[13px] space-y-2">
            <div>next build — compiling production bundle...</div>
            <div className="flex justify-between text-stone-400">
              <span>✓ index.html</span>
              <span className="text-stone-500">2.3 kB</span>
            </div>
            {[
              ["style.css", "73.6 KB → 33.1 KB", "w-[45%]"],
              ["app-bundle.js", "2.4 MB → 359.0 KB", "w-[15%]"],
            ].map(([file, size, width]) => (
              <div className="space-y-1" key={file}>
                <div className="flex justify-between items-center text-amber-200">
                  <span>{file}</span>
                  <span>{size}</span>
                </div>
                <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                  <div className={`h-full bg-oven-orange ${width}`} />
                </div>
              </div>
            ))}
            <div className="text-xs lg:text-[11px] text-green-500 pt-1 border-t border-stone-800/80">
              Compression done. All assets generated successfully.
            </div>
          </div>
        )}
      </BlueprintCard>
    );
  }
  if (stage === 1) {
    const files = mobile
      ? ["DoughSection.test.tsx", "Toppings.test.tsx", "Baking.test.tsx"]
      : ["src/sections/DoughSection.test.tsx", "src/sections/ToppingsSection.test.tsx", "src/hooks/useImageSequence.test.ts"];
    return (
      <BlueprintCard stage={1} variant={variant} file="vitest --run" fileClassName={FILE_CLASSES[1]} comment="// Simulating layout integrity, routing safety, and callback responses.">
        <div
          className={`${mobile ? "p-2 rounded text-[9.5px] leading-none space-y-1.5" : "p-3 rounded-lg text-xs lg:text-[13px] space-y-1.5"} bg-black/50 border border-stone-800 font-mono text-stone-400`}
        >
          {files.map((file) => (
            <div className="flex items-center gap-2" key={file}>
              <span className={`px-1.5 py-0.5 bg-green-900/60 text-green-400 rounded font-bold ${mobile ? "text-[9px]" : "text-[10px] lg:text-[11px]"}`}>
                PASS
              </span>
              <span>{file}</span>
            </div>
          ))}
          {!mobile && (
            <div className="pt-2 border-t border-stone-900 text-xs lg:text-[12px] text-stone-300">
              Test Suites: <span className="text-green-400 font-bold">3 passed</span>, 3 total
              <br />
              Tests: <span className="text-green-400 font-bold">12 passed</span>, 12 total
            </div>
          )}
        </div>
      </BlueprintCard>
    );
  }
  if (mobile) {
    return (
      <BlueprintCard stage={2} variant={variant} file="lighthouse_audit.json" fileClassName={FILE_CLASSES[2]} comment="/* Fine-tuning indices to hit absolute 100/100 performance scores. */">
        <div className="flex items-center justify-between w-full flex-1 mt-1 p-1 bg-black/30 rounded border border-stone-900/20">
          <div className="flex flex-col space-y-1 leading-none text-[9.5px] text-stone-400">
            <div className="font-mono text-cream font-bold mb-0.5">Lighthouse score</div>
            <div>
              Performance: <span className="text-green-400">{score}</span>
            </div>
            <div>
              Best Practices: <span className="text-green-400">100</span>
            </div>
            <div>
              SEO &amp; Access: <span className="text-green-400">100</span>
            </div>
          </div>
          <div className="lighthouse-gauge flex items-center justify-center relative w-12 h-12 mr-2">
            <LighthouseGauge score={score} size={48} />
            <div className="lighthouse-value font-mono text-[10px] absolute">{score}</div>
          </div>
        </div>
      </BlueprintCard>
    );
  }
  return (
    <div className="blueprint-card js-state animate-fade-in flex items-center justify-between">
      <div className="flex flex-col space-y-2">
        <div className="font-mono text-cream text-xs lg:text-sm">Lighthouse Audit Report</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs lg:text-[13px] text-stone-400 font-mono">
          {[
            ["Performance", score],
            ["Accessibility", 100],
            ["Best Practices", 100],
            ["SEO Index", 100],
          ].map(([label, value]) => (
            <div className="contents" key={label}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>{label}</span>
              </div>
              <span className="text-green-400 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="lighthouse-gauge flex items-center justify-center">
        <LighthouseGauge score={score} size={90} />
        <div className="lighthouse-value font-mono">{score}</div>
      </div>
    </div>
  );
}

export function BakingSection() {
  return (
    <SequenceSection
      id="baking"
      eyebrow="Optimization & Testing"
      heading={
        <>
          Into the <span className="italic text-oven-glow">Oven</span>
        </>
      }
      description="The heat transforms raw elements. We run performance compilers, compress static bundle file sizes, run strict unit test pipelines, and optimize Lighthouse criteria until they are golden."
      stages={BAKING_STAGES}
      frameCount={100}
      framePath={bakingFramePath}
      visualSide="right"
      visualClassName={() => "css-active js-active relative overflow-hidden"}
      visualOverlay={<div className="cin-oven-glow" />}
      renderCard={BakingCard}
    />
  );
}

/* ───────────────────────── Removing (Launch) ───────────────────────── */

const REMOVING_STAGES: [Stage, Stage, Stage] = [
  {
    title: "DNS Configuration",
    summary: "Mapping domain records to host names and server target IPs.",
    detail:
      "Mapping domain records to host names and server target IPs. Connecting your custom domain to edge platforms ensures instant global resolution.",
    icon: ICONS.globe,
  },
  {
    title: "SSL Handshake",
    summary: "Provisioning cryptographic keys and locking certificate authorities.",
    detail:
      "Provisioning cryptographic keys and locking certificate authorities. Activating end-to-end TLS encryption keeps user data secure and builds trust.",
    icon: ICONS.lock,
  },
  {
    title: "Edge CDN Delivery",
    summary: "Replicating sites globally to cache resources close to visitors.",
    detail:
      "Replicating sites globally to cache resources close to visitors. Serving assets from local edge nodes minimizes latency for global users.",
    icon: ICONS.network,
  },
];

function DnsRecord({ label, value, resolved, mobile }: { label: string; value: string; resolved: boolean; mobile: boolean }) {
  return (
    <div className={`dns-record ${resolved ? "resolved" : ""} ${mobile ? "flex justify-between p-1.5 rounded border border-stone-800" : ""}`}>
      <span className="text-stone-400">{label}</span>
      <span className={resolved ? "text-green-400 font-semibold" : "text-stone-600"}>{resolved ? `✓ ${value}` : "Resolving..."}</span>
    </div>
  );
}

const LOCK_CLOSED = "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z";
const LOCK_OPEN = "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z";

function RemovingCard({ stage, variant, progress }: CardContext) {
  const mobile = variant === "mobile";
  if (stage === 0) {
    return (
      <BlueprintCard stage={0} variant={variant} file="dns_resolver.log" fileClassName={FILE_CLASSES[0]} comment="// Mapping domain records to host names and server target IPs.">
        <div className={`font-mono ${mobile ? "mt-2 space-y-1 text-[9.5px] leading-none" : "space-y-1.5 text-xs lg:text-[13px]"}`}>
          <DnsRecord label="A pizzascript.com" value="76.76.21.21" resolved={progress >= 0.15} mobile={mobile} />
          <DnsRecord label="CNAME www.pizzascript.com" value="cname.vercel-dns.com" resolved={progress >= 0.28} mobile={mobile} />
        </div>
      </BlueprintCard>
    );
  }
  if (stage === 1) {
    if (mobile) {
      return (
        <BlueprintCard stage={1} variant={variant} file="ssl_handshake.sh" fileClassName={FILE_CLASSES[1]} comment="// Provisioning cryptographic keys and locking certificate authorities.">
          <div className="mt-2 p-2 rounded bg-black/40 border border-stone-800 flex items-center justify-between font-mono text-[9.5px]">
            <div className="flex flex-col space-y-1 text-[9px]">
              <div className="font-mono text-oven-orange font-bold mb-0.5">SSL Certificate</div>
              <div>Issuer: Let&apos;s Encrypt</div>
              <div>Protocol: TLS 1.3</div>
              <div>
                Status: <span className="text-green-400 font-bold animate-pulse">SECURED</span>
              </div>
            </div>
            <div className="flex items-center justify-center p-1.5 rounded-full bg-green-950/20 border border-green-800/30 text-green-400 w-8 h-8">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={LOCK_CLOSED} />
              </svg>
            </div>
          </div>
        </BlueprintCard>
      );
    }
    const locked = progress >= 0.52;
    return (
      <div className="blueprint-card css-state animate-fade-in flex items-center justify-between">
        <div className="flex flex-col space-y-1.5">
          <div className="font-mono text-oven-orange text-[12px] lg:text-sm">SSL Certificate Authority</div>
          <div className="font-mono text-xs lg:text-[12px] text-stone-400 space-y-0.5">
            <div>Issuer: Let&apos;s Encrypt Authority</div>
            <div>Protocol: TLS 1.3 Handshake</div>
            <div>Key Strength: RSA-2048</div>
            <div>
              Status: <span className="text-green-400 font-bold">SECURED</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-3 rounded-full bg-green-950/20 border border-green-800/30 text-green-400">
          <svg
            className={`w-8 h-8 ${locked ? "scale-110 opacity-100" : "scale-95 opacity-60"} transition-all duration-300`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={locked ? LOCK_CLOSED : LOCK_OPEN} />
          </svg>
        </div>
      </div>
    );
  }
  const regions = mobile ? ["US-EAST-1", "AP-SOUTH-1"] : ["US-EAST-1", "EU-CENTRAL-1", "AP-SOUTH-1"];
  return (
    <BlueprintCard stage={2} variant={variant} file="cdn_status.json" fileClassName={FILE_CLASSES[2]} comment="/* Replicating sites globally to cache resources close to visitors. */">
      <div className={mobile ? "mt-2 p-2 rounded bg-black/50 border border-stone-800 font-mono text-[9.5px] space-y-1.5" : ""}>
        <div className={`grid grid-cols-2 font-mono text-stone-400 ${mobile ? "gap-x-2 gap-y-1" : "gap-x-4 gap-y-1.5 text-xs lg:text-[12px] mb-2"}`}>
          {regions.map((region) => (
            <div className="contents" key={region}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>{region}</span>
              </div>
              <span className="text-green-400 text-right font-semibold">ACTIVE</span>
            </div>
          ))}
        </div>
        <div
          className={`${mobile ? "p-1 text-[9.5px] leading-none" : "mt-3 p-2 text-xs lg:text-[11px]"} rounded bg-black/60 border border-stone-800 text-center font-mono text-green-500 font-bold uppercase tracking-wider relative overflow-hidden`}
        >
          STATUS: ONLINE (100% HEALTH)
          <span className="absolute inset-0 bg-green-500/5 animate-pulse" />
        </div>
      </div>
    </BlueprintCard>
  );
}

const STEAM = (
  <>
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "25%",
        background: "linear-gradient(to top, rgba(26,15,8,0.7), transparent)",
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
    <div className="divider-steam absolute bottom-4 left-0 right-0 z-3">
      {[0, 0.3, 0.6, 0.9, 1.2].map((delay) => (
        <div className="steam-particle" key={delay} style={{ animationDelay: `${delay}s` }} />
      ))}
    </div>
  </>
);

export function RemovingSection() {
  return (
    <SequenceSection
      id="removing"
      eyebrow="Deployment & Launch"
      heading={
        <>
          Fresh Out <span className="italic text-oven-orange">the Oven</span>
        </>
      }
      description="The moment of truth. Deployed to edge nodes and served hot to the globe. We map domain records, lock SSL encryption certificates, and load CDN servers to go live safely."
      stages={REMOVING_STAGES}
      frameCount={96}
      framePath={removingFramePath}
      visualSide="left"
      visualClassName={() => "css-active js-active relative overflow-hidden"}
      visualOverlay={STEAM}
      renderCard={RemovingCard}
    />
  );
}

/* ───────────────────────── Aroma (SEO) ───────────────────────── */

const AROMA_STAGES: [Stage, Stage, Stage] = [
  {
    title: "Metadata Recipe",
    summary: "Crafting meta titles and tags to describe the delicious page to crawlers.",
    detail:
      "Crafting meta titles and tags to describe the delicious page to crawlers. Precise meta tags improve search rankings and indexability.",
    icon: ICONS.eye,
  },
  {
    title: "Structured Spices",
    summary: "Adding structured JSON-LD markup so Google can index details.",
    detail:
      "Adding structured JSON-LD markup so Google can understand your business. Rich results can show services, FAQs and breadcrumbs directly in search.",
    icon: ICONS.squares,
  },
  {
    title: "Social Wafting",
    summary: "Configuring Open Graph preview cards to invite social clicks organically.",
    detail:
      "Configuring Open Graph preview cards to invite social clicks organically. Eye-catching titles and thumbnail images make shares stand out on social feeds.",
    icon: ICONS.share,
  },
];

function AromaCard({ stage, variant }: CardContext) {
  const mobile = variant === "mobile";
  if (stage === 0) {
    return (
      <BlueprintCard stage={0} variant={variant} file="meta_tags.html" fileClassName={FILE_CLASSES[0]} comment="<!-- Crafting meta titles and descriptions to describe the delicious page. -->">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>
            &lt;<span className="text-orange-400">title</span>&gt;PizzaScript - Hand-Crafted Web Design&lt;/<span className="text-orange-400">title</span>&gt;
          </div>
          <div>
            &lt;<span className="text-orange-400">meta</span> name=<span className="text-amber-200">&quot;description&quot;</span> content=
            <span className="text-amber-200">&quot;Served hot to the edge...&quot;</span> /&gt;
          </div>
        </div>
        <div
          className={`${mobile ? "mt-2 p-2 rounded text-[9.5px] leading-tight" : "mt-4 p-3 rounded-lg text-xs lg:text-[13px]"} bg-black/40 border border-stone-800 font-mono space-y-1`}
        >
          <div className={`flex justify-between items-center text-stone-500 border-b border-stone-900 pb-0.5 mb-0.5 ${mobile ? "text-[8px]" : "text-xs lg:text-[11px]"}`}>
            <span>GOOGLE SEARCH RESULT</span>
            <span className="text-green-500 font-bold">INDEXED</span>
          </div>
          <div className={`text-blue-400 font-serif font-bold leading-tight ${mobile ? "text-[10px]" : "text-xs lg:text-[13px]"}`}>
            PizzaScript — Hand-Crafted Web Design
          </div>
          <div className={`text-green-600 ${mobile ? "text-[8px]" : "text-xs lg:text-[11px]"}`}>https://www.pizzascript.com</div>
          {!mobile && (
            <div className="text-stone-400 text-xs lg:text-[11px] leading-tight">
              Served hot to the edge. We build fast, high-converting websites with React and Next.js.
            </div>
          )}
        </div>
      </BlueprintCard>
    );
  }
  if (stage === 1) {
    return (
      <BlueprintCard stage={1} variant={variant} file="structured_data.json" fileClassName={FILE_CLASSES[1]} comment="/* Adding structured JSON-LD data so crawlers can digest our page recipes. */">
        <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
          <div>&#123;</div>
          <div>
            &nbsp;&nbsp;<span className="text-blue-300">&quot;@context&quot;</span>: <span className="text-amber-200">&quot;https://schema.org&quot;</span>,
          </div>
          <div>
            &nbsp;&nbsp;<span className="text-blue-300">&quot;@type&quot;</span>: <span className="text-amber-200">&quot;ProfessionalService&quot;</span>
          </div>
          <div>&#125;</div>
        </div>
        <div
          className={`${mobile ? "mt-2 p-2 rounded text-[9.5px] space-y-1" : "mt-4 p-3 rounded-lg text-xs lg:text-[13px] space-y-2"} bg-black/40 border border-amber-900/20 font-mono`}
        >
          <div className="flex justify-between items-center text-amber-100 border-b border-amber-950/20 pb-0.5 mb-0.5">
            <span className="font-bold">SCHEMA VALIDATOR</span>
            {!mobile && <span className="text-stone-600">JSON-LD</span>}
          </div>
          <div className={`grid grid-cols-2 gap-1 text-stone-400 ${mobile ? "text-[8.5px] leading-none" : "text-xs lg:text-[12px]"}`}>
            <div>🔍 Type</div>
            <div className="text-right">&quot;ProfessionalService&quot;</div>
            <div>📍 Area</div>
            <div className="text-right">&quot;Pune, India&quot;</div>
            {!mobile && (
              <>
                <div>✅ Errors</div>
                <div className="text-right">0</div>
              </>
            )}
          </div>
        </div>
      </BlueprintCard>
    );
  }
  return (
    <BlueprintCard stage={2} variant={variant} file="open_graph.html" fileClassName={FILE_CLASSES[2]} comment="<!-- Configuring social preview cards so link shares attract organic visitors. -->">
      <div className={`font-mono text-stone-400 ${codeSize(variant)}`}>
        <div>
          &lt;<span className="text-orange-400">meta</span> property=<span className="text-amber-200">&quot;og:title&quot;</span> content=
          <span className="text-amber-200">&quot;PizzaScript...&quot;</span> /&gt;
        </div>
        {!mobile && (
          <>
            <div>
              &lt;<span className="text-orange-400">meta</span> property=<span className="text-amber-200">&quot;og:image&quot;</span> content=
              <span className="text-amber-200">&quot;opengraph-image&quot;</span> /&gt;
            </div>
            <div>
              &lt;<span className="text-orange-400">meta</span> property=<span className="text-amber-200">&quot;og:type&quot;</span> content=
              <span className="text-amber-200">&quot;website&quot;</span> /&gt;
            </div>
          </>
        )}
      </div>
      <div
        className={`${mobile ? "mt-2 p-2 rounded text-[9.5px] space-y-1.5" : "mt-4 p-3 rounded-lg text-xs lg:text-[13px] space-y-2"} bg-black/40 border border-stone-800 font-mono`}
      >
        {!mobile && (
          <div className="flex justify-between items-center text-stone-500 text-xs lg:text-[11px] border-b border-stone-900 pb-1 mb-1">
            <span>SOCIAL CARD PREVIEW</span>
            <span>OpenGraph</span>
          </div>
        )}
        <div className="border border-stone-800 rounded bg-[#FFF8F0]/5 overflow-hidden flex">
          <div
            className={`${mobile ? "w-10 h-8 text-[8px]" : "w-16 h-12 text-xs lg:text-[10px]"} bg-amber-950/20 border-r border-stone-800 flex items-center justify-center text-oven-orange`}
          >
            IMG
          </div>
          <div className="p-1.5 flex-1 flex flex-col justify-center leading-tight">
            <div className={`text-stone-300 font-bold truncate ${mobile ? "text-[9px]" : "text-xs lg:text-[12px]"}`}>
              PizzaScript — Hand-Crafted Web
            </div>
            <div className={`text-stone-500 truncate ${mobile ? "text-[8px]" : "text-xs lg:text-[10px]"}`}>
              A delicious aroma of clean code...
            </div>
          </div>
        </div>
      </div>
    </BlueprintCard>
  );
}

export function AromaSection() {
  return (
    <SequenceSection
      id="aroma"
      eyebrow="SEO & Visibility"
      heading={
        <>
          The Wafting <span className="italic text-oven-orange">Aroma!</span>
        </>
      }
      description="The best pizza in town means nothing if nobody knows the kitchen exists. Search engine optimization is the aroma after we serve the pizza, spreading clean metadata, rich snippets, and open-graph cards to attract hungry clicks naturally."
      stages={AROMA_STAGES}
      frameCount={100}
      framePath={doughFramePath}
      visualSide="right"
      renderCard={AromaCard}
    />
  );
}
