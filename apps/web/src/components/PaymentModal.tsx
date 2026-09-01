'use client'

import { useState } from 'react'
import {
  Modal, Button, Group, Stack, Radio, TextInput, Text,
  ThemeIcon, Alert, Loader,
} from '@mantine/core'
import {
  SmartPhone01Icon, CreditCardIcon, Building01Icon,
  AlertCircleIcon, CheckmarkCircle01Icon,
} from 'hugeicons-react'

export type PaymentMethod = 'momo' | 'cash' | 'bank_transfer'

interface PaymentModalProps {
  opened: boolean
  onClose: () => void
  onConfirm: (method: PaymentMethod, phone?: string) => Promise<void>
  planPrice?: number
  currency?: string
  loading?: boolean
}

export function PaymentModal({
  opened,
  onClose,
  onConfirm,
  planPrice = 0,
  currency = 'XAF',
  loading = false,
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('momo')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    try {
      if (method === 'momo' && !phone.trim()) {
        setError('Phone number required for Momo payment')
        return
      }
      await onConfirm(method, phone.trim() || undefined)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select Payment Method"
      size="md"
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      {success ? (
        <Stack align="center" py="xl">
          <ThemeIcon size={64} radius="xl" color="green" variant="light">
            <CheckmarkCircle01Icon size={32} />
          </ThemeIcon>
          <Text fw={600}>Payment method selected!</Text>
          <Text size="sm" c="dimmed" ta="center">
            Follow the instructions to complete your payment.
          </Text>
        </Stack>
      ) : (
        <Stack gap="lg">
          {planPrice > 0 && (
            <Alert
              icon={<CreditCardIcon size={16} />}
              title="Payment Required"
              color="blue"
            >
              Amount to pay: <strong>₣{planPrice.toLocaleString('fr-CM')} {currency}</strong>
            </Alert>
          )}

          <div>
            <Text fw={600} mb="sm">
              Choose Payment Method
            </Text>
            <Stack gap="md">
              {/* Momo Option */}
              <div
                style={{
                  border: '1px solid #edeef4',
                  borderRadius: 10,
                  padding: 12,
                  cursor: 'pointer',
                  background: method === 'momo' ? '#f0f1f7' : 'transparent',
                  transition: 'all 0.2s',
                }}
                onClick={() => setMethod('momo')}
              >
                <Group gap="sm">
                  <Radio
                    value="momo"
                    checked={method === 'momo'}
                    onChange={(e) => setMethod('momo')}
                    size="sm"
                  />
                  <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                    <SmartPhone01Icon size={16} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={600} size="sm">
                      Mobile Money (Momo)
                    </Text>
                    <Text size="xs" c="dimmed">
                      Fast and secure payment via USSD
                    </Text>
                  </Stack>
                </Group>
              </div>

              {/* Cash Option */}
              <div
                style={{
                  border: '1px solid #edeef4',
                  borderRadius: 10,
                  padding: 12,
                  cursor: 'pointer',
                  background: method === 'cash' ? '#f0f1f7' : 'transparent',
                  transition: 'all 0.2s',
                }}
                onClick={() => setMethod('cash')}
              >
                <Group gap="sm">
                  <Radio
                    value="cash"
                    checked={method === 'cash'}
                    onChange={(e) => setMethod('cash')}
                    size="sm"
                  />
                  <ThemeIcon size="sm" radius="xl" color="amber" variant="light">
                    <CreditCardIcon size={16} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={600} size="sm">
                      Cash Payment
                    </Text>
                    <Text size="xs" c="dimmed">
                      Payment pending staff confirmation
                    </Text>
                  </Stack>
                </Group>
              </div>

              {/* Bank Transfer Option */}
              <div
                style={{
                  border: '1px solid #edeef4',
                  borderRadius: 10,
                  padding: 12,
                  cursor: 'pointer',
                  background: method === 'bank_transfer' ? '#f0f1f7' : 'transparent',
                  transition: 'all 0.2s',
                }}
                onClick={() => setMethod('bank_transfer')}
              >
                <Group gap="sm">
                  <Radio
                    value="bank_transfer"
                    checked={method === 'bank_transfer'}
                    onChange={(e) => setMethod('bank_transfer')}
                    size="sm"
                  />
                  <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                    <Building01Icon size={16} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={600} size="sm">
                      Bank Transfer
                    </Text>
                    <Text size="xs" c="dimmed">
                      Payment pending bank confirmation
                    </Text>
                  </Stack>
                </Group>
              </div>
            </Stack>
          </div>

          {/* Phone Input for Momo */}
          {method === 'momo' && (
            <TextInput
              label="Phone Number"
              placeholder="e.g. 237123456789"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              leftSection={<SmartPhone01Icon size={16} />}
              disabled={loading}
            />
          )}

          {/* Info Message */}
          {method === 'cash' && (
            <Alert icon={<AlertCircleIcon size={16} />} color="yellow">
              Payment will be marked as pending. Staff will confirm receipt and activate your account.
            </Alert>
          )}

          {method === 'bank_transfer' && (
            <Alert icon={<AlertCircleIcon size={16} />} color="yellow">
              Payment will be marked as pending. Bank confirmation may take 1-2 business days.
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert icon={<AlertCircleIcon size={16} />} color="red">
              {error}
            </Alert>
          )}

          {/* Action Buttons */}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || (method === 'momo' && !phone.trim())}
              leftSection={loading ? <Loader size={14} /> : null}
            >
              {loading ? 'Processing...' : 'Continue with ' + method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
