// Web: no-op stub — captureRef is not supported on web
import { RefObject } from 'react';

export async function captureRef(
  _ref: any,
  _options?: any
): Promise<string> {
  throw new Error('captureRef is not supported on web');
}
