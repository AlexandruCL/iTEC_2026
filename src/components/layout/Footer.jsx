import React from "react";
import { Link } from "react-router-dom";
import { Code2, Github, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer id="app-footer" className="bg-dark-900 border-t border-dark-800">
      <div className="max-w-[2400px] mx-auto">
        <div className="grid grid-cols-12">
          <div className="col-span-12 px-4 md:col-start-2 md:col-span-10 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <Link to="/" className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                    <Code2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xl font-semibold text-white">CollabCode</span>
                </Link>
                <p className="text-lg font-extralight text-dark-400 max-w-sm">
                  Real-time collaborative coding with AI assistance. Code together, build faster.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-4">Product</h4>
                <ul className="space-y-2">
                  <li>
                    <Link to="/features" className="text-lg font-extralight text-dark-400 hover:text-white transition-colors">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="text-lg font-extralight text-dark-400 hover:text-white transition-colors">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-white mb-4">Connect</h4>
                <div className="flex gap-4">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center hover:bg-dark-700 transition-colors"
                  >
                    <Github className="w-5 h-5 text-dark-300" />
                  </a>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center hover:bg-dark-700 transition-colors"
                  >
                    <Twitter className="w-5 h-5 text-dark-300" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-dark-800">
        <div className="max-w-[2400px] mx-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 px-4 md:col-start-2 md:col-span-10 py-4">
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
