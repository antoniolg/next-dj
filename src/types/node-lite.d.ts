declare const process: {
  env: Record<string, string | undefined>
  platform: string
}

declare module 'node:path' {
  export function dirname(path: string): string
  export function join(...paths: string[]): string
  export function resolve(...paths: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
  export function pathToFileURL(path: string): URL
}
