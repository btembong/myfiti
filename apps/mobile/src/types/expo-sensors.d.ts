// Stub type declarations for expo-sensors.
// These satisfy TypeScript until the package is installed via `pnpm install`.
// Once installed the real declarations from the package will take precedence.
declare module 'expo-sensors' {
  export const Pedometer: {
    isAvailableAsync(): Promise<boolean>
    getStepCountAsync(start: Date, end: Date): Promise<{ steps: number }>
    watchStepCount(callback: (result: { steps: number }) => void): { remove: () => void }
  }
}
