const suspiciousPatterns = [
  {
    ruleId: "JS_CHILD_PROCESS_EXEC",
    severity: "high",
    regex: /child_process\.(exec|spawn|fork|execSync)/g,
    message: "Potential shell command execution detected.",
  },
  {
    ruleId: "JS_EVAL",
    severity: "medium",
    regex: /\beval\s*\(/g,
    message: "Use of eval detected.",
  },
  {
    ruleId: "PY_OS_SYSTEM",
    severity: "high",
    regex: /os\.system\s*\(/g,
    message: "Potential shell command execution detected.",
  },
  {
    ruleId: "PY_SUBPROCESS",
    severity: "high",
    regex: /subprocess\.(Popen|run|call)\s*\(/g,
    message: "Potential subprocess execution detected.",
  },
  {
    ruleId: "RUST_COMMAND_EXEC",
    severity: "high",
    regex: /std::process::Command/g,
    message: "Potential process execution detected.",
  },
];

function collectFileFindings(filePath, content) {
  const findings = [];

  for (const pattern of suspiciousPatterns) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(content);
    while (match) {
      const before = content.slice(0, match.index);
      const line = before.split("\n").length;
      findings.push({
        tool: "builtin-live-scan",
        ruleId: pattern.ruleId,
        severity: pattern.severity,
        filePath,
        line,
        message: pattern.message,
      });
      match = pattern.regex.exec(content);
    }
  }

  return findings;
}

export async function scanSourceBeforeRun({ files }) {
  const findings = [];

  for (const file of files) {
    findings.push(...collectFileFindings(file.path, file.content));
  }

  const blocked = findings.some((f) => f.severity === "high");

  return {
    blocked,
    summary: {
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      total: findings.length,
    },
    findings,
  };
}
