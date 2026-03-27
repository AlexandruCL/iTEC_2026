export const languageProfiles = {
  javascript: {
    id: "javascript",
    extension: "js",
    baseImage: "node:20-alpine",
    dockerfile: [
      "FROM node:20-alpine",
      "WORKDIR /workspace",
      "RUN addgroup -S runner && adduser -S runner -G runner",
      "COPY . .",
      "USER runner",
      "CMD [\"node\", \"main.js\"]",
    ].join("\n"),
  },
  python: {
    id: "python",
    extension: "py",
    baseImage: "python:3.12-alpine",
    dockerfile: [
      "FROM python:3.12-alpine",
      "WORKDIR /workspace",
      "RUN addgroup -S runner && adduser -S runner -G runner",
      "COPY . .",
      "USER runner",
      "CMD [\"python\", \"main.py\"]",
    ].join("\n"),
  },
  rust: {
    id: "rust",
    extension: "rs",
    baseImage: "rust:1.86-alpine",
    dockerfile: [
      "FROM rust:1.86-alpine",
      "WORKDIR /workspace",
      "RUN addgroup -S runner && adduser -S runner -G runner",
      "COPY . .",
      "RUN rustc main.rs -O -o app",
      "USER runner",
      "CMD [\"/workspace/app\"]",
    ].join("\n"),
  },
};

export function getLanguageProfile(language) {
  return languageProfiles[language] || null;
}
