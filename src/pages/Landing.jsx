import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Sparkles,
  Zap,
  Code2,
  Terminal,
  Shield,
  Globe,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FadeIn from "@/components/ui/FadeIn";
import Marquee from "@/components/ui/Marquee";
import StickyScroll from "@/components/ui/StickyScroll";
import CodeSnippet, {
  Keyword,
  Str,
  Func,
  Comment,
  Var,
  Punct,
} from "@/components/ui/CodeSnippet";
import ShapeGrid from "@/components/ui/ShapeGrid";
import FaultyTerminal from "@/components/ui/FaultyTerminal";
import IntroTerminal from "@/components/ui/IntroTerminal";
import { useAuthStore } from "@/stores/authStore";

const features = [
  {
    icon: Users,
    title: "Real-time Cursors",
    description:
      "See every teammate's cursor and selection live. No lag, no conflicts — just seamless pair programming at any scale.",
  },
  {
    icon: Sparkles,
    title: "AI Code Assistant",
    description:
      "Get context-aware suggestions, instant explanations, and intelligent debugging powered by Gemini AI — right in your editor.",
  },
  {
    icon: Zap,
    title: "Instant Sessions",
    description:
      "Spin up a fully-configured coding environment in under 2 seconds. Share a link and start building together immediately.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description:
      "End-to-end encrypted sessions with role-based access control. Your code stays yours.",
  },
];

const steps = [
  {
    num: "01",
    title: "Create a Session",
    description:
      "Choose your language and name your workspace. It takes less than two seconds.",
  },
  {
    num: "02",
    title: "Share the Link",
    description:
      "Send your session URL to teammates. Anyone with the link can join instantly.",
  },
  {
    num: "03",
    title: "Code Together",
    description:
      "Write, debug, and ship code in real-time with AI assistance built directly into the editor.",
  },
];

