export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'form-urlencoded' | 'form-data';
export type AuthType = 'none' | 'basic' | 'bearer' | 'apiKey';
export type RequestTab = 'params' | 'headers' | 'auth' | 'body';
export type ResponseTab = 'body' | 'headers';
export type SidebarTab = 'history' | 'saved';

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface FormRow extends KeyValueRow {
  fieldType: 'text' | 'file';
  fileName?: string;
  contentType?: string;
  fileBase64?: string;
}

export interface AuthState {
  type: AuthType;
  username: string;
  password: string;
  token: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: 'header' | 'query';
}

export interface BodyState {
  type: BodyType;
  content: string;
  formFields: FormRow[];
}

export interface RequestModel {
  method: string;
  url: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  auth: AuthState;
  body: BodyState;
  timeoutMs: number;
  followRedirects: boolean;
  disableTls: boolean;
}

export interface WireKeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface WireFormField {
  key: string;
  value: string;
  type: string;
  fileName?: string;
  contentType?: string;
  fileBase64?: string;
  enabled: boolean;
}

export interface WireRequest {
  method: string;
  url: string;
  params: WireKeyValue[];
  headers: WireKeyValue[];
  auth: {
    type: string;
    username?: string;
    password?: string;
    token?: string;
    apiKeyName?: string;
    apiKeyValue?: string;
    apiKeyIn?: string;
  };
  body: {
    type: string;
    content?: string;
    formFields?: WireFormField[];
  };
  timeoutMs: number;
  followRedirects: boolean;
  disableTlsVerification: boolean;
}

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  contentType: string;
  binary: boolean;
  timeMs: number;
  size: number;
  headers: HeaderEntry[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  request: WireRequest;
  status: number;
  statusText: string;
  durationMs: number;
  size: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  request: WireRequest;
  savedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
  createdAt: number;
}
