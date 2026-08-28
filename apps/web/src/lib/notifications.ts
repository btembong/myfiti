import { notifications } from '@mantine/notifications'

export function showError(message: string, title = 'Error') {
  notifications.show({
    title,
    message,
    color: 'red',
    autoClose: 5000,
  })
}

export function showSuccess(message: string, title = 'Success') {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: 3000,
  })
}

/** Catch handler for api calls — shows toast and re-throws if needed */
export function catchToast(context?: string) {
  return (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Something went wrong'
    showError(context ? `${context}: ${msg}` : msg)
  }
}
