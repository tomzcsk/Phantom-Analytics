/**
 * @phantom/shared — Re-exports all shared types.
 *
 * Every cross-package type lives here. Import from '@phantom/shared'
 * in both packages/api and packages/dashboard.
 */

// Event types (tracker → API)
export type {
  EventType,
  EventPayload,
  EnrichedEvent,
} from './types/events.js'

// Analytics response types (API → dashboard)
export type {
  DateRange,
  OverviewResponse,
  TimeseriesPoint,
  PageStat,
  SourceStat,
  DeviceStat,
  GeoStat,
  FunnelStep,
  FunnelStepResult,
  FunnelResult,
  BrowserStat,
  OSStat,
  DeviceAnalyticsResponse,
  ReferrerDomain,
  SourcesAnalyticsResponse,
  SessionRecord,
  SessionEvent,
  ScrollDepthStat,
  ClickStat,
} from './types/analytics.js'

// Auth types
export type {
  UserRole,
  UserProfile,
  AuthResponse,
  LoginBody,
  RegisterBody,
} from './types/auth.js'

// Real-time types (SSE stream)
export type {
  ActivePage,
  RealtimeEvent,
  RealtimePayload,
  RealtimeMessage,
} from './types/realtime.js'
