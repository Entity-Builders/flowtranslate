export interface IElectronAPI {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  on: <TArgs extends unknown[] = unknown[]>(
    channel: string,
    listener: (event: unknown, ...args: TArgs) => void,
  ) => void;
  off: <TArgs extends unknown[] = unknown[]>(
    channel: string,
    listener: (event: unknown, ...args: TArgs) => void,
  ) => void;
  send: (channel: string, ...args: unknown[]) => void;
}

declare global {
  interface Window {
    ipcRenderer: IElectronAPI;
  }
}
