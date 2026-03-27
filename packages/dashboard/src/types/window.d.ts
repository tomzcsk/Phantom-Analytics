export {}

declare global {
  interface Window {
    __pa_loaded?: boolean
    __phantom_config?: { siteId: string; token: string; endpoint: string }
    phantom?: { track: (name: string, props?: Record<string, unknown>) => void }
  }
}
