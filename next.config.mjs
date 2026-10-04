import {execFileSync} from 'node:child_process';
let revision = process.env.ICONERD_REVISION;
if (!revision) { try { revision = execFileSync('git', ['rev-list','--count','HEAD'], {encoding:'utf8'}).trim(); } catch { revision = 'dev'; } }
export default { agentRules: false, output: 'export', trailingSlash: true, images: { unoptimized: true },
  env: {NEXT_PUBLIC_ICONERD_VERSION: `0.1 r${revision}`},
  turbopack: { resolveAlias: { './node/self.js': './src/paper-node-stub.cjs' } } };
