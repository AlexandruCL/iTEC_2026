import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import FaultyTerminal from "@/components/ui/FaultyTerminal";
import TextType from "@/components/ui/TextType";
import clsx from "clsx";

const INTRO_LINES = [
  "[system]: Initializing iTECify core systems...",
  "[system]: Establishing secure connection...",
  "[system]: Verifying encryption keys...",
  "[system]: Bypassing mainframe... SUCCESS",
  "[system]: Welcome to iTECify.",
  "[system]: Awaiting manual override... Type 'start'",
];

const GRID_MUL = [2, 1];

export default function IntroTerminal({ onComplete }) {
  const [terminalLines, setTerminalLines] = useState(
    INTRO_LINES.map((text) => ({ text, isError: false })),
  );
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [animatingJarvis, setAnimatingJarvis] = useState(false);

  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Make sure input is focused whenever user clicks anywhere or input shows
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentLineIndex, showInput, inputValue]);

  const handleSentenceComplete = (index) => {
    if (index === terminalLines.length - 1) {
      setShowInput(true);
    } else {
      setCurrentLineIndex((prev) => prev + 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim().toLowerCase() === "start") {
      setAnimatingJarvis(true);
    } else {
      setShowInput(false);
      const newLines = [
        ...terminalLines,
        { text: `> ${inputValue}`, isError: false },
        {
          text: `[INCOMPETENT USER]: I've told you to type 'start' not '${inputValue}' you moron.`,
          isError: true,
        },
      ];
      setTerminalLines(newLines);
      setCurrentLineIndex(terminalLines.length);
      setInputValue("");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 overflow-hidden font-mono text-accent-500"
      onClick={() => showInput && inputRef.current && inputRef.current.focus()}
      exit={{ opacity: 0 }}
      transition={{ duration: 3.0, ease: "easeInOut" }}
    >
      {/* Matrix / Sci-fi Background using FaultyTerminal */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <FaultyTerminal
          scale={1.5}
          gridMul={GRID_MUL}
          timeScale={0.15}
          scanlineIntensity={0.2}
          glitchAmount={0.3}
          flickerAmount={0}
          brightness={1}
          tint="#10b981"
          mouseReact={false}
          pageLoadAnimation={false}
          dither={1}
        />
      </div>

      {/* Subtle glowing vignette */}
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(9,9,11,0.8)_100%)] pointer-events-none" />

      <AnimatePresence mode="wait">
        {!animatingJarvis ? (
          <motion.div
            key="terminal-content"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 w-full max-w-4xl h-[70vh] max-h-[800px] flex flex-col bg-black/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)] backdrop-blur-xl"
          >
            {/* Terminal Top Bar */}
            <div className="flex items-center px-4 py-3 bg-neutral-900 border-b border-neutral-800/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <div className="ml-4 text-xs font-sans text-neutral-500 font-semibold tracking-wider flex-1 text-center pr-12 select-none">
                iTECify Core Terminal — bash — 80x24
              </div>
            </div>

            {/* Terminal Body */}
            <div
              ref={scrollRef}
              className="flex-1 p-6 flex flex-col justify-start overflow-y-auto no-scrollbar scroll-smooth"
            >
              <div className="flex flex-col gap-3 pb-4">
                {terminalLines
                  .slice(0, currentLineIndex + 1)
                  .map((lineItem, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={clsx(
                        "text-sm md:text-lg tracking-wide uppercase shadow-accent-500 text-shadow-sm",
                        lineItem.isError ? "text-red-500" : "text-accent-400",
                      )}
                    >
                      <TextType
                        text={lineItem.text}
                        typingSpeed={lineItem.isError ? 7 : 13}
                        loop={false}
                        showCursor={i === currentLineIndex && !showInput}
                        cursorCharacter="█"
                        initialDelay={200}
                        onSentenceComplete={() => handleSentenceComplete(i)}
                      />
                    </motion.div>
                  ))}
              </div>

              {showInput && (
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="flex items-center gap-3 text-lg md:text-xl"
                >
                  <span className="text-accent-500 flex-shrink-0 animate-pulse">
                    {">"}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="bg-transparent border-none outline-none text-white w-full caret-accent-500 placeholder:text-neutral-700/50 font-mono tracking-widest uppercase"
                    placeholder="CLICK HERE TO TYPE"
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                  />
                </motion.form>
              )}
            </div>
          </motion.div>
        ) : (
          <JarvisAnimation key="jarvis-anim" onComplete={onComplete} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function JarvisAnimation({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(() => {
      onComplete();
    }, 2500); // Wait until JarvisAnimation is completely opaque (2.5s)
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="relative z-20 flex items-center justify-center w-full h-full overflow-hidden"
      // Fades in quickly, holds, and then fades to complete total transparency by 2.5s
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.5, times: [0, 0.1, 0.7, 1], ease: "easeInOut" }}
    >
      <div className="relative flex items-center justify-center w-full h-full">
        {/* Horizontal Laser Sweep */}
        <motion.div
          className="absolute h-[2px] bg-accent-400 shadow-[0_0_20px_#10b981] z-0"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: ["0%", "100%", "100%"], opacity: [0, 1, 0] }}
          transition={{ duration: 2, ease: "easeOut" }}
        />

        {/* Vertical Laser Sweep */}
        <motion.div
          className="absolute w-[2px] bg-accent-400 shadow-[0_0_20px_#10b981] z-0"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: ["0%", "100%", "100%"], opacity: [0, 1, 0] }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
        />

        {/* Center text container */}
        <motion.div
          className="relative z-10 flex flex-col items-center justify-center px-8 py-8 md:px-16 md:py-12 bg-black/80 backdrop-blur-3xl border-x-4 border-y border-accent-400 shadow-[0_0_80px_rgba(16,185,129,0.3)] overflow-hidden"
          initial={{ opacity: 0, scale: 0.9, width: 0 }}
          animate={{ opacity: 1, scale: 1, width: "auto" }}
          transition={{ duration: 0.8, ease: "circOut", delay: 0.6 }}
        >
          {/* Tech/Corner embellishments */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent-300" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent-300" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent-300" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent-300" />

          <motion.div
            className="absolute top-0 left-0 right-0 h-1 bg-accent-300 shadow-[0_0_20px_rgba(16,185,129,1)] opacity-70"
            animate={{ y: [0, 200, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />

          <span className="text-xs md:text-sm text-accent-500 font-mono mb-4 tracking-[0.5em] opacity-80">
            [ SECURE MAINFRAME OVERRIDE ]
          </span>

          <div className="text-4xl md:text-7xl text-white font-sans font-black tracking-widest uppercase flex flex-col md:flex-row items-center gap-2 md:gap-6 drop-shadow-xl">
            ACCESS
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-200 to-accent-600 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]">
              GRANTED
            </span>
          </div>

          <div className="mt-6 text-[10px] md:text-xs text-accent-500/60 font-mono tracking-widest uppercase">
            AUTHORIZATION CODE: A7-X9-OMEGA-001
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