export default function Landing() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = React.useState(!sessionStorage.getItem("itecify_intro_seen"));

  const handleStartCoding = () => {
    navigate(user ? "/dashboard" : "/signup");
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-950" />;
  }

  if (showIntro && !user) {
    return (
      <IntroTerminal
        onComplete={() => {
          setShowIntro(false);
          sessionStorage.setItem("itecify_intro_seen", "true");
        }}
      />
    );
  }

  return (
    <div id="landing-page" className="min-h-screen bg-neutral-950">
      <Header />

      <main className="pt-16">
        {/* ═══════════════════════════ HERO + CODE SHOWCASE with grid bg ═══════════════════════════ */}
        <div className="relative">
          {/* Animated grid background */}
          <div className="absolute inset-0 z-0">
            <ShapeGrid
              direction="diagonal"
              speed={0.3}
              squareSize={50}
              borderColor="#1a1a1f"
              hoverFillColor="#10b981"
              hoverTrailAmount={5}
            />
          </div>

          {/* ═══════════════════════════ HERO ═══════════════════════════ */}
          <section
            id="hero-section"
            className="relative z-10 pt-12 pb-16 lg:pt-20 lg:pb-24"
          >
            <div className="max-w-5xl mx-auto px-6 text-center relative">
              <FadeIn delay={0.1}>
                <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold text-white mb-6 tracking-tight font-display leading-[1.05]">
                  Collaborative Coding
                  <br />
                  <span className="text-gradient">was never easier</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                  Create instant coding sessions, invite your team, and build
                  software together in real-time — with an AI assistant that
                  actually understands your code.
                </p>
              </FadeIn>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" icon={ArrowRight} onClick={handleStartCoding}>
                  Start Coding Free
                </Button>
                {!user && (
                  <Link to="/login">
                    <Button size="lg" variant="secondary">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>

              {/* Marquee */}
              <div className="mt-20">
                <Marquee />
              </div>
            </div>
          </section>

          {/* ═══════════════════════════ CODE SHOWCASE ═══════════════════════════ */}
          <section id="code-section" className="relative z-10 py-20 lg:py-32">
            <div className="max-w-5xl mx-auto px-6">
              <FadeIn>
                <p className="text-xs uppercase tracking-widest text-accent-500 font-semibold mb-4 font-display">
                  Live collaboration
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-display tracking-tight">
                  See it in action
                </h2>
                <p className="text-neutral-400 mb-12 max-w-lg">
                  Every keystroke syncs instantly. Cursors, selections, and
                  changes — all in real-time across every connected editor.
                </p>
              </FadeIn>

              <FadeIn delay={0.2}>
                <CodeSnippet filename="collaboration.py" className="max-w-3xl">
                  <Keyword>import</Keyword> <Var>itecify</Var>
                  {"\n"}
                  {"\n"}
                  <Comment>{"# Create a new real-time coding session"}</Comment>
                  {"\n"}
                  <Var>session</Var> <Punct>=</Punct> <Keyword>await</Keyword>{" "}
                  <Var>itecify</Var>
                  <Punct>.</Punct>
                  <Func>create_session</Func>
                  <Punct>(</Punct>
                  {"\n"}
                  {"    "}
                  <Var>name</Var>
                  <Punct>=</Punct>
                  <Str>"sprint-review"</Str>
                  <Punct>,</Punct>
                  {"\n"}
                  {"    "}
                  <Var>language</Var>
                  <Punct>=</Punct>
                  <Str>"python"</Str>
                  <Punct>,</Punct>
                  {"\n"}
                  {"    "}
                  <Var>ai</Var>
                  <Punct>=</Punct>
                  <Keyword>True</Keyword>
                  {"\n"}
                  <Punct>)</Punct>
                  {"\n"}
                  {"\n"}
                  <Comment>
                    {"# Invite your team — they join instantly"}
                  </Comment>
                  {"\n"}
                  <Keyword>await</Keyword> <Var>itecify</Var>
                  <Punct>.</Punct>
                  <Func>invite</Func>
                  <Punct>(</Punct>
                  {"\n"}
                  {"    "}
                  <Var>session</Var>
                  <Punct>.</Punct>
                  <Var>id</Var>
                  <Punct>,</Punct>
                  {"\n"}
                  {"    "}
                  <Punct>[</Punct>
                  <Str>"alex.cristea.laur2004@gmail.com"</Str>
                  <Punct>,</Punct> <Str>"patric.3pop@gmail.com"</Str>
                  <Punct>,</Punct> <Str>"ionut7797@gmail.com"</Str>
                  <Punct>]</Punct>
                  {"\n"}
                  <Punct>)</Punct>
                  {"\n"}
                  {"\n"}
                  <Func>print</Func>
                  <Punct>(</Punct>
                  <Str>{'f"Session live → {session.url}"'}</Str>
                  <Punct>)</Punct>
                </CodeSnippet>
              </FadeIn>
            </div>
          </section>
        </div>
        {/* end grid bg wrapper */}

        {/* ═══════════════════════════ STICKY FEATURES ═══════════════════════════ */}
        <section
          id="features-section"
          className="py-20 lg:py-32 border-t border-neutral-800/50"
        >
          <div className="max-w-6xl mx-auto px-6">
            <StickyScroll
              leftContent={
                <div>
                  <FadeIn direction="left">
                    <p className="text-xs uppercase tracking-widest text-accent-500 font-semibold mb-4 font-display">
                      Platform
                    </p>
                    <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 font-display tracking-tight leading-tight">
                      Why teams choose
                      <br />
                      iTECify
                    </h2>
                    <p className="text-neutral-400 mb-8 leading-relaxed max-w-sm">
                      Built for developers who value speed, simplicity, and
                      seamless collaboration. No friction, just flow.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-neutral-500">
                      <div className="w-2 h-2 rounded-full bg-accent-500" />
                      Scroll to explore features
                    </div>
                  </FadeIn>
                </div>
              }
              rightItems={features.map((feature) => (
                <Card key={feature.title} className="p-7">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mb-5">
                    <feature.icon className="w-5 h-5 text-accent-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 font-display tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            />
          </div>
        </section>

        {/* ═══════════════════════════ HOW IT WORKS ═══════════════════════════ */}
        <section
          id="how-it-works"
          className="py-20 lg:py-32 border-t border-neutral-800/50"
        >
          <div className="max-w-5xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-xs uppercase tracking-widest text-accent-500 font-semibold mb-4 font-display">
                  Workflow
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-display tracking-tight">
                  Three steps to ship faster
                </h2>
                <p className="text-neutral-400 max-w-lg mx-auto">
                  From idea to production, iTECify removes every barrier between
                  you and your team.
                </p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <FadeIn key={step.num} delay={i * 0.15} direction="up">
                  <div className="relative">
                    <span className="text-6xl font-bold text-neutral-800/60 font-display absolute -top-2 -left-1 select-none">
                      {step.num}
                    </span>
                    <div className="pt-12">
                      <h3 className="text-lg font-semibold text-white mb-2 font-display tracking-tight">
                        {step.title}
                      </h3>
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Mini code snippet for step illustration */}
            <FadeIn delay={0.3}>
              <div className="mt-16">
                <CodeSnippet filename="terminal" className="max-w-lg mx-auto">
                  <Punct>$</Punct> <Func>itecify</Func> <Var>create</Var>{" "}
                  <Str>"my-project"</Str> <Punct>--lang</Punct>{" "}
                  <Str>python</Str>
                  {"\n"}
                  <Comment>{"→ Session created in 1.2s"}</Comment>
                  {"\n"}
                  <Comment>{"→ Share: https://itecify.dev/s/abc123"}</Comment>
                </CodeSnippet>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ═══════════════════════════ CTA ═══════════════════════════ */}
        <section
          id="cta-section"
          className="relative py-20 lg:py-32 border-t border-neutral-800/50 overflow-hidden"
        >
          {/* FaultyTerminal background */}
          <div className="absolute inset-0 z-0 opacity-40">
            <FaultyTerminal
              scale={1.2}
              gridMul={[2, 1]}
              digitSize={1.5}
              timeScale={0.2}
              scanlineIntensity={0.15}
              glitchAmount={0.5}
              flickerAmount={0.3}
              noiseAmp={0.8}
              chromaticAberration={0}
              dither={1}
              curvature={0}
              tint="#10b981"
              mouseReact={true}
              mouseStrength={0.3}
              pageLoadAnimation={false}
              brightness={1.2}
            />
          </div>
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950" />

          <div className="relative z-10 max-w-3xl mx-auto px-6">
            <FadeIn>
              <div className="text-center">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 font-display tracking-tight">
                  Ready to code together?
                </h2>
                <p className="text-neutral-300 max-w-md mx-auto mb-10 leading-relaxed text-lg">
                  Join thousands of developers shipping faster with real-time
                  collaboration and AI assistance.
                </p>
                <Button size="lg" icon={ArrowRight} onClick={handleStartCoding}>
                  Get Started for Free
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
