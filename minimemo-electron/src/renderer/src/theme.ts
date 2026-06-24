import { createTheme, localStorageColorSchemeManager } from '@mantine/core'

/** 全局字体栈：优先系统中英文字体，回退到通用无衬线 */
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif'

/** indigo→violet 主渐变（全局统一） */
export const BRAND_GRADIENT = { from: 'indigo', to: 'violet', deg: 135 } as const

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'lg',
  fontFamily: FONT_STACK,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
  defaultGradient: BRAND_GRADIENT,
  headings: {
    fontFamily: FONT_STACK,
    fontWeight: '700'
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
    sm: '0 2px 8px -2px rgba(15, 23, 42, 0.10)',
    md: '0 8px 24px -12px rgba(15, 23, 42, 0.18)',
    lg: '0 16px 40px -16px rgba(15, 23, 42, 0.22)'
  },
  components: {
    Container: { defaultProps: { px: 'md' } },
    Button: { defaultProps: { radius: 'md' } },
    Paper: { defaultProps: { radius: 'lg' } }
  }
})

export const colorSchemeManager = localStorageColorSchemeManager({
  key: 'minimemo-color-scheme'
})
