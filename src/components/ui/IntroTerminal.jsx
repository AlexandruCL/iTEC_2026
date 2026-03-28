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
    INTRO_LINES.map((text) => ({ text, isError: false }))
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
          text: `[error]: INCOMPETENT USER: I've told you to type 'start' not '${inputValue}' you moron.`, 
          isError: true 
        },
      ];
      setTerminalLines(newLines);
      setCurrentLineIndex(terminalLines.length);
      setInputValue("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950 overflow-hidden font-mono text-accent-500"
      onClick={() => showInput && inputRef.current && inputRef.current.focus()}
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
                {terminalLines.slice(0, currentLineIndex + 1).map((lineItem, i) => (
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
                      typingSpeed={lineItem.isError ? 10 : 25}
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
    </div>
  );
}

function JarvisAnimation({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(() => {
      onComplete();
    }, 4500); // Extended animation duration to 4.5s
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="relative z-20 flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Huge subtle outer ring clockwise */}
      <motion.div
        className="absolute w-[400px] h-[400px] md:w-[800px] md:h-[800px] rounded-full border-[1px] border-accent-500/10 border-dashed"
        animate={{ rotate: 360, scale: [0.8, 1.2, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      {/* Primary rotating ring counter-clockwise */}
      <motion.div
        className="absolute w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full border-2 border-accent-500/40 border-dashed"
        animate={{ rotate: -360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Tech grid inner spinner */}
      <motion.div
        className="absolute w-[250px] h-[250px] md:w-[500px] md:h-[500px] rounded-full border-4 border-dotted border-accent-400/60"
        animate={{ rotate: 360, scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Fast internal scanner */}
      <motion.div
        className="absolute w-[180px] h-[180px] md:w-[350px] md:h-[350px] rounded-full border-t-2 border-r-2 border-accent-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        animate={{ rotate: 720 }}
        transition={{ duration: 2, ease: "circIn" }}
      />

      {/* Expanding HUD elements (multiple lines springing out) */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-[200px] md:h-[400px] bg-gradient-to-t from-transparent via-accent-500/50 to-transparent"
          style={{ rotate: `${i * 60}deg` }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [0, 1, 0.5, 0], opacity: [0, 1, 0, 0] }}
          transition={{ duration: 2, delay: 0.5 + i * 0.1, ease: "easeOut" }}
        />
      ))}

      {/* Central Expanding glowing shockwave */}
      <motion.div
        className="absolute w-8 h-8 rounded-full border-4 border-accent-300 shadow-[0_0_80px_rgba(16,185,129,1)]"
        animate={{
          scale: [1, 5, 20, 60],
          opacity: [1, 1, 0.8, 0],
          borderWidth: ["8px", "4px", "2px", "0px"],
        }}
        transition={{ duration: 2.5, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Another rapid shockwave to seal the deal */}
      <motion.div
        className="absolute w-12 h-12 rounded-full bg-accent-400/20"
        animate={{
          scale: [0, 30, 80],
          opacity: [0, 1, 0],
        }}
        transition={{ duration: 1.5, ease: "circOut", delay: 2.2 }}
      />

      {/* Center text container */}
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md rounded-full border border-accent-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1.1, 1.8] }}
        transition={{ duration: 3.5, ease: "easeInOut", delay: 0.8 }}
      >
        <span className="text-lg md:text-2xl text-accent-500 font-mono mb-2 tracking-widest opacity-80">
          OVERRIDE ACCEPTED
        </span>
        <span className="text-3xl md:text-6xl text-white font-display font-bold tracking-[0.2em] drop-shadow-[0_0_20px_rgba(16,185,129,1)]">
          ACCESS <span className="text-accent-400">GRANTED</span>
        </span>
      </motion.div>

      {/* Final screen wipe into the site */}
      <motion.div
        className="absolute inset-0 bg-neutral-950/90 z-[-1]"
        initial={{ opacity: 1 }}
      />

      {/* 2-stage flash sequence */}
      <motion.div
        className="absolute inset-0 bg-accent-400 z-50 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.2, 0, 1] }}
        transition={{
          duration: 4.2,
          times: [0, 0.6, 0.7, 0.8, 1],
          ease: "easeIn",
        }}
      />
    </motion.div>
  );
}
