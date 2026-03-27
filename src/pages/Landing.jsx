import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Code2, Users, Sparkles, Zap, Github, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";

const features = [
  {
    icon: Users,
    title: "Real-time Collaboration",
    description: "See your teammates cursors and edits in real-time. Code together like you are in the same room.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Assistance",
    description: "Get intelligent code suggestions, explanations, and debugging help from Gemini AI.",
  },
  {
    icon: Zap,
    title: "Instant Sessions",
    description: "Create coding sessions in seconds. Share a link and start collaborating immediately.",
  },
  {
    icon: Code2,
    title: "Multi-Language Support",
    description: "JavaScript, TypeScript, Python, HTML, CSS and more. Your editor, your language.",
  },
];

export default function Landing() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleStartCoding = () => {
    navigate(user ? "/dashboard" : "/signup");
  };

  return (
    <div id="landing-page" className="min-h-screen bg-dark-950">
      <Header />

      <main>
        <section id="hero-section" className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 via-transparent to-transparent" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

          <div className="relative max-w-[2400px] mx-auto">
            <div className="grid grid-cols-12">
              <div className="col-span-12 px-4 md:col-start-2 md:col-span-10 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800/50 border border-dark-700 mb-8">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    <span className="text-lg font-extralight text-dark-200">Powered by Gemini AI</span>
                  </div>

                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight text-white mb-6 max-w-4xl mx-auto">
                    Code{" "}
                    <span className="text-gradient">Together</span>
                    <br />
                    Build{" "}
                    <span className="text-gradient">Faster</span>
                  </h1>

                  <p className="text-xl md:text-2xl font-extralight text-dark-300 max-w-2xl mx-auto mb-10">
                    Real-time collaborative coding with AI assistance. See cursors, share sessions, and build amazing things together.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button size="lg" icon={ArrowRight} onClick={handleStartCoding}>
                      Start Coding Free
                    </Button>
                    {!user && (
                      <Link to="/login">
                        <Button size="lg" variant="secondary" icon={Github}>
                          Continue with GitHub
                        </Button>
                      </Link>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="mt-20 relative"
                >
                  <div className="rounded-2xl border border-dark-700 bg-dark-900/50 backdrop-blur-sm p-4 shadow-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="ml-4 text-lg text-dark-400 font-mono">session.js</span>
                    </div>
                    <div className="bg-dark-950 rounded-lg p-6 font-mono text-left overflow-hidden">
                      <pre className="text-lg">
                        <code>
                          <span className="text-purple-400">const</span>{" "}
                          <span className="text-blue-300">collaboration</span> ={" "}
                          <span className="text-yellow-300">await</span>{" "}
                          <span className="text-green-300">createSession</span>
                          <span className="text-white">(</span>
                          <span className="text-amber-300">"hackathon-2024"</span>
                          <span className="text-white">);</span>
                          {"\n\n"}
                          <span className="text-gray-500">{"// "}</span>
                          <span className="text-gray-500">Real-time cursors visible</span>
                          {"\n"}
                          <span className="text-purple-400">const</span>{" "}
                          <span className="text-blue-300">teammates</span> = [
                          {"\n"}
                          {"  "}
                          <span className="text-amber-300">"Alice"</span>,{" "}
                          <span className="text-green-500 animate-pulse">|</span>
                          {"\n"}
                          {"  "}
                          <span className="text-amber-300">"Bob"</span>,
                          {"\n"}
                          {"  "}
                          <span className="text-amber-300">"Charlie"</span>
                          {"\n"}
                          ];
                        </code>
                      </pre>
                    </div>
                  </div>

                  <div className="absolute -top-4 -right-4 bg-green-500 text-white px-3 py-1 rounded-full text-lg font-medium animate-pulse">
                    3 collaborating
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <section id="features-section" className="py-20">
          <div className="max-w-[2400px] mx-auto">
            <div className="grid grid-cols-12">
              <div className="col-span-12 px-4 md:col-start-2 md:col-span-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-16"
                >
                  <h2 className="text-4xl md:text-5xl font-extralight text-white mb-4">
                    Everything you need to{" "}
                    <span className="text-gradient">collaborate</span>
                  </h2>
                  <p className="text-xl font-extralight text-dark-400 max-w-2xl mx-auto">
                    Built for teams who want to code together seamlessly
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -4 }}
                      className="p-8 rounded-2xl bg-dark-800/30 border border-dark-700 hover:border-primary-500/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center mb-6">
                        <feature.icon className="w-6 h-6 text-primary-400" />
                      </div>
                      <h3 className="text-2xl font-light text-white mb-3">{feature.title}</h3>
                      <p className="text-lg font-extralight text-dark-400">{feature.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cta-section" className="py-20">
          <div className="max-w-[2400px] mx-auto">
            <div className="grid grid-cols-12">
              <div className="col-span-12 px-4 md:col-start-2 md:col-span-10">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative rounded-3xl bg-gradient-to-br from-primary-500/20 via-purple-500/20 to-pink-500/20 p-12 md:p-20 text-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-dark-900/40 backdrop-blur-sm" />
                  <div className="relative z-10">
                    <h2 className="text-4xl md:text-5xl font-extralight text-white mb-6">
                      Ready to code together?
                    </h2>
                    <p className="text-xl font-extralight text-dark-300 max-w-xl mx-auto mb-8">
                      Join thousands of developers collaborating in real-time with AI assistance.
                    </p>
                    <Button size="lg" icon={ArrowRight} onClick={handleStartCoding}>
                      Get Started Free
                    </Button>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
