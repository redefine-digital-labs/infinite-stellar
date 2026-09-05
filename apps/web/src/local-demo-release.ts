declare const __LOCAL_DEMO_RELEASE__: string;

export const LOCAL_DEMO_RELEASE = typeof __LOCAL_DEMO_RELEASE__ === 'string'
  ? __LOCAL_DEMO_RELEASE__
  : 'development';
