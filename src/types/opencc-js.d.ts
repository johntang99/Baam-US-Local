declare module 'opencc-js' {
  interface ConverterOptions {
    from: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
    to: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
  }

  export function Converter(options: ConverterOptions): (text: string) => string;
}
