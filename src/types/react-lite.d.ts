declare namespace JSX {
  interface IntrinsicElements {
    main: {
      className?: string
      children?: unknown
    }
    h1: {
      className?: string
      children?: unknown
    }
  }

  interface Element {}
}

declare module 'react' {
  const React: {
    StrictMode: (props: { children?: unknown }) => JSX.Element
  }

  export default React
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown): JSX.Element
  export function jsxs(type: unknown, props: unknown): JSX.Element
}

declare module 'react-dom/client' {
  export function createRoot(element: HTMLElement): {
    render(children: unknown): void
  }
}
