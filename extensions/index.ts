import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerQmdAdaptiveCommands, registerQmdAdaptiveTools } from '../src/extension-commands.js';

export default function qmdAdaptiveSearchExtension(pi: ExtensionAPI) {
  registerQmdAdaptiveTools(pi);
  registerQmdAdaptiveCommands(pi);
}
