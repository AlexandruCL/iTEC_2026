import React from "react";
import { Link } from "react-router-dom";
import { Code2, Github, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer id="app-footer" className="border-t border-neutral-800/50 bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
                <Code2 className="w-4 h-4 text-neutral-950" />
              </div>
              <span className="text-lg font-semibold text-white font-display tracking-tight">iTECify</span>
            </Link>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              Real-time collaborative coding with AI assistance. Code together, build faster.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-400 mb-4 font-display">Product</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/" className="text-sm text-neutral-500 hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/" className="text-sm text-neutral-500 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-400 mb-4 font-display">Connect</h4>
            <div className="flex gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-white hover:border-neutral-600 transition-all"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-white hover:border-neutral-600 transition-all"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-neutral-800/50">
          <p className="text-xs text-neutral-600">
            &copy; {new Date().getFullYear()} iTECify. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
