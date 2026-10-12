import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  registerQmdAdaptiveCommands,
  registerQmdAdaptiveTools,
  type ExtensionAPILike,
  type ExtensionCommandContext,
} from '../src/extension-commands.js';

export default function qmdAdaptiveSearchExtension(pi: ExtensionAPI) {
  const adapter: ExtensionAPILike = {
    registerTool(definition) {
      pi.registerTool(definition as Parameters<ExtensionAPI['registerTool']>[0]);
    },
    registerCommand(name, registration) {
      pi.registerCommand(name, {
        description: registration.description,
        handler: async (args, ctx) => {
          await registration.handler(args, ctx as ExtensionCommandContext);
        },
      });
    },
  };

  registerQmdAdaptiveTools(adapter);
  registerQmdAdaptiveCommands(adapter);
}
