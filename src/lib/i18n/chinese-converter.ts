'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  createElement,
} from 'react';
import type { ChineseScript } from './config';

// Lazy-load opencc-js only when Traditional Chinese is toggled
let converter: ((text: string) => string) | null = null;

async function loadConverter() {
  if (!converter) {
    const OpenCC = await import('opencc-js');
    converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
  }
  return converter;
}

interface ChineseScriptContextType {
  script: ChineseScript;
  toggleScript: () => void;
  convert: (text: string) => string;
}

const ChineseScriptContext = createContext<ChineseScriptContextType>({
  script: 'simplified',
  toggleScript: () => {},
  convert: (text: string) => text,
});

export function ChineseScriptProvider({ children }: { children: ReactNode }) {
  const [script, setScript] = useState<ChineseScript>('simplified');
  const [convertFn, setConvertFn] = useState<((text: string) => string) | null>(
    null
  );

  const toggleScript = useCallback(async () => {
    if (script === 'simplified') {
      const fn = await loadConverter();
      setConvertFn(() => fn);
      setScript('traditional');
    } else {
      setConvertFn(null);
      setScript('simplified');
    }
  }, [script]);

  const convert = useCallback(
    (text: string) => {
      if (script === 'traditional' && convertFn) {
        return convertFn(text);
      }
      return text;
    },
    [script, convertFn]
  );

  return createElement(
    ChineseScriptContext.Provider,
    { value: { script, toggleScript, convert } },
    children
  );
}

export function useChineseScript() {
  return useContext(ChineseScriptContext);
}
