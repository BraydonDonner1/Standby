// logger.js — thin wrapper so production paths don't use console.log directly.
// Set LOG_LEVEL=silent in environment to suppress info output.

const silent = process.env.LOG_LEVEL === 'silent';

const logger = {
  info:  (...args) => { if (!silent) { process.stdout.write(`[INFO]  ${args.join(' ')}\n`); } },
  warn:  (...args) => { process.stderr.write(`[WARN]  ${args.join(' ')}\n`); },
  error: (...args) => { process.stderr.write(`[ERROR] ${args.join(' ')}\n`); },
};

module.exports = logger;
