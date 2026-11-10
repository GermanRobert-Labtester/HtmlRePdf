#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { startStdioMcpServer } from '../lib/mcp.ts';

startStdioMcpServer().catch((err) => {
  console.error('[MCP Stdio Error]:', err);
  process.exit(1);
});
