declare module '@earendil-works/pi-coding-agent' {
  export interface ExtensionAPI {
    registerTool(definition: any): void;
    registerCommand(name: string, options: any): void;
  }
}
