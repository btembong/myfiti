'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'react-qr-code'
import * as QRCodeLib from 'qrcode'
import { Button, TextInput, Progress } from '@mantine/core'
import {
  QrCode01Icon, CheckmarkCircle01Icon,
  Calendar01Icon, ArrowLeft01Icon, Search01Icon,
  Wallet01Icon, Alert01Icon, SmartPhone01Icon, UserAdd01Icon,
  LinkSquare01Icon, ArrowRight01Icon, UserStar01Icon,
  PrinterIcon, Message01Icon, VolumeHighIcon, VolumeMute01Icon,
} from 'hugeicons-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface KioskMember {
  id: string; name: string; plan: string; expiry: string
  checkins: number; initials: string; status: string
}

interface KioskClass {
  name: string; trainer: string; time: string; spots: number
}

// ─── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_GYM = {
  name: 'Gymflow',
  tagline: 'Your fitness journey starts here.',
  brand: '#6366f1',
  logoInitials: 'GF',
  maxCapacity: 60,
}

const DAY_PASSES = [
  { id: 'standard',  label: 'Standard',    sub: 'Full day access',           price: 2000  },
  { id: 'peak',      label: 'Peak hours',  sub: '6–9 am · 5–8 pm',          price: 2500  },
  { id: 'off_peak',  label: 'Off-peak',    sub: '10 am–3 pm weekdays',       price: 1500  },
  { id: 'student',   label: 'Student',     sub: 'Valid student ID required', price: 1000  },
  { id: 'bundle_10', label: '10-day pass', sub: 'Save 10% · best value',     price: 18000 },
]

// ─── i18n ─────────────────────────────────────────────────────────────────────
type Lang = 'en' | 'fr'
const T = {
  en: {
    tapToBegin: 'Tap anywhere to begin',
    checkIn: 'Member check-in', walkInDay: 'Walk-in & day pass',
    todaysClasses: "Today's classes", back: 'Back',
    welcomeBack: 'Welcome back!', membershipExpired: 'Membership expired',
    membershipCancelled: 'Membership cancelled', membershipSuspended: 'Membership suspended',
    membershipFrozen: 'Membership frozen', memberNotFound: 'Member not found',
    invalidQR: 'QR code not recognised', invalidPin: 'Incorrect PIN — no member found',
    outsideHours: 'Outside allowed hours',
    seeReception: 'Please see a staff member',
    graceHeadline: 'Grace period', graceSubtitle: 'Your subscription has expired — please renew soon.',
    graceCTA: 'Proceed to gym',
    issueErrorHeadline: 'Payment error', issueErrorMessage: 'Could not process your pass. Please see a staff member.',
    scanQR: 'Scan your QR code', enterPIN: 'Enter your PIN',
    orSearchName: 'or search by name', typeYourName: 'Type your name…',
    noMembersFound: 'No members found. See a staff member.',
    capacity: 'In gym', online: 'Online', offlineMode: 'Offline',
    enterStaffPIN: 'Staff PIN', manualCheckin: 'Find member',
    walkinTitle: 'Guest registration', walkinName: 'Full name', walkinPhone: 'Phone number',
    walkinPhoneSkip: 'Skip — no phone', next: 'Continue', walkinBack: 'Back',
    selectPass: 'Select a pass type', paymentMethod: 'Payment method',
    cash: 'Cash', momoMTN: 'MTN MoMo', momoOrange: 'Orange Money', smsLink: 'SMS payment link',
    memberWallet: 'Member Wallet', walletPhone: 'Member phone number', walletFind: 'Find member',
    walletBalance: 'Wallet balance', walletConfirm: 'Deduct & issue pass', walletNotFound: 'No member found with that number.',
    walletInsufficient: 'Insufficient wallet balance.',
    cashAmount: 'Amount to collect:', cashConfirm: 'Cash received — issue pass',
    momoInstruction: 'Ask guest to scan with their phone',
    momoConfirm: 'Payment confirmed — issue pass',
    linkInitiating: 'Generating payment link…', linkScanQR: 'Guest scans this QR to pay',
    linkWaiting: 'Waiting for payment confirmation…', linkConfirmManual: 'Mark as paid & issue pass',
    passIssued: 'Day pass issued', printOrSMS: 'Print or send via SMS',
    print: 'Print receipt', sendSMS: 'Send via SMS', done: 'Done',
    joinAsMember: 'Join as a member', joinMemberHint: 'See a staff member to convert your visit to a monthly membership',
    totalVisits: 'Total visits', expiryDate: 'Expiry date', renewNow: 'Buy a day pass instead',
    spotsLeft: 'spots left', full: 'Full', queued: 'queued',
    staffMode: 'Staff mode', currentCapacity: 'Last hour',
    recentScans: 'Recent check-ins', manualEntry: 'Manual entry',
    returnHome: 'Return to home', staffSignOut: 'Sign out',
  },
  fr: {
    tapToBegin: 'Touchez pour commencer',
    checkIn: 'Pointer ma présence', walkInDay: 'Visiteur & pass journée',
    todaysClasses: 'Cours du jour', back: 'Retour',
    welcomeBack: 'Bienvenue !', membershipExpired: 'Abonnement expiré',
    membershipCancelled: 'Abonnement annulé', membershipSuspended: 'Abonnement suspendu',
    membershipFrozen: 'Abonnement gelé', memberNotFound: 'Membre introuvable',
    invalidQR: 'QR code non reconnu', invalidPin: 'PIN incorrect — aucun membre trouvé',
    outsideHours: 'Hors des heures autorisées',
    seeReception: 'Veuillez voir un membre du personnel',
    graceHeadline: 'Période de grâce', graceSubtitle: 'Votre abonnement a expiré — veuillez renouveler bientôt.',
    graceCTA: 'Accéder à la salle',
    issueErrorHeadline: 'Erreur de paiement', issueErrorMessage: 'Impossible de traiter votre pass. Veuillez voir un membre du personnel.',
    scanQR: 'Scannez votre QR code', enterPIN: 'Entrez votre PIN',
    orSearchName: 'ou cherchez par nom', typeYourName: 'Tapez votre nom…',
    noMembersFound: 'Aucun membre trouvé.',
    capacity: 'Dans le gym', online: 'En ligne', offlineMode: 'Hors ligne',
    enterStaffPIN: 'PIN personnel', manualCheckin: 'Chercher membre',
    walkinTitle: 'Inscription visiteur', walkinName: 'Nom complet', walkinPhone: 'Téléphone',
    walkinPhoneSkip: 'Passer — pas de téléphone', next: 'Continuer', walkinBack: 'Retour',
    selectPass: 'Choisir un type de pass', paymentMethod: 'Mode de paiement',
    cash: 'Espèces', momoMTN: 'MTN MoMo', momoOrange: 'Orange Money', smsLink: 'Lien SMS',
    memberWallet: 'Portefeuille membre', walletPhone: 'Numéro du membre', walletFind: 'Trouver',
    walletBalance: 'Solde portefeuille', walletConfirm: 'Déduire et émettre', walletNotFound: 'Aucun membre trouvé.',
    walletInsufficient: 'Solde insuffisant.',
    cashAmount: 'Montant à collecter :', cashConfirm: 'Paiement reçu — émettre le pass',
    momoInstruction: 'Demandez au visiteur de scanner',
    momoConfirm: 'Paiement confirmé — émettre le pass',
    linkInitiating: 'Génération du lien…', linkScanQR: 'Le visiteur scanne ce QR pour payer',
    linkWaiting: 'Attente de la confirmation…', linkConfirmManual: 'Marquer payé et émettre',
    passIssued: 'Pass journée émis', printOrSMS: 'Imprimer ou envoyer par SMS',
    print: 'Imprimer', sendSMS: 'Envoyer SMS', done: 'Terminé',
    joinAsMember: 'Devenir membre', joinMemberHint: 'Voyez un membre du personnel pour convertir votre visite en abonnement mensuel',
    totalVisits: 'Visites totales', expiryDate: "Date d'expiration", renewNow: 'Acheter un pass journée',
    spotsLeft: 'places restantes', full: 'Complet', queued: 'en attente',
    staffMode: 'Mode personnel', currentCapacity: 'Dernière heure',
    recentScans: 'Entrées récentes', manualEntry: 'Entrée manuelle',
    returnHome: "Retour à l'accueil", staffSignOut: 'Déconnexion',
  },
}

// ─── Screens ──────────────────────────────────────────────────────────────────
type Screen =
  | 'idle' | 'home'
  | 'checkin_method' | 'checkin_qr' | 'checkin_pin' | 'checkin_app'
  | 'search'
  | 'confirmed' | 'denied' | 'grace' | 'issue_error' | 'membership' | 'schedule'
  | 'walkin' | 'walkin_phone' | 'passtype' | 'payment'
  | 'payment_cash' | 'payment_momo' | 'payment_link' | 'payment_wallet'
  | 'qr_issued' | 'staffpin' | 'staff'

// ─── Motion ───────────────────────────────────────────────────────────────────
const slide = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.2 } },
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const S = {
  // Surfaces
  bg: '#ffffff',
  bgDark: '#0b0f1a',
  surface: '#f8fafc',
  surfaceActive: '#f1f5f9',
  // Borders
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  borderFocus: '#6366f1',
  // Brand
  brand: '#6366f1',
  brandLight: 'rgba(99,102,241,0.08)',
  brandBorder: 'rgba(99,102,241,0.2)',
  // Text
  text: '#0f172a',
  textSub: '#64748b',
  textMuted: '#94a3b8',
  // Semantic
  success: '#16a34a',
  danger: '#dc2626',
  amber: '#d97706',
  // Gradients
  gBrand: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)',
  gDark:  'linear-gradient(160deg,#0b0f1a 0%,#111827 55%,#0d1320 100%)',
}

// Border-radius tokens
const R = { sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, full: 9999 }

// Type scale
const FS = {
  '2xs': '0.6rem', xs: '0.7rem', sm: '0.8rem', base: '0.9rem',
  lg: '1.05rem', xl: '1.3rem', '2xl': '1.75rem', '3xl': '2.4rem', display: '3.2rem',
}

// ─── Brand color helpers ──────────────────────────────────────────────────────
function brandAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '').padStart(6, '0')
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
function brandGrad(hex: string): string {
  const h = hex.replace('#', '').padStart(6, '0')
  const n = parseInt(h, 16)
  const lighten = (ch: number) => Math.round(ch + (255 - ch) * 0.22).toString(16).padStart(2, '0')
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255
  return `linear-gradient(135deg,#${lighten(r)}${lighten(g)}${lighten(b)} 0%,${hex} 100%)`
}

function isFinderZoneWeb(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
}

// ─── Styled QR for web (custom dots + brand finder squares) ──────────────────
function StyledQRCodeWeb({
  value, size, dotColor = '#0f172a', finderColor, bgColor = '#ffffff',
}: { value: string; size: number; dotColor?: string; finderColor: string; bgColor?: string }) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeLib.create(value, { errorCorrectionLevel: 'H' })
      return { data: qr.modules.data as Uint8Array, n: qr.modules.size as number }
    } catch { return null }
  }, [value])

  if (!matrix) return <div style={{ width: size, height: size, background: bgColor, borderRadius: 8 }} />
  const { data, n } = matrix
  const QUIET = 1
  const m = size / (n + QUIET * 2)
  const q = QUIET * m
  const pad = m * 0.12
  const finderAnchors = [{ r: 0, c: 0 }, { r: 0, c: n - 7 }, { r: n - 7, c: 0 }]

  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill={bgColor} />
      {/* Data modules */}
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => {
          if (!data[r * n + c] || isFinderZoneWeb(r, c, n)) return null
          return (
            <rect key={`${r}-${c}`}
              x={q + c * m + pad} y={q + r * m + pad}
              width={m - pad * 2} height={m - pad * 2}
              rx={m * 0.28} fill={dotColor}
            />
          )
        })
      )}
      {/* Finder patterns */}
      {finderAnchors.map(({ r, c }, i) => {
        const x = q + c * m; const y = q + r * m; const fp = 7 * m
        return (
          <g key={i}>
            <rect x={x} y={y} width={fp} height={fp} rx={m * 1.6} fill={finderColor} />
            <rect x={x + m} y={y + m} width={5 * m} height={5 * m} rx={m * 0.9} fill={bgColor} />
            <rect x={x + 2 * m} y={y + 2 * m} width={3 * m} height={3 * m} rx={m * 0.6} fill={finderColor} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Sound engine ─────────────────────────────────────────────────────────────
function useKioskSounds() {
  const ctx = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('kiosk_muted') === '1'
  )
  const mutedRef = useRef(muted)
  useEffect(() => { mutedRef.current = muted }, [muted])

  function ac() {
    if (!ctx.current) ctx.current = new AudioContext()
    if (ctx.current.state === 'suspended') ctx.current.resume()
    return ctx.current
  }

  function tone(
    freq: number, dur: number,
    type: OscillatorType = 'sine', gain = 0.18, delay = 0,
    freqEnd?: number,
  ) {
    if (mutedRef.current) return
    try {
      const a = ac()
      const osc = a.createOscillator()
      const g   = a.createGain()
      osc.connect(g); g.connect(a.destination)
      osc.type = type
      osc.frequency.setValueAtTime(freq, a.currentTime + delay)
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, a.currentTime + delay + dur)
      g.gain.setValueAtTime(gain, a.currentTime + delay)
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + dur)
      osc.start(a.currentTime + delay)
      osc.stop(a.currentTime + delay + dur + 0.01)
    } catch { /* AudioContext blocked or unavailable */ }
  }

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      localStorage.setItem('kiosk_muted', next ? '1' : '0')
      return next
    })
  }, [])

  return {
    muted,
    toggleMute,
    /** Soft key click — PIN / number pad taps */
    tap:        () => tone(1100, 0.055, 'sine', 0.07),
    /** Rising blip — QR code detected */
    scan:       () => { tone(520, 0.12, 'sine', 0.14); tone(880, 0.14, 'sine', 0.12, 0.1) },
    /** Two rising chime notes — successful check-in */
    success:    () => { tone(880, 0.18, 'sine', 0.22); tone(1174, 0.28, 'sine', 0.18, 0.16) },
    /** Descending thud — denied / suspended */
    denied:     () => tone(200, 0.45, 'triangle', 0.28, 0, 75),
    /** Double pulse — grace period warning */
    warning:    () => { tone(460, 0.17, 'triangle', 0.22); tone(460, 0.17, 'triangle', 0.22, 0.27) },
    /** Three quick beeps — day pass issued */
    passIssued: () => { tone(660, 0.08, 'square', 0.1); tone(660, 0.08, 'square', 0.1, 0.14); tone(880, 0.14, 'sine', 0.15, 0.28) },
  }
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function Clock({ size = 'sm', dark = false }: { size?: 'sm' | 'lg'; dark?: boolean }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const tc = dark ? 'rgba(255,255,255,0.93)' : S.text
  const sc = dark ? 'rgba(255,255,255,0.42)' : S.textMuted
  if (size === 'lg') return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '7.5rem', fontWeight: 900, color: tc, lineHeight: 1, letterSpacing: '-0.055em', fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 500, color: sc, marginTop: 12 }}>
        {now.toLocaleDateString('fr-CM', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tc, lineHeight: 1 }}>
        {now.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </span>
      <div style={{ width: 1, height: 14, background: S.border, flexShrink: 0 }} />
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: sc, lineHeight: 1 }}>
        {now.toLocaleDateString('fr-CM', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </div>
  )
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownRing({ duration, size = 52, color = 'rgba(255,255,255,0.55)' }: { duration: number; size?: number; color?: string }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={3} />
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={circ} initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: circ }}
        transition={{ duration: duration / 1000, ease: 'linear' }} />
    </svg>
  )
}

// ─── Referral card — 3D gift-box illustration ────────────────────────────────
function ReferralCard() {
  return (
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 210, background: 'radial-gradient(ellipse at 55% 35%, #93c5fd 0%, #60a5fa 22%, #3b82f6 55%, #1d4ed8 100%)' }}>
      {/* Centre highlight */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 52% 28%, rgba(255,255,255,0.2) 0%, transparent 58%)', pointerEvents: 'none' }} />

      {/* Pearl orbs */}
      {([
        { w: 16, h: 16, top: 30, left: 20 },
        { w: 10, h: 10, top: 78, right: 22 },
        { w: 13, h: 13, bottom: 26, right: 16 },
        { w:  8, h:  8, bottom: 54, left: 36 },
        { w: 11, h: 11, top: 110, left: 70 },
      ] as Array<Record<string, number>>).map((o, i) => (
        <div key={i} style={{ position: 'absolute', width: o.w, height: o.h, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, #ffffff, rgba(210,230,255,0.88))', boxShadow: '0 3px 10px rgba(0,0,0,0.14)', ...o }} />
      ))}

      {/* Small floating gift box — top-right */}
      <div style={{ position: 'absolute', top: 16, right: 22, transform: 'rotate(13deg)', width: 34, height: 32 }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
          <div style={{ width: 10, height: 7, background: 'rgba(255,255,255,0.88)', borderRadius: '50% 0 50% 50%', transform: 'rotate(8deg)' }} />
          <div style={{ width: 5, height: 5, background: 'rgba(255,255,255,0.95)', borderRadius: '50%', alignSelf: 'flex-end', marginBottom: 1 }} />
          <div style={{ width: 10, height: 7, background: 'rgba(255,255,255,0.88)', borderRadius: '0 50% 50% 50%', transform: 'rotate(-8deg)' }} />
        </div>
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 8, background: 'linear-gradient(to bottom,#4f86f7,#3b6ef0)', borderRadius: '3px 3px 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.6)', transform: 'translateX(-50%)' }} />
        </div>
        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, height: 12, background: 'linear-gradient(to bottom,#2563eb,#1d4ed8)', borderRadius: '0 0 5px 5px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.15)' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
        </div>
      </div>

      {/* Small floating gift box — mid-left area */}
      <div style={{ position: 'absolute', top: 26, left: 110, transform: 'rotate(-9deg)', width: 27, height: 25 }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
          <div style={{ width: 8, height: 6, background: 'rgba(255,255,255,0.85)', borderRadius: '50% 0 50% 50%', transform: 'rotate(8deg)' }} />
          <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.95)', borderRadius: '50%', alignSelf: 'flex-end', marginBottom: 1 }} />
          <div style={{ width: 8, height: 6, background: 'rgba(255,255,255,0.85)', borderRadius: '0 50% 50% 50%', transform: 'rotate(-8deg)' }} />
        </div>
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 7, background: 'linear-gradient(to bottom,#4f86f7,#3b6ef0)', borderRadius: '2px 2px 0 0' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.55)', transform: 'translateX(-50%)' }} />
        </div>
        <div style={{ position: 'absolute', top: 17, left: 0, right: 0, height: 8, background: 'linear-gradient(to bottom,#2563eb,#1d4ed8)', borderRadius: '0 0 4px 4px' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.45)', transform: 'translateX(-50%)' }} />
        </div>
      </div>

      {/* Main gift box — right side */}
      <div style={{ position: 'absolute', right: 16, bottom: 12, width: 128 }}>
        {/* Yellow discount tags flying out */}
        <div style={{ position: 'absolute', bottom: 82, left: -14, zIndex: 3, width: 46, height: 58, background: 'linear-gradient(145deg,#fcd34d,#f59e0b)', borderRadius: 11, transform: 'rotate(-16deg)', boxShadow: '0 8px 20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>%</span>
        </div>
        <div style={{ position: 'absolute', bottom: 88, left: 20, zIndex: 2, width: 38, height: 48, background: 'linear-gradient(145deg,#fde68a,#fbbf24)', borderRadius: 11, transform: 'rotate(9deg)', boxShadow: '0 6px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>%</span>
        </div>

        {/* Lid — open / tilted back */}
        <div style={{ position: 'absolute', bottom: 64, left: -8, right: -8, height: 26, background: 'linear-gradient(to bottom,#60a5fa,#3b82f6)', borderRadius: '8px 8px 3px 3px', boxShadow: '0 -4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.22)', transform: 'rotate(-5deg)', transformOrigin: 'left bottom', zIndex: 4 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.65)', transform: 'translateX(-50%)', borderRadius: 2 }} />
          {/* Bow */}
          <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 15, height: 11, background: 'rgba(255,255,255,0.92)', borderRadius: '50% 0 50% 50%', transform: 'rotate(12deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }} />
            <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', zIndex: 1, marginInline: -1, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
            <div style={{ width: 15, height: 11, background: 'rgba(255,255,255,0.92)', borderRadius: '0 50% 50% 50%', transform: 'rotate(-12deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }} />
          </div>
        </div>

        {/* Box body */}
        <div style={{ position: 'relative', height: 66, background: 'linear-gradient(to bottom,#2563eb,#1d4ed8)', borderRadius: '3px 3px 14px 14px', boxShadow: '0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)', zIndex: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, background: 'rgba(255,255,255,0.58)', transform: 'translateX(-50%)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', top: '42%', left: 0, right: 0, height: 2.5, background: 'rgba(255,255,255,0.28)', borderRadius: 2 }} />
        </div>
      </div>

      {/* Text — left side */}
      <div style={{ position: 'absolute', left: 20, bottom: 18, right: 152 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.32)', borderRadius: 99, padding: '3px 10px', marginBottom: 10, backdropFilter: 'blur(6px)' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'white', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Member Offer</span>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.18, whiteSpace: 'pre-line' }}>{'Refer a friend,\nget 1 month free.'}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.72)', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>Ask staff for your personal referral code</div>
      </div>
    </div>
  )
}

// ─── Component: auto-rotating promotional photo card carousel ────────────────
// ─── Live check-in welcome overlay ───────────────────────────────────────────
function WelcomeOverlay({
  checkin, brand, onDismiss,
}: {
  checkin: { name: string; avatar_url?: string | null; method: string }
  brand: string
  onDismiss: () => void
}) {
  const initials = checkin.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const methodLabel = checkin.method === 'qr' ? 'App QR' : checkin.method === 'pin' ? 'PIN' : 'Search'

  return (
    <motion.div
      key="welcome-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 32, padding: '48px 56px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          minWidth: 380, maxWidth: 480,
          boxShadow: `0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)`,
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: checkin.avatar_url ? 'transparent' : brand,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', boxShadow: `0 0 0 4px ${brand}30`,
          marginBottom: 4,
        }}>
          {checkin.avatar_url
            ? <img src={checkin.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '2rem', fontWeight: 900, color: 'white' }}>{initials}</span>
          }
        </div>

        {/* Greeting */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: brand, marginBottom: 6 }}>Check-in confirmed</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0D0D18', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            Welcome back,<br />{checkin.name.split(' ')[0]}!
          </div>
        </div>

        {/* Method badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${brand}12`, border: `1px solid ${brand}28`,
          borderRadius: 99, padding: '6px 14px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: brand, letterSpacing: '0.08em' }}>via {methodLabel}</span>
        </div>

        {/* Auto-dismiss progress bar */}
        <div style={{ width: '100%', height: 3, borderRadius: 99, background: '#f0f0f5', overflow: 'hidden', marginTop: 8 }}>
          <motion.div
            initial={{ width: '100%' }} animate={{ width: '0%' }}
            transition={{ duration: 6, ease: 'linear' }}
            style={{ height: '100%', background: brand, borderRadius: 99 }}
          />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 500 }}>Tap anywhere to dismiss</div>
      </motion.div>
    </motion.div>
  )
}

type _PhotoSlide = { type: 'photo'; photo: string; badge: string; headline: string; sub: string; position: string }
type _ReferralSlide = { type: 'referral' }
type _PromoSlide = _PhotoSlide | _ReferralSlide

const PROMO_SLIDES: _PromoSlide[] = [
  { type: 'referral' },
  {
    type: 'photo',
    photo: '/gym-fitness.png',
    badge: 'Stay motivated',
    headline: 'Push your\nlimits today.',
    sub: 'Every session gets you closer to your goal',
    position: 'center center',
  },
  {
    type: 'photo',
    photo: '/pushup.png',
    badge: 'New here?',
    headline: 'Try a day pass\nand feel the difference.',
    sub: 'No membership needed · Pay at reception',
    position: 'center 20%',
  },
]

function PromoCarousel({ brand }: { brand: string }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PROMO_SLIDES.length), 6000)
    return () => clearInterval(t)
  }, [])
  const slide = PROMO_SLIDES[idx]
  return (
    <AnimatePresence mode="wait">
      <motion.div key={idx}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        {slide.type === 'referral' ? <ReferralCard /> : (
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: 210 }}>
            <img src={slide.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: slide.position }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 40%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 45%, transparent 75%)' }} />
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 99, padding: '3px 10px', marginBottom: 10, backdropFilter: 'blur(6px)' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'white', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{slide.badge}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.18, whiteSpace: 'pre-line' }}>{slide.headline}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.58)', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>{slide.sub}</div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Icon: custom brand check-in scan frame icon ─────────────────────────────
function CheckinScanIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M9.94358 1.25L10 1.25C10.4142 1.25 10.75 1.58579 10.75 2C10.75 2.41421 10.4142 2.75 10 2.75C8.09318 2.75 6.73851 2.75159 5.71085 2.88976C4.70476 3.02502 4.12511 3.27869 3.7019 3.7019C3.27869 4.12511 3.02502 4.70476 2.88976 5.71085C2.75159 6.73851 2.75 8.09318 2.75 10C2.75 10.4142 2.41421 10.75 2 10.75C1.58579 10.75 1.25 10.4142 1.25 10L1.25 9.94358C1.24998 8.10582 1.24997 6.65019 1.40314 5.51098C1.56076 4.33856 1.89288 3.38961 2.64124 2.64124C3.38961 1.89288 4.33856 1.56076 5.51098 1.40314C6.65019 1.24997 8.10582 1.24998 9.94358 1.25ZM18.2892 2.88976C17.2615 2.75159 15.9068 2.75 14 2.75C13.5858 2.75 13.25 2.41421 13.25 2C13.25 1.58579 13.5858 1.25 14 1.25L14.0564 1.25C15.8942 1.24998 17.3498 1.24997 18.489 1.40314C19.6614 1.56076 20.6104 1.89288 21.3588 2.64124C22.1071 3.38961 22.4392 4.33856 22.5969 5.51098C22.75 6.65019 22.75 8.10583 22.75 9.94359V10C22.75 10.4142 22.4142 10.75 22 10.75C21.5858 10.75 21.25 10.4142 21.25 10C21.25 8.09318 21.2484 6.73851 21.1102 5.71085C20.975 4.70476 20.7213 4.12511 20.2981 3.7019C19.8749 3.27869 19.2952 3.02502 18.2892 2.88976ZM2 13.25C2.41421 13.25 2.75 13.5858 2.75 14C2.75 15.9068 2.75159 17.2615 2.88976 18.2892C3.02502 19.2952 3.27869 19.8749 3.7019 20.2981C4.12511 20.7213 4.70476 20.975 5.71085 21.1102C6.73851 21.2484 8.09318 21.25 10 21.25C10.4142 21.25 10.75 21.5858 10.75 22C10.75 22.4142 10.4142 22.75 10 22.75H9.94359C8.10583 22.75 6.65019 22.75 5.51098 22.5969C4.33856 22.4392 3.38961 22.1071 2.64124 21.3588C1.89288 20.6104 1.56076 19.6614 1.40314 18.489C1.24997 17.3498 1.24998 15.8942 1.25 14.0564L1.25 14C1.25 13.5858 1.58579 13.25 2 13.25ZM22 13.25C22.4142 13.25 22.75 13.5858 22.75 14V14.0564C22.75 15.8942 22.75 17.3498 22.5969 18.489C22.4392 19.6614 22.1071 20.6104 21.3588 21.3588C20.6104 22.1071 19.6614 22.4392 18.489 22.5969C17.3498 22.75 15.8942 22.75 14.0564 22.75H14C13.5858 22.75 13.25 22.4142 13.25 22C13.25 21.5858 13.5858 21.25 14 21.25C15.9068 21.25 17.2615 21.2484 18.2892 21.1102C19.2952 20.975 19.8749 20.7213 20.2981 20.2981C20.7213 19.8749 20.975 19.2952 21.1102 18.2892C21.2484 17.2615 21.25 15.9068 21.25 14C21.25 13.5858 21.5858 13.25 22 13.25Z" fill="#0f172a" />
      <path opacity="0.4" d="M10 5.5H14C15.8856 5.5 16.8284 5.5 17.4142 6.08579C17.9642 6.63575 17.9978 7.5004 17.9999 9.16448L18 12.0167V14.5C18 16.3856 18 17.3284 17.4142 17.9142C16.8284 18.5 15.8856 18.5 14 18.5H10C8.11438 18.5 7.17157 18.5 6.58579 17.9142C6 17.3284 6 16.3856 6 14.5V12.0167L6.00013 9.16449C6.00219 7.5004 6.03582 6.63575 6.58579 6.08579C7.17157 5.5 8.11438 5.5 10 5.5Z" fill={color} />
      <path d="M18.3693 9.29994C18.2513 9.25455 18.1281 9.20929 17.9999 9.16445C16.1667 8.38595 11.2002 7.29605 6.00013 9.16446C5.87187 9.20929 5.74878 9.25456 5.63078 9.29994C4.9385 9.5662 4.42459 9.83556 4.07665 10.0443C3.90273 10.1487 3.77043 10.2378 3.67815 10.3037C3.63202 10.3367 3.59589 10.3638 3.56958 10.3842C3.55642 10.3943 3.54572 10.4028 3.53745 10.4094L3.52685 10.418L3.52291 10.4213L3.52128 10.4226L3.51988 10.4238C3.20167 10.689 3.15868 11.1619 3.42385 11.4801C3.68807 11.7971 4.15855 11.841 4.47672 11.579L4.4871 11.5708C4.49868 11.5619 4.51958 11.546 4.55001 11.5243C4.61086 11.4808 4.7098 11.4137 4.84839 11.3306C5.12545 11.1643 5.56153 10.9337 6.16925 10.7C7.38288 10.2332 9.29159 9.74995 12 9.74995C14.7085 9.74995 16.6172 10.2332 17.8308 10.7C18.4385 10.9337 18.8746 11.1643 19.1516 11.3306C19.2902 11.4137 19.3892 11.4808 19.45 11.5243C19.4805 11.546 19.5014 11.5619 19.5129 11.5708L19.5233 11.579C19.8415 11.841 20.312 11.7971 20.5762 11.4801C20.8414 11.1619 20.7984 10.689 20.4802 10.4238L20 10.9999C20.4802 10.4238 20.4788 10.4226 20.4788 10.4226L20.4771 10.4213L20.4732 10.418L20.4626 10.4094C20.4543 10.4028 20.4436 10.3943 20.4305 10.3842C20.4041 10.3638 20.368 10.3367 20.3219 10.3037C20.2296 10.2378 20.0973 10.1487 19.9234 10.0443C19.5755 9.83556 19.0615 9.5662 18.3693 9.29994Z" fill={color} />
    </svg>
  )
}

// ─── Icon: custom brand PIN entry icon ───────────────────────────────────────
function PinEntryIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.3142 3.68576L20.8446 3.15543V3.15543L20.3142 3.68576ZM20.3142 11.8253L20.8446 12.3557V12.3557L20.3142 11.8253ZM10.4547 10.057L9.92432 9.52663L9.92432 9.52663L10.4547 10.057ZM7.36124 13.1504L7.89157 13.6807H7.89157L7.36124 13.1504ZM10.8496 16.6388L10.3193 16.1084L10.3193 16.1084L10.8496 16.6388ZM13.9433 13.5451L13.4129 13.0148V13.0148L13.9433 13.5451ZM7.00755 14.1587L6.26214 14.2415L6.26214 14.2415L7.00755 14.1587ZM7.20094 15.8992L6.45553 15.982L6.45553 15.982L7.20094 15.8992ZM8.10084 16.7991L8.01802 17.5445L8.01802 17.5445L8.10084 16.7991ZM9.84133 16.9924L9.92416 16.247H9.92416L9.84133 16.9924ZM7.43673 16.3898L7.96707 15.8594L7.96706 15.8594L7.43673 16.3898ZM7.61025 16.5633L7.07991 17.0936L7.07992 17.0936L7.61025 16.5633ZM10.6703 9.1926L9.94383 9.37914L9.94383 9.37914L10.6703 9.1926ZM14.8074 13.3297L14.6209 14.0562H14.6209L14.8074 13.3297ZM10.9532 13.6303C10.6587 13.339 10.1838 13.3416 9.89252 13.6361C9.60124 13.9306 9.60385 14.4055 9.89835 14.6967L10.4258 14.1635L10.9532 13.6303ZM14.9882 9.01184L15.5185 8.48151C15.1605 8.12353 15.1605 7.54313 15.5185 7.18515L14.9882 6.65482L14.4578 6.12449C13.5141 7.06826 13.5141 8.59841 14.4578 9.54217L14.9882 9.01184ZM17.3452 9.01184L16.8148 8.48151C16.4569 8.83949 15.8765 8.83949 15.5185 8.48151L14.9882 9.01184L14.4578 9.54217C15.4016 10.4859 16.9317 10.4859 17.8755 9.54217L17.3452 9.01184ZM17.3452 6.65482L16.8148 7.18515C17.1728 7.54313 17.1728 8.12353 16.8148 8.48151L17.3452 9.01184L17.8755 9.54217C18.8193 8.59841 18.8193 7.06826 17.8755 6.12449L17.3452 6.65482ZM17.3452 6.65482L17.8755 6.12449C16.9317 5.18072 15.4016 5.18072 14.4578 6.12449L14.9882 6.65482L15.5185 7.18515C15.8765 6.82717 16.4569 6.82717 16.8148 7.18515L17.3452 6.65482ZM20.3142 3.68576L19.7839 4.21609C21.7387 6.17088 21.7387 9.34021 19.7839 11.295L20.3142 11.8253L20.8446 12.3557C23.3851 9.81509 23.3851 5.696 20.8446 3.15543L20.3142 3.68576ZM20.3142 3.68576L20.8446 3.15543C18.304 0.614857 14.1849 0.614857 11.6443 3.15543L12.1747 3.68576L12.705 4.21609C14.6598 2.2613 17.8291 2.2613 19.7839 4.21609L20.3142 3.68576ZM10.4547 10.057L9.92432 9.52663L6.83091 12.62L7.36124 13.1504L7.89157 13.6807L10.985 10.5873L10.4547 10.057ZM10.8496 16.6388L11.38 17.1691L12.4136 16.1354L11.8833 15.6051L11.353 15.0748L10.3193 16.1084L10.8496 16.6388ZM11.8833 15.6051L12.4136 16.1354L14.4736 14.0754L13.9433 13.5451L13.4129 13.0148L11.353 15.0748L11.8833 15.6051ZM7.00755 14.1587L6.26214 14.2415L6.45553 15.982L7.20094 15.8992L7.94635 15.8163L7.75296 14.0758L7.00755 14.1587ZM8.10084 16.7991L8.01802 17.5445L9.75851 17.7379L9.84133 16.9924L9.92416 16.247L8.18367 16.0536L8.10084 16.7991ZM7.43673 16.3898L6.9064 16.9201L7.07991 17.0936L7.61025 16.5633L8.14058 16.0329L7.96707 15.8594L7.43673 16.3898ZM8.10084 16.7991L8.18367 16.0536C8.16736 16.0518 8.15217 16.0445 8.14058 16.0329L7.61025 16.5633L7.07992 17.0936C7.33236 17.346 7.6632 17.505 8.01802 17.5445L8.10084 16.7991ZM7.20094 15.8992L6.45553 15.982C6.49495 16.3368 6.65396 16.6676 6.9064 16.9201L7.43673 16.3898L7.96706 15.8594C7.95547 15.8478 7.94816 15.8326 7.94635 15.8163L7.20094 15.8992ZM10.8496 16.6388L10.3193 16.1084C10.2155 16.2122 10.0701 16.2633 9.92416 16.247L9.84133 16.9924L9.75851 17.7379C10.3573 17.8044 10.9539 17.5951 11.38 17.1691L10.8496 16.6388ZM7.36124 13.1504L6.83091 12.62C6.40488 13.0461 6.1956 13.6427 6.26214 14.2415L7.00755 14.1587L7.75296 14.0758C7.73675 13.9299 7.78775 13.7845 7.89157 13.6807L7.36124 13.1504ZM10.6703 9.1926L11.3967 9.00605C10.9704 7.34603 11.4077 5.51341 12.705 4.21609L12.1747 3.68576L11.6443 3.15543C9.95676 4.84301 9.3911 7.22673 9.94383 9.37914L10.6703 9.1926ZM20.3142 11.8253L19.7839 11.295C18.4866 12.5923 16.654 13.0296 14.9939 12.6033L14.8074 13.3297L14.6209 14.0562C16.7733 14.6089 19.157 14.0432 20.8446 12.3557L20.3142 11.8253ZM13.9433 13.5451L14.4736 14.0754C14.4807 14.0684 14.4935 14.0591 14.5182 14.0532C14.5444 14.047 14.5805 14.0458 14.6209 14.0562L14.8074 13.3297L14.9939 12.6033C14.4675 12.4681 13.8509 12.5768 13.4129 13.0148L13.9433 13.5451ZM10.4547 10.057L10.985 10.5873C11.4227 10.1495 11.532 9.53285 11.3967 9.00605L10.6703 9.1926L9.94383 9.37914C9.95415 9.41931 9.95302 9.45541 9.94673 9.48175C9.94081 9.50657 9.93144 9.51951 9.92432 9.52663L10.4547 10.057ZM11.8833 15.6051L12.4107 15.0719L10.9532 13.6303L10.4258 14.1635L9.89835 14.6967L11.3559 16.1383L11.8833 15.6051Z" fill={color} />
      <path d="M22 14.993C21.9361 17.787 21.6692 19.419 20.5542 20.5341C19.0882 22 16.7288 22 12.0101 22C7.29127 22 4.93188 22 3.46594 20.5341C2 19.0681 2 16.7087 2 11.9899C2 7.27117 2 4.91177 3.46594 3.44584C4.58099 2.33078 6.21298 2.06388 9.00704 2" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Icon: custom members group icon (search empty state) ────────────────────
function MembersGroupIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.5 7.5C15.5 9.433 13.933 11 12 11C10.067 11 8.5 9.433 8.5 7.5C8.5 5.567 10.067 4 12 4C13.933 4 15.5 5.567 15.5 7.5Z" fill={color} />
      <path opacity="0.45" d="M19.5 7.5C19.5 8.88071 18.3807 10 17 10C15.6193 10 14.5 8.88071 14.5 7.5C14.5 6.11929 15.6193 5 17 5C18.3807 5 19.5 6.11929 19.5 7.5Z" fill={color} />
      <path opacity="0.45" d="M4.5 7.5C4.5 8.88071 5.61929 10 7 10C8.38071 10 9.5 8.88071 9.5 7.5C9.5 6.11929 8.38071 5 7 5C5.61929 5 4.5 6.11929 4.5 7.5Z" fill={color} />
      <path d="M18 16.5C18 18.433 15.3137 20 12 20C8.68629 20 6 18.433 6 16.5C6 14.567 8.68629 13 12 13C15.3137 13 18 14.567 18 16.5Z" fill={color} />
      <path opacity="0.45" d="M22 16.5C22 17.8807 20.2091 19 18 19C15.7909 19 14 17.8807 14 16.5C14 15.1193 15.7909 14 18 14C20.2091 14 22 15.1193 22 16.5Z" fill={color} />
      <path opacity="0.45" d="M2 16.5C2 17.8807 3.79086 19 6 19C8.20914 19 10 17.8807 10 16.5C10 15.1193 8.20914 14 6 14C3.79086 14 2 15.1193 2 16.5Z" fill={color} />
    </svg>
  )
}

// ─── Icon: custom brand member search icon ────────────────────────────────────
function SearchMemberIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="6" r="4" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M13.5126 21.4874C14.0251 22 14.8501 22 16.5 22C18.1499 22 18.9749 22 19.4874 21.4874C20 20.9749 20 20.1499 20 18.5C20 16.8501 20 16.0251 19.4874 15.5126C18.9749 15 18.1499 15 16.5 15C14.8501 15 14.0251 15 13.5126 15.5126C13 16.0251 13 16.8501 13 18.5C13 20.1499 13 20.9749 13.5126 21.4874ZM15.9167 17.9167H14.9444C14.6223 17.9167 14.3611 18.1778 14.3611 18.5C14.3611 18.8222 14.6223 19.0833 14.9444 19.0833H15.9167H17.0833H18.0556C18.3777 19.0833 18.6389 18.8222 18.6389 18.5C18.6389 18.1778 18.3777 17.9167 18.0556 17.9167H17.0833H15.9167Z" fill={color} />
      <path opacity="0.4" d="M18.0947 15.0312C17.6699 15 17.1487 15 16.5 15C14.8501 15 14.0251 15 13.5126 15.5126C13 16.0251 13 16.8501 13 18.5C13 19.6663 13 20.4204 13.1811 20.9433C12.7971 20.9806 12.4025 21 12 21C8.13401 21 5 19.2091 5 17C5 14.7909 8.13401 13 12 13C14.6134 13 16.8924 13.8184 18.0947 15.0312Z" fill={color} />
    </svg>
  )
}

// ─── Icon: custom brand scan-with-app QR icon ────────────────────────────────
function ScanWithAppIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.12911 5.29493C5 5.47689 5 5.73459 5 6.25C5 6.76541 5 7.02311 5.12911 7.20507C5.17467 7.26928 5.23073 7.32534 5.29493 7.37089C5.47689 7.5 5.73459 7.5 6.25 7.5C6.76541 7.5 7.02311 7.5 7.20507 7.37089C7.26928 7.32534 7.32534 7.26928 7.37089 7.20507C7.5 7.02311 7.5 6.76541 7.5 6.25C7.5 5.73459 7.5 5.47689 7.37089 5.29493C7.32534 5.23073 7.26928 5.17467 7.20507 5.12911C7.02311 5 6.76541 5 6.25 5C5.73459 5 5.47689 5 5.29493 5.12911C5.23073 5.17467 5.17467 5.23073 5.12911 5.29493Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M8.70415 1.29021C9.14651 1.33227 9.55876 1.42353 9.93687 1.65524C10.3069 1.88199 10.618 2.1931 10.8448 2.56313C11.0765 2.94125 11.1677 3.35349 11.2098 3.79585C11.25 4.21899 11.25 4.73995 11.25 5.36422L11.25 6.552C11.25 7.45046 11.2501 8.19971 11.1701 8.79448C11.0857 9.42228 10.9 9.98908 10.4445 10.4445C9.98908 10.9 9.42228 11.0857 8.79448 11.1701C8.19971 11.2501 7.4505 11.25 6.55203 11.25L5.3643 11.25C4.74004 11.25 4.21899 11.25 3.79585 11.2098C3.35349 11.1677 2.94125 11.0765 2.56313 10.8448C2.1931 10.618 1.88199 10.3069 1.65524 9.93687C1.42353 9.55876 1.33227 9.14651 1.29021 8.70415C1.24997 8.281 1.24999 7.76 1.25 7.13571V7.06235C1.24999 6.11229 1.24998 5.34606 1.30863 4.72927C1.36911 4.09318 1.49721 3.53898 1.8026 3.04063C2.11181 2.53605 2.53605 2.11181 3.04063 1.8026C3.53898 1.49721 4.09318 1.36911 4.72927 1.30863C5.34607 1.24998 6.11227 1.24999 7.06233 1.25H7.13569C7.75999 1.24999 8.281 1.24997 8.70415 1.29021ZM8.56217 2.78347C8.21845 2.75079 7.76921 2.75 7.1 2.75C6.10345 2.75 5.4087 2.75079 4.87125 2.80189C4.34496 2.85193 4.04744 2.94487 3.82438 3.08156C3.52163 3.26709 3.26709 3.52163 3.08156 3.82438C2.94487 4.04744 2.85193 4.34496 2.80189 4.87125C2.75079 5.4087 2.75 6.10345 2.75 7.1C2.75 7.76921 2.75079 8.21845 2.78347 8.56217C2.81509 8.89473 2.87119 9.0503 2.9342 9.15312C3.03727 9.32132 3.17868 9.46273 3.34688 9.5658C3.4497 9.62881 3.60527 9.68491 3.93783 9.71653C4.28155 9.74921 4.73079 9.75 5.4 9.75H6.5C7.46401 9.75 8.11157 9.74841 8.59461 9.68347C9.05607 9.62142 9.25357 9.5142 9.38389 9.38389C9.5142 9.25357 9.62142 9.05607 9.68347 8.59461C9.74841 8.11157 9.75 7.46401 9.75 6.5V5.4C9.75 4.73079 9.74921 4.28155 9.71653 3.93783C9.68491 3.60527 9.62881 3.4497 9.5658 3.34688C9.46273 3.17868 9.32132 3.03727 9.15312 2.9342C9.0503 2.87119 8.89473 2.81509 8.56217 2.78347Z" fill={color} />
      <path d="M16.6291 5.29493C16.5 5.47689 16.5 5.73459 16.5 6.25C16.5 6.76541 16.5 7.02311 16.6291 7.20507C16.6747 7.26928 16.7307 7.32534 16.7949 7.37089C16.9769 7.5 17.2346 7.5 17.75 7.5C18.2654 7.5 18.5231 7.5 18.7051 7.37089C18.7693 7.32534 18.8253 7.26928 18.8709 7.20507C19 7.02311 19 6.76541 19 6.25C19 5.73459 19 5.47689 18.8709 5.29493C18.8253 5.23073 18.7693 5.17467 18.7051 5.12911C18.5231 5 18.2654 5 17.75 5C17.2346 5 16.9769 5 16.7949 5.12911C16.7307 5.17467 16.6747 5.23073 16.6291 5.29493Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M16.8643 1.25H16.9377C17.8877 1.24999 18.6539 1.24998 19.2707 1.30863C19.9068 1.36911 20.461 1.49721 20.9594 1.8026C21.464 2.11181 21.8882 2.53605 22.1974 3.04063C22.5028 3.53898 22.6309 4.09318 22.6914 4.72927C22.75 5.34607 22.75 6.11227 22.75 7.06234V7.1357C22.75 7.76 22.75 8.281 22.7098 8.70415C22.6677 9.14651 22.5765 9.55876 22.3448 9.93687C22.118 10.3069 21.8069 10.618 21.4369 10.8448C21.0588 11.0765 20.6465 11.1677 20.2042 11.2098C19.781 11.25 19.2601 11.25 18.6359 11.25L17.448 11.25C16.5495 11.25 15.8003 11.2501 15.2055 11.1701C14.5777 11.0857 14.0109 10.9 13.5555 10.4445C13.1 9.98908 12.9143 9.42228 12.8299 8.79448C12.7499 8.1997 12.75 7.45048 12.75 6.552V5.36431C12.75 4.74001 12.75 4.21901 12.7902 3.79585C12.8323 3.35349 12.9235 2.94125 13.1552 2.56313C13.382 2.1931 13.6931 1.88199 14.0631 1.65524C14.4412 1.42353 14.8535 1.33227 15.2959 1.29021C15.719 1.24997 16.24 1.24999 16.8643 1.25ZM15.4378 2.78347C15.1053 2.81509 14.9497 2.87119 14.8469 2.9342C14.6787 3.03727 14.5373 3.17868 14.4342 3.34688C14.3712 3.4497 14.3151 3.60527 14.2835 3.93783C14.2508 4.28155 14.25 4.73079 14.25 5.4V6.5C14.25 7.46401 14.2516 8.11157 14.3165 8.59461C14.3786 9.05607 14.4858 9.25357 14.6161 9.38389C14.7464 9.5142 14.9439 9.62142 15.4054 9.68347C15.8884 9.74841 16.536 9.75 17.5 9.75H18.6C19.2692 9.75 19.7184 9.74921 20.0622 9.71653C20.3947 9.68491 20.5503 9.62881 20.6531 9.5658C20.8213 9.46273 20.9627 9.32132 21.0658 9.15312C21.1288 9.0503 21.1849 8.89473 21.2165 8.56217C21.2492 8.21845 21.25 7.76921 21.25 7.1C21.25 6.10345 21.2492 5.4087 21.1981 4.87125C21.1481 4.34496 21.0551 4.04744 20.9184 3.82438C20.7329 3.52163 20.4784 3.26709 20.1756 3.08156C19.9526 2.94487 19.655 2.85193 19.1288 2.80189C18.5913 2.75079 17.8966 2.75 16.9 2.75C16.2308 2.75 15.7816 2.75079 15.4378 2.78347Z" fill={color} />
      <path d="M5 17.75C5 17.2346 5 16.9769 5.12911 16.7949C5.17467 16.7307 5.23073 16.6747 5.29493 16.6291C5.47689 16.5 5.73459 16.5 6.25 16.5C6.76541 16.5 7.02311 16.5 7.20507 16.6291C7.26928 16.6747 7.32534 16.7307 7.37089 16.7949C7.5 16.9769 7.5 17.2346 7.5 17.75C7.5 18.2654 7.5 18.5231 7.37089 18.7051C7.32534 18.7693 7.26928 18.8253 7.20507 18.8709C7.02311 19 6.76541 19 6.25 19C5.73459 19 5.47689 19 5.29493 18.8709C5.23073 18.8253 5.17467 18.7693 5.12911 18.7051C5 18.5231 5 18.2654 5 17.75Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M8.79448 12.8299C9.42228 12.9143 9.98908 13.1 10.4445 13.5555C10.9 14.0109 11.0857 14.5777 11.1701 15.2055C11.2501 15.8003 11.25 16.5495 11.25 17.448L11.25 18.6357C11.25 19.2599 11.25 19.781 11.2098 20.2042C11.1677 20.6465 11.0765 21.0588 10.8448 21.4369C10.618 21.8069 10.3069 22.118 9.93687 22.3448C9.55876 22.5765 9.14651 22.6677 8.70415 22.7098C8.281 22.75 7.76 22.75 7.1357 22.75H7.06234C6.11227 22.75 5.34607 22.75 4.72927 22.6914C4.09318 22.6309 3.53898 22.5028 3.04063 22.1974C2.53605 21.8882 2.11181 21.464 1.8026 20.9594C1.49721 20.461 1.36911 19.9068 1.30863 19.2707C1.24998 18.6539 1.24999 17.8877 1.25 16.9377V16.8643C1.24999 16.24 1.24997 15.719 1.29021 15.2959C1.33227 14.8535 1.42353 14.4412 1.65524 14.0631C1.88199 13.6931 2.1931 13.382 2.56313 13.1552C2.94125 12.9235 3.35349 12.8323 3.79585 12.7902C4.21901 12.75 4.74001 12.75 5.36431 12.75H6.552C7.45048 12.75 8.1997 12.7499 8.79448 12.8299ZM8.59461 14.3165C8.11157 14.2516 7.46401 14.25 6.5 14.25H5.4C4.73079 14.25 4.28155 14.2508 3.93783 14.2835C3.60527 14.3151 3.4497 14.3712 3.34688 14.4342C3.17868 14.5373 3.03727 14.6787 2.9342 14.8469C2.87119 14.9497 2.81509 15.1053 2.78347 15.4378C2.75079 15.7816 2.75 16.2308 2.75 16.9C2.75 17.8966 2.75079 18.5913 2.80189 19.1288C2.85193 19.655 2.94487 19.9526 3.08156 20.1756C3.26709 20.4784 3.52163 20.7329 3.82438 20.9184C4.04744 21.0551 4.34496 21.1481 4.87125 21.1981C5.4087 21.2492 6.10345 21.25 7.1 21.25C7.76921 21.25 8.21845 21.2492 8.56217 21.2165C8.89473 21.1849 9.0503 21.1288 9.15312 21.0658C9.32132 20.9627 9.46273 20.8213 9.5658 20.6531C9.62881 20.5503 9.68491 20.3947 9.71653 20.0622C9.74921 19.7184 9.75 19.2692 9.75 18.6V17.5C9.75 16.536 9.74841 15.8884 9.68347 15.4054C9.62142 14.9439 9.5142 14.7464 9.38389 14.6161C9.25357 14.4858 9.05607 14.3786 8.59461 14.3165Z" fill={color} />
      <path d="M16.9617 12.75L19 12.75V14.25H17C16.2822 14.25 15.8002 14.2509 15.4328 14.2883C15.078 14.3244 14.914 14.3882 14.8055 14.4607C14.6691 14.5519 14.5519 14.6691 14.4607 14.8055C14.3882 14.914 14.3244 15.078 14.2883 15.4328C14.2509 15.8002 14.25 16.2822 14.25 17H12.75L12.75 16.9617C12.75 16.2921 12.75 15.7333 12.796 15.281C12.8442 14.8075 12.9489 14.3682 13.2135 13.9722C13.4141 13.6719 13.6719 13.4141 13.9722 13.2135C14.3682 12.9489 14.8075 12.8442 15.281 12.796C15.7333 12.75 16.2921 12.75 16.9617 12.75Z" fill="#0f172a" />
      <path d="M12.75 22V19H14.25V22C14.25 22.4142 13.9142 22.75 13.5 22.75C13.0858 22.75 12.75 22.4142 12.75 22Z" fill="#0f172a" />
      <path d="M22.75 13.5C22.75 13.0858 22.4142 12.75 22 12.75C21.5858 12.75 21.25 13.0858 21.25 13.5V17H22.75V13.5Z" fill="#0f172a" />
      <path d="M21.25 19C21.25 19.4762 21.2496 19.7958 21.2327 20.0433C21.2163 20.284 21.1868 20.4012 21.1549 20.4784C21.028 20.7846 20.7846 21.028 20.4784 21.1549C20.4012 21.1868 20.284 21.2163 20.0433 21.2327C19.7958 21.2496 19.4762 21.25 19 21.25H17V22.75H19.0253C19.4697 22.75 19.8408 22.75 20.1454 22.7292C20.4625 22.7076 20.762 22.661 21.0524 22.5407C21.7262 22.2616 22.2616 21.7262 22.5407 21.0524C22.661 20.762 22.7076 20.4625 22.7292 20.1454C22.75 19.8408 22.75 19.4698 22.75 19.0253V19H21.25Z" fill="#0f172a" />
      <path d="M16.1685 16.4444C16 16.6967 16 17.0478 16 17.75C16 18.4522 16 18.8033 16.1685 19.0556C16.2415 19.1648 16.3352 19.2585 16.4444 19.3315C16.6967 19.5 17.0478 19.5 17.75 19.5C18.4522 19.5 18.8033 19.5 19.0556 19.3315C19.1648 19.2585 19.2585 19.1648 19.3315 19.0556C19.5 18.8033 19.5 18.4522 19.5 17.75C19.5 17.0478 19.5 16.6967 19.3315 16.4444C19.2585 16.3352 19.1648 16.2415 19.0556 16.1685C18.8033 16 18.4522 16 17.75 16C17.0478 16 16.6967 16 16.4444 16.1685C16.3352 16.2415 16.2415 16.3352 16.1685 16.4444Z" fill={color} />
    </svg>
  )
}

// ─── Icon: custom brand calendar+search icon (classes) ───────────────────────
function ClassScheduleIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.96006 2C7.37758 2 7.71605 2.30996 7.71605 2.69231V4.08883C8.38663 4.07692 9.13829 4.07692 9.98402 4.07692H14.016C14.8617 4.07692 15.6134 4.07692 16.284 4.08883V2.69231C16.284 2.30996 16.6224 2 17.0399 2C17.4575 2 17.7959 2.30996 17.7959 2.69231V4.15008C19.2468 4.25647 20.1992 4.51758 20.899 5.15838C21.5987 5.79917 21.8838 6.67139 22 8V9H2V8C2.11618 6.67139 2.4013 5.79917 3.10104 5.15838C3.80079 4.51758 4.75323 4.25647 6.20406 4.15008V2.69231C6.20406 2.30996 6.54253 2 6.96006 2Z" fill="#0f172a" />
      <path opacity="0.4" d="M22 14V12C22 11.161 21.9873 9.66527 21.9744 9H2.00586C1.99296 9.66527 2.00564 11.161 2.00564 12V14C2.00564 17.7712 2.00564 19.6569 3.17688 20.8284C4.34813 22 6.23321 22 10.0034 22H14.0023C17.7724 22 19.6575 22 20.8288 20.8284C22 19.6569 22 17.7712 22 14Z" fill={color} />
      <path fillRule="evenodd" clipRule="evenodd" d="M18.75 16.5C17.5074 16.5 16.5 17.5074 16.5 18.75C16.5 19.9926 17.5074 21 18.75 21C19.9926 21 21 19.9926 21 18.75C21 17.5074 19.9926 16.5 18.75 16.5ZM15 18.75C15 16.6789 16.6789 15 18.75 15C20.8211 15 22.5 16.6789 22.5 18.75C22.5 19.5143 22.2713 20.2252 21.8787 20.818L23.2803 22.2197C23.5732 22.5126 23.5732 22.9874 23.2803 23.2803C22.9874 23.5732 22.5126 23.5732 22.2197 23.2803L20.818 21.8787C20.2252 22.2713 19.5143 22.5 18.75 22.5C16.6789 22.5 15 20.8211 15 18.75Z" fill={color} />
    </svg>
  )
}

// ─── Icon: custom brand walk-in/pass icon ─────────────────────────────────────
function WalkinIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.0374 9.85712C7.78266 9.72975 7.47314 9.84058 7.35714 10.1007L3.16447 19.5024C2.49741 20.9982 3.97865 22.5498 5.36641 21.8088L11.2701 18.6568C11.7293 18.4117 12.2697 18.4117 12.7289 18.6568L18.6326 21.8088C20.0204 22.5498 21.5016 20.9982 20.8346 19.5024L19.2629 15.9781C19.0743 15.5552 18.7448 15.2108 18.3307 15.0038L8.0374 9.85712Z" fill={color} />
      <path d="M8.6095 8.46672C8.37019 8.34707 8.26749 8.06023 8.37646 7.81587L10.5271 2.9933C11.1174 1.66955 12.8818 1.66955 13.4722 2.9933L17.4401 11.891C17.6313 12.3197 17.1797 12.7518 16.7598 12.5419L8.6095 8.46672Z" fill="#0f172a" opacity="0.85" />
    </svg>
  )
}

// ─── Graphic: ambient dot grid (dark screen texture) ─────────────────────────
function AmbientGrid({ opacity = 0.045, spacing = 28 }: { opacity?: number; spacing?: number }) {
  const id = `ag-${spacing}`
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <defs>
        <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={1.5} cy={1.5} r={1.5} fill={`rgba(255,255,255,${opacity})`} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

// ─── Graphic: diagonal line mesh for brand gradient cards ─────────────────────
function HeroPattern({ color = 'rgba(255,255,255,0.07)', spacing = 22 }: { color?: string; spacing?: number }) {
  const id = `hp-${spacing}`
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 'inherit', overflow: 'hidden', zIndex: 0 }}>
      <defs>
        <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={spacing} stroke={color} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

// ─── Graphic: animated SVG ring + checkmark (confirmation) ────────────────────
function CheckRing({ color, size = 140 }: { color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2; const cy = size / 2
  const ck = { x1: cx - size * 0.19, y1: cy + size * 0.02, x2: cx - size * 0.05, y2: cy + size * 0.17, x3: cx + size * 0.2, y3: cy - size * 0.14 }
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Ambient glow burst */}
      <motion.circle cx={cx} cy={cy} r={r + 4}
        fill="none" stroke={color} strokeWidth={24} opacity={0}
        animate={{ opacity: [0, 0.12, 0], r: [r + 4, r + 44] } as never}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
      />
      {/* Ring draws in */}
      <motion.circle cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: 0 }}
        style={{ rotate: -90, transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Check path draws in */}
      <motion.polyline
        points={`${ck.x1},${ck.y1} ${ck.x2},${ck.y2} ${ck.x3},${ck.y3}`}
        fill="none" stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

// ─── Graphic: animated SVG ring + X (denied) ─────────────────────────────────
function CrossRing({ size = 110 }: { size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2; const cy = size / 2; const p = size * 0.22
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <motion.circle cx={cx} cy={cy} r={r}
        fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth={3} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: 0 }}
        style={{ rotate: -90, transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      {[`M ${cx-p} ${cy-p} L ${cx+p} ${cy+p}`, `M ${cx+p} ${cy-p} L ${cx-p} ${cy+p}`].map((d, i) => (
        <motion.path key={i} d={d}
          fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth={4} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.28, delay: 0.42 + i * 0.07, ease: 'easeOut' }}
        />
      ))}
    </svg>
  )
}

// ─── Graphic: alert ring (grace / warning) ────────────────────────────────────
function AlertRing({ size = 110 }: { size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2; const cy = size / 2
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <motion.circle cx={cx} cy={cy} r={r}
        fill="none" stroke="rgba(245,158,11,0.75)" strokeWidth={3} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: 0 }}
        style={{ rotate: -90, transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Exclamation */}
      <motion.line x1={cx} y1={cy - size*0.2} x2={cx} y2={cy + size*0.02}
        stroke="rgba(245,158,11,0.95)" strokeWidth={4.5} strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, delay: 0.44 }}
      />
      <motion.circle cx={cx} cy={cy + size*0.14} r={2.5}
        fill="rgba(245,158,11,0.95)"
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ duration: 0.18, delay: 0.66 }}
      />
    </svg>
  )
}


// ─── Status bar ───────────────────────────────────────────────────────────────
function StatusBar({ isOnline, capacity, maxCapacity, offlineQueue, lang, setLang, t, gymName, logoInitials, onStaffAccess, muted, onToggleMute, brand }: {
  isOnline: boolean; capacity: number; maxCapacity: number; offlineQueue: number
  lang: Lang; setLang: (l: Lang) => void; t: typeof T['en']
  gymName: string; logoInitials: string; onStaffAccess: () => void
  muted: boolean; onToggleMute: () => void; brand: string
}) {
  const pct = Math.round((capacity / maxCapacity) * 100)
  const capColor = pct >= 90 ? S.danger : pct >= 70 ? S.amber : S.textMuted

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: 64,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: `1px solid ${S.border}`,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 0,
    }}>
      {/* Gym identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 20 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: brandGrad(brand), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${brandAlpha(brand, 0.3)}`, flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '-0.01em' }}>{logoInitials}</span>
        </div>
        <span style={{ fontSize: FS.sm, fontWeight: 800, color: S.text }}>{gymName}</span>
      </div>

      <div style={{ width: 1, height: 24, background: S.border, flexShrink: 0, marginRight: 20 }} />

      {/* Capacity — number + thin bar only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: FS['2xs'], fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.capacity}</span>
        <span style={{ fontSize: FS.xs, fontWeight: 800, color: capColor, fontVariantNumeric: 'tabular-nums' }}>{capacity}/{maxCapacity}</span>
        <div style={{ width: 72, height: 4, borderRadius: 99, background: S.surface, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ height: '100%', background: pct >= 90 ? S.danger : pct >= 70 ? S.amber : brand, borderRadius: 99 }} />
        </div>
      </div>

      {/* Offline badge — only when offline */}
      {offlineQueue > 0 && (
        <div style={{ marginLeft: 14, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(217,119,6,0.08)', border: `1px solid rgba(217,119,6,0.2)`, borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
          <Alert01Icon size={10} color={S.amber} />
          <span style={{ fontSize: FS['2xs'], fontWeight: 700, color: S.amber }}>{offlineQueue} {t.queued}</span>
        </div>
      )}

      {/* Right controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Online dot — no label */}
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? S.success : S.danger, boxShadow: `0 0 5px ${isOnline ? S.success : S.danger}`, flexShrink: 0 }} title={isOnline ? 'Online' : 'Offline'} />

        <Clock size="sm" />

        {/* Lang toggle */}
        <div style={{ display: 'flex', background: S.surface, borderRadius: 8, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          {(['en', 'fr'] as Lang[]).map(l => (
            <motion.div key={l} whileTap={{ scale: 0.9 }} onPointerUp={() => setLang(l)}
              style={{ padding: '5px 12px', background: lang === l ? brand : 'transparent', cursor: 'pointer', userSelect: 'none', transition: 'background 0.13s' }}>
              <span style={{ fontSize: FS['2xs'], fontWeight: 800, color: lang === l ? 'white' : S.textMuted }}>{l.toUpperCase()}</span>
            </motion.div>
          ))}
        </div>

        {/* Mute */}
        <motion.div whileTap={{ scale: 0.85 }} onPointerUp={e => { e.stopPropagation(); onToggleMute() }}
          style={{ width: 32, height: 32, borderRadius: 8, background: muted ? 'rgba(220,38,38,0.06)' : S.surface, border: `1px solid ${muted ? 'rgba(220,38,38,0.18)' : S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>
          {muted ? <VolumeMute01Icon size={15} color={S.danger} /> : <VolumeHighIcon size={15} color={S.textMuted} />}
        </motion.div>

        {/* Staff */}
        <motion.div whileTap={{ scale: 0.85 }} onPointerUp={e => { e.stopPropagation(); onStaffAccess() }}
          style={{ width: 32, height: 32, borderRadius: 8, background: S.surface, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>
          <UserStar01Icon size={15} color={S.textMuted} />
        </motion.div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const MOTIVATIONAL_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Push yourself — no one else is going to do it for you.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Don't limit your challenges. Challenge your limits.",
  "Train insane or remain the same.",
  "The pain you feel today is the strength you feel tomorrow.",
  "Sweat is just fat crying.",
  "Be stronger than your excuses.",
  "Every rep gets you closer.",
  "Consistency beats perfection.",
  "Make yourself proud.",
  "Earn it.",
]

const MILESTONE_VISITS = [10, 25, 50, 100, 200, 365, 500]

// ─── PIN numpad ───────────────────────────────────────────────────────────────
function PinPad({ value, onChange, onConfirm, onTap, brand, loading = false, locked = false, lockSecondsLeft = 0 }: {
  value: string; onChange: (v: string) => void; onConfirm: () => void; onTap?: () => void; brand: string
  loading?: boolean; locked?: boolean; lockSecondsLeft?: number
}) {
  const DIGITS = ['1','2','3','4','5','6','7','8','9']
  const [digitOrder, setDigitOrder] = useState(() => shuffle(DIGITS))

  // Reshuffle digits after each attempt (when value resets to '')
  useEffect(() => {
    if (value === '') setDigitOrder(shuffle(DIGITS))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Physical keyboard support
  useEffect(() => {
    if (locked || loading) return
    function onKey(e: KeyboardEvent) {
      const d = e.key
      if ((d >= '0' && d <= '9') && value.length < 4) { onTap?.(); onChange(value + d) }
      else if (d === 'Backspace' && value.length > 0) { onTap?.(); onChange(value.slice(0, -1)) }
      else if (d === 'Enter' && value.length === 4) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, locked, loading, onChange, onConfirm, onTap])

  const rows = [
    digitOrder.slice(0, 3),
    digitOrder.slice(3, 6),
    digitOrder.slice(6, 9),
    ['⌫', '0', '✓'],
  ]

  // ── Locked state ──────────────────────────────────────────────────────────
  if (locked) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ display: 'flex', gap: 18 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: 'transparent', border: `2.5px solid ${S.danger}` }} />
        ))}
      </div>
      <motion.div animate={{ opacity: [1, 0.55, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
        style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: '3.5rem', fontWeight: 900, color: S.danger, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{lockSecondsLeft}s</div>
        <div style={{ fontSize: '0.82rem', color: S.textMuted, fontWeight: 600, marginTop: 10 }}>Too many attempts — please wait</div>
      </motion.div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      {/* PIN dots with spring + loading pulse */}
      <div style={{ display: 'flex', gap: 18 }}>
        {[0,1,2,3].map(i => {
          const filled = i < value.length
          return (
            <motion.div key={i}
              animate={
                loading ? { scale: [1, 1.22, 1], opacity: [1, 0.4, 1] }
                : filled && i === value.length - 1 ? { scale: [1, 1.45, 1] }
                : {}
              }
              transition={
                loading
                  ? { duration: 0.65, repeat: Infinity, delay: i * 0.13, ease: 'easeInOut' }
                  : { duration: 0.22, ease: [0.22, 1.8, 0.36, 1] }
              }
              style={{
                width: 20, height: 20, borderRadius: '50%',
                background: filled ? brand : 'transparent',
                border: `2.5px solid ${filled ? brand : S.border}`,
                boxShadow: filled ? `0 0 16px ${brandAlpha(brand, 0.5)}` : 'none',
              }} />
          )
        })}
      </div>
      {loading
        ? <div style={{ fontSize: '0.9rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.02em' }}>Verifying…</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 12 }}>
                {row.map(k => {
                  const isConfirm = k === '✓'
                  const isDel = k === '⌫'
                  const ready = isConfirm && value.length === 4
                  const empty = isDel && value.length === 0
                  return (
                    <motion.div key={`${ri}-${k}`} whileTap={{ scale: 0.82 }}
                      onPointerUp={() => {
                        if (isDel) { if (value.length > 0) { onTap?.(); onChange(value.slice(0, -1)) } }
                        else if (isConfirm) { if (value.length === 4) onConfirm() }
                        else if (value.length < 4) { onTap?.(); onChange(value + k) }
                      }}
                      style={{
                        width: 106, height: 106,
                        background: ready ? brandGrad(brand) : '#fff',
                        border: `1.5px solid ${ready ? brand : S.border}`,
                        borderRadius: 26,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: empty ? 'default' : 'pointer',
                        userSelect: 'none', transition: 'all 0.13s',
                        boxShadow: ready
                          ? `0 8px 32px ${brandAlpha(brand, 0.38)}, 0 2px 8px rgba(0,0,0,0.08)`
                          : `0 3px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)`,
                        opacity: empty ? 0.2 : 1,
                      }}>
                      <span style={{
                        fontSize: isDel || isConfirm ? '1.6rem' : '2.1rem',
                        fontWeight: isDel ? 400 : 700,
                        color: ready ? 'white' : isConfirm ? brand : isDel ? S.textMuted : S.text,
                        lineHeight: 1,
                      }}>{k}</span>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────
function BackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.div whileTap={{ scale: 0.91 }} whileHover={{ scale: 1.02 }} onPointerUp={onClick}
      style={{
        position: 'absolute', top: 76, left: 24,
        display: 'flex', alignItems: 'center', gap: 6,
        background: S.surface, border: `1px solid ${S.border}`,
        borderRadius: R.lg, padding: '10px 18px', cursor: 'pointer', userSelect: 'none',
      }}>
      <ArrowLeft01Icon size={15} color={S.textSub} />
      <span style={{ fontSize: FS.sm, fontWeight: 700, color: S.textSub }}>{label}</span>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, brand }: { icon: React.ElementType; title: string; brand: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: brandAlpha(brand, 0.08), border: `1.5px solid ${brandAlpha(brand, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={brand} />
      </div>
      <span style={{ fontSize: '1.55rem', fontWeight: 900, color: S.text, letterSpacing: '-0.025em' }}>{title}</span>
    </div>
  )
}

// ─── Step progress ────────────────────────────────────────────────────────────
function StepCircles({ step, total = 4, brand }: { step: number; total?: number; brand: string }) {
  const steps = ['Name', 'Phone', 'Pass', 'Pay']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < total - 1 ? 1 : 'none' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: i < step ? brand : i === step - 1 ? brandGrad(brand) : '#fff',
            border: `2px solid ${i < step ? brand : i === step - 1 ? brand : S.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s',
            boxShadow: i === step - 1 ? `0 0 0 5px ${brandAlpha(brand, 0.1)}` : 'none',
          }}>
            {i < step - 1
              ? <CheckmarkCircle01Icon size={18} color="white" />
              : <span style={{ fontSize: '0.82rem', fontWeight: 800, color: i === step - 1 ? 'white' : S.textMuted }}>{i + 1}</span>
            }
          </div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: i < step ? brand : S.textMuted, marginLeft: 6, whiteSpace: 'nowrap', display: i < total - 1 ? 'block' : 'none' }}>
            {steps[i]}
          </div>
          {i < total - 1 && (
            <div style={{ flex: 1, height: 2, background: i < step - 1 ? brand : S.border, margin: '0 10px', transition: 'background 0.25s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Auto return ──────────────────────────────────────────────────────────────
function AutoReturn({ onReturn, delay }: { onReturn: () => void; delay: number }) {
  useEffect(() => { const t = setTimeout(onReturn, delay); return () => clearTimeout(t) }, [])
  return null
}

// ─── Selectable tile ──────────────────────────────────────────────────────────
function Tile({ selected, onClick, children, accent }: { selected: boolean; onClick: () => void; children: React.ReactNode; accent?: string }) {
  const ac = accent ?? S.brand
  return (
    <motion.div whileTap={{ scale: 0.95 }} onPointerUp={onClick}
      style={{
        background: selected ? `${ac}0d` : '#fff',
        border: `2px solid ${selected ? ac : S.border}`,
        borderRadius: 20, padding: '20px 18px',
        cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
        boxShadow: selected
          ? `0 0 0 4px ${ac}18, 0 8px 24px ${ac}14`
          : '0 2px 6px rgba(0,0,0,0.05)',
      }}>
      {children}
    </motion.div>
  )
}

// ─── Kiosk fetch helpers ──────────────────────────────────────────────────────
// Pass X-Tenant-Slug header so the backend tenant middleware can resolve context
// without requiring a user JWT (kiosk is unauthenticated).

async function kGet<T>(path: string, slug: string): Promise<T> {
  const r = await fetch(path, slug ? { headers: { 'X-Tenant-Slug': slug } } : {})
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function kPost<T>(path: string, body: unknown, slug: string): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(slug ? { 'X-Tenant-Slug': slug } : {}) },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function kDelete<T>(path: string, slug: string): Promise<T> {
  const r = await fetch(path, {
    method: 'DELETE',
    headers: slug ? { 'X-Tenant-Slug': slug } : {},
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// ─── QR Camera Scanner ────────────────────────────────────────────────────────
// Uses the BarcodeDetector Web API (Chromium 83+) to read QR codes from the
// device camera. Falls back gracefully when the API or camera is unavailable.

function QRScanner({ onScan, active, onActivity, brand }: { onScan: (value: string) => void; active: boolean; onActivity?: () => void; brand: string }) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRef     = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'unsupported'>('starting')

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function start() {
      if (!('BarcodeDetector' in window)) { setStatus('unsupported'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        setStatus('scanning')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })

        const scan = async () => {
          if (cancelled || !videoRef.current) return
          onActivity?.() // keep idle timer alive while camera is active
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              const value = codes[0].rawValue as string
              const now = Date.now()
              // 2-second debounce: don't fire the same code repeatedly
              if (value && (value !== lastRef.current.value || now - lastRef.current.at > 2000)) {
                lastRef.current = { value, at: now }
                onScan(value)
              }
            }
          } catch { /* skip frame errors */ }
          timerRef.current = setTimeout(scan, 250)
        }
        timerRef.current = setTimeout(scan, 600)
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }

    start()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [active, onScan])

  if (status === 'unsupported' || status === 'denied') {
    return (
      <div style={{ width: 300, height: 300, border: `2px dashed ${S.border}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: S.surface }}>
        <QrCode01Icon size={52} color={S.textMuted} />
        <span style={{ fontSize: '0.8rem', color: S.textMuted, textAlign: 'center', maxWidth: 200, lineHeight: 1.6 }}>
          {status === 'denied' ? 'Camera access denied.' : 'Camera unavailable.'}<br/>Use your PIN or search below.
        </span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: 300, height: 300, borderRadius: 20, overflow: 'hidden', background: '#000', flexShrink: 0, boxShadow: '0 16px 48px rgba(0,0,0,0.22)' }}>
      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
      {/* L-shaped corner brackets */}
      {([
        { top: 12, left: 12, bTop: true, bLeft: true },
        { top: 12, right: 12, bTop: true, bRight: true },
        { bottom: 12, left: 12, bBottom: true, bLeft: true },
        { bottom: 12, right: 12, bBottom: true, bRight: true },
      ] as Array<{ top?: number; left?: number; right?: number; bottom?: number; bTop?: boolean; bLeft?: boolean; bRight?: boolean; bBottom?: boolean }>).map((pos, i) => (
        <motion.div key={i}
          animate={{ opacity: status === 'scanning' ? [0.7, 1, 0.7] : 1 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
          style={{
            position: 'absolute', width: 30, height: 30,
            top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom,
            borderTop:    pos.bTop    ? `4px solid ${brand}` : undefined,
            borderBottom: pos.bBottom ? `4px solid ${brand}` : undefined,
            borderLeft:   pos.bLeft   ? `4px solid ${brand}` : undefined,
            borderRight:  pos.bRight  ? `4px solid ${brand}` : undefined,
            borderRadius: i === 0 ? '4px 0 0 0' : i === 1 ? '0 4px 0 0' : i === 2 ? '0 0 0 4px' : '0 0 4px 0',
          }} />
      ))}
      {status === 'starting' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600 }}>Starting camera…</span>
        </div>
      )}
      {status === 'scanning' && (
        <motion.div
          animate={{ top: ['15%', '80%', '15%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', left: 16, right: 16, height: 3, background: `linear-gradient(90deg,transparent,${brand},${brandAlpha(brand, 0.6)},${brand},transparent)`, borderRadius: 2, boxShadow: `0 0 12px ${brand}` }}
        />
      )}
    </div>
  )
}

// ─── Hourly sparkline ─────────────────────────────────────────────────────────
function HourlySparkline({ scans }: { scans: Array<{ checked_in_at: string }> }) {
  const HOURS = 9
  const now = new Date()
  const buckets = Array.from({ length: HOURS }, (_, i) => {
    const h = new Date(now)
    h.setHours(h.getHours() - (HOURS - 1 - i), 0, 0, 0)
    return { label: h.toLocaleTimeString('en', { hour: 'numeric', hour12: true }), count: 0, isCurrent: i === HOURS - 1 }
  })
  for (const s of scans) {
    const diffH = Math.floor((now.getTime() - new Date(s.checked_in_at).getTime()) / 3_600_000)
    if (diffH < HOURS) {
      const idx = HOURS - 1 - diffH
      if (buckets[idx]) buckets[idx].count++
    }
  }
  const max = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, paddingBottom: 20, position: 'relative' }}>
      {buckets.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: S.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {b.count > 0 ? b.count : ''}
          </div>
          <div style={{
            width: '100%', borderRadius: 4,
            height: `${Math.max((b.count / max) * 44, b.count > 0 ? 6 : 2)}px`,
            background: b.isCurrent ? S.brand : b.count > 0 ? S.brandLight : S.border,
            border: b.isCurrent ? `1px solid ${S.brand}` : 'none',
            transition: 'height 0.3s ease',
          }} />
          <div style={{ fontSize: '0.55rem', color: b.isCurrent ? S.brand : S.textMuted, fontWeight: b.isCurrent ? 800 : 500, whiteSpace: 'nowrap', position: 'absolute', bottom: 0 }}>
            {b.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KioskPage() {
  const [screen, setScreen] = useState<Screen>('idle')
  const [lang, setLang] = useState<Lang>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KioskMember[]>([])
  const [checkedMember, setCheckedMember] = useState<KioskMember | null>(null)
  const [pinValue, setPinValue] = useState('')
  const [staffPin, setStaffPin] = useState('')
  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [selectedPass, setSelectedPass] = useState<typeof DAY_PASSES[0] | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mtn' | 'orange' | 'link' | 'wallet' | null>(null)
  const [walletPhone, setWalletPhone] = useState('')
  const [walletMember, setWalletMember] = useState<{ id: string; name: string; balance: number; currency: string } | null>(null)
  const [walletLooking, setWalletLooking] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [offlineQueue, setOfflineQueue] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [logoTaps, setLogoTaps] = useState(0)
  const [gymConfig, setGymConfig] = useState(DEFAULT_GYM)
  const [classes, setClasses] = useState<KioskClass[]>([])
  const [issuedPass, setIssuedPass] = useState<{ id: string; qrToken: string; amount: number; currency: string } | null>(null)
  const [sendingSMS, setSendingSMS] = useState(false)
  const [liveStats, setLiveStats] = useState({ today: 0, last_hour: 0, day_passes_today: 0, revenue_today: 0 })
  const [recentScans, setRecentScans] = useState<Array<{ id: string; name: string; method: string; checked_in_at: string; plan_name: string | null; expires_at: string | null; is_first_today: boolean }>>([])
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const shiftStartRef = useRef<Date | null>(null)
  const [shiftCount, setShiftCount] = useState(0)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [pinLockedUntil, setPinLockedUntil] = useState<number | null>(null)
  const [pinLockCountdown, setPinLockCountdown] = useState(0)
  const [dayPasses, setDayPasses] = useState(DAY_PASSES)
  const [staffInfo, setStaffInfo] = useState<{ id: string; name: string; role: string } | null>(null)
  const [denialReason, setDenialReason] = useState<string | null>(null)
  const [denialMessage, setDenialMessage] = useState<string | null>(null)
  const [liveCheckin, setLiveCheckin] = useState<{ name: string; avatar_url?: string | null; method: string } | null>(null)
  const [gymQrToken, setGymQrToken] = useState<string>('')
  const [linkPaymentData, setLinkPaymentData] = useState<{ payment_url: string; merchant_transaction_id: string; day_pass_id: string; qr_token: string; amount: number; currency: string } | null>(null)
  const [linkPolling, setLinkPolling] = useState(false)
  const [momoChargeData, setMomoChargeData] = useState<{ request_id: string; day_pass_id: string; qr_token: string; amount: number; currency: string } | null>(null)
  const [momoPolling, setMomoPolling] = useState(false)
  const [momoPhoneInput, setMomoPhoneInput] = useState('')
  const tenantSlugRef = useRef<string>('')
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sounds = useKioskSounds()

  const t = T[lang]
  const brand = gymConfig.brand   // live gym brand color, loaded from /api/settings/public

  const goHome = useCallback(() => {
    setScreen('home')
    setSearchQuery('')
    setCheckedMember(null)
    setPinValue('')
    setStaffPin('')
    setWalkinName('')
    setWalkinPhone('')
    setSelectedPass(null)
    setPaymentMethod(null)
    setIssuedPass(null)
    setMomoChargeData(null)
    setMomoPolling(false)
    setMomoPhoneInput('')
  }, [])

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setScreen('idle'), 60_000)
  }, [])

  // PIN lockout countdown
  useEffect(() => {
    if (!pinLockedUntil) return
    const t = setInterval(() => {
      const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000)
      if (remaining <= 0) { setPinLockedUntil(null); setPinLockCountdown(0); setPinAttempts(0) }
      else setPinLockCountdown(remaining)
    }, 500)
    return () => clearInterval(t)
  }, [pinLockedUntil])

  // Extract tenant slug from URL:
  //   1. ?t=<signed-jwt>  — production kiosk URL generated by admin
  //   2. ?slug=<slug>     — dev / direct access shortcut (e.g. /kiosk?slug=korafit)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('t')
      if (token) {
        const b64 = token.split('.')[1]
        const decoded = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((b64.length % 4) || 4)))
        if (decoded.tenant) tenantSlugRef.current = decoded.tenant
      }
      // fallback: plain ?slug= param for dev / direct access
      if (!tenantSlugRef.current) {
        const slug = params.get('slug')
        if (slug) tenantSlugRef.current = slug
      }
    } catch { /* no token — run with defaults */ }
  }, [])

  // Fetch public gym config + today's classes on mount
  useEffect(() => {
    const slug = tenantSlugRef.current
    kGet<Record<string, unknown>>('/api/settings/public', slug)
      .then(r => {
        const name = (r.gym_name as string) || DEFAULT_GYM.name
        const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
        setGymConfig(g => ({ ...g, name, brand: (r.primary_color as string) || g.brand, logoInitials: initials }))
      }).catch(() => {})

    const today    = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
    kGet<{ classes: Record<string, unknown>[] }>(`/api/classes/schedule?from=${today}&to=${tomorrow}`, slug)
      .then(r => {
        setClasses((r.classes ?? []).map(c => ({
          name:    c.name as string,
          trainer: (c.trainer_name as string) || 'TBA',
          time:    new Date(c.starts_at as string).toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit', hour12: false }),
          spots:   Math.max(0, ((c.capacity as number) || 0) - ((c.booked_count as number) || 0)),
        })))
      }).catch(() => {})

    kGet<{ pricing: Record<string, number> }>('/api/day-passes/pricing', slug)
      .then(r => {
        if (r.pricing) setDayPasses(DAY_PASSES.map(p => ({ ...p, price: r.pricing[p.id] ?? p.price })))
      }).catch(() => {})

    kGet<{ url: string }>('/api/checkin/qr-url', slug)
      .then(r => { if (r.url) setGymQrToken(r.url) })
      .catch(() => {})
  }, [])

  // Real online/offline tracking
  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => { setIsOnline(false); setOfflineQueue(q => q + 1) }
    setIsOnline(navigator.onLine)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // Clear offline badge when back online (no actual queue to replay — badge is informational only)
  useEffect(() => {
    if (isOnline) setOfflineQueue(0)
  }, [isOnline])

  // Live stats — load once on mount then every 30 s
  useEffect(() => {
    const load = async () => {
      try {
        const r = await kGet<{
          stats: { today: string; last_hour: string; last_7d: string; day_passes_today?: string; revenue_today?: number }
          recent: Array<{ id: string; name: string; method: string; checked_in_at: string; plan_name: string | null; expires_at: string | null; is_first_today: boolean }>
        }>('/api/checkin/live', tenantSlugRef.current)
        setLiveStats({
          today:            parseInt(r.stats.today)                    || 0,
          last_hour:        parseInt(r.stats.last_hour)                || 0,
          day_passes_today: parseInt(r.stats.day_passes_today ?? '0') || 0,
          revenue_today:    r.stats.revenue_today                      ?? 0,
        })
        setRecentScans(r.recent ?? [])
      } catch { /* silently ignore — network may be down */ }
    }
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [])

  // Live member search — uses the public /checkin/lookup endpoint (no auth required)
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    kPost<{ members: Record<string, unknown>[] }>(
      '/api/checkin/lookup',
      { query: searchQuery },
      tenantSlugRef.current,
    ).then(r => {
      setSearchResults((r.members ?? []).map(m => ({
        id:       m.id as string,
        name:     m.name as string,
        plan:     'Member',
        expiry:   m.expires_at
          ? new Date(m.expires_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—',
        checkins: 0,
        initials: (m.name as string).split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        status:   (['active', 'expiring_soon', 'grace_period'].includes(m.sub_status as string))
          ? (m.sub_status as string)
          : 'expired',
      })))
    }).catch(() => {})
  }, [searchQuery])

  useEffect(() => {
    if (['idle', 'confirmed', 'denied', 'grace', 'issue_error', 'qr_issued'].includes(screen)) return
    resetIdle()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [screen, resetIdle])

  // Poll Tranzak for S2S MoMo confirmation (payment_momo screen)
  useEffect(() => {
    if (!momoPolling || !momoChargeData?.day_pass_id || screen !== 'payment_momo') return
    const dayPassId = momoChargeData.day_pass_id
    const iv = setInterval(async () => {
      try {
        const r = await kGet<{ status: string; confirmed: boolean; qr_token: string | null }>(
          `/api/day-passes/payment-status/dp-${dayPassId}`,
          tenantSlugRef.current,
        )
        if (r.confirmed && r.qr_token) {
          setMomoPolling(false)
          setIssuedPass({ id: dayPassId, qrToken: r.qr_token, amount: momoChargeData.amount, currency: momoChargeData.currency })
          sounds.passIssued()
          setScreen('qr_issued')
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(iv)
  }, [momoPolling, momoChargeData, screen])

  // Poll for Tranzak payment confirmation when link payment is pending
  useEffect(() => {
    if (!linkPolling || !linkPaymentData?.merchant_transaction_id || screen !== 'payment_link') return
    const ref = linkPaymentData.merchant_transaction_id
    const iv = setInterval(async () => {
      try {
        const r = await kGet<{ status: string; confirmed: boolean; qr_token: string | null }>(
          `/api/day-passes/payment-status/${ref}`,
          tenantSlugRef.current,
        )
        if (r.confirmed && r.qr_token) {
          setLinkPolling(false)
          setIssuedPass({ id: linkPaymentData.day_pass_id, qrToken: r.qr_token, amount: linkPaymentData.amount, currency: linkPaymentData.currency })
          sounds.passIssued()
          setScreen('qr_issued')
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(iv)
  }, [linkPolling, linkPaymentData, screen])

  // SSE — receive real-time check-in events from the API and show welcome overlay
  useEffect(() => {
    const slug = tenantSlugRef.current
    if (!slug) return
    const es = new EventSource(`/api/checkin/events?slug=${encodeURIComponent(slug)}`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'checkin' && data.member?.name) {
          setLiveCheckin({ name: data.member.name, avatar_url: data.member.avatar_url, method: data.method })
          setTimeout(() => setLiveCheckin(null), 6000)
        }
      } catch { /* ignore malformed messages */ }
    }
    return () => es.close()
  }, [])

  async function issuePass(method: string, preIssuedData?: { id: string; qr_token: string; amount: number; currency: string }) {
    setCheckinLoading(true)
    try {
      const r = preIssuedData ?? await kPost<{ id: string; qr_token: string; amount: number; currency: string }>(
        '/api/day-passes/kiosk-issue',
        {
          guest_name: walkinName,
          guest_phone: walkinPhone || null,
          pass_type: selectedPass?.id,
          payment_method: method,
          currency: 'XAF',
        },
        tenantSlugRef.current,
      )
      setIssuedPass({ id: r.id, qrToken: r.qr_token, amount: r.amount, currency: r.currency })
      sounds.passIssued()
      setScreen('qr_issued')
    } catch {
      sounds.denied()
      setScreen('issue_error')
    } finally {
      setCheckinLoading(false)
    }
  }

  async function undoLastCheckin() {
    try {
      await kDelete('/api/checkin/undo-last', tenantSlugRef.current)
      // Remove the first item from the live list optimistically
      setRecentScans(s => s.slice(1))
      setLiveStats(s => ({ ...s, today: Math.max(0, s.today - 1), last_hour: Math.max(0, s.last_hour - 1) }))
      sounds.tap()
    } catch {
      sounds.denied()
    }
  }

  async function handlePrint() {
    const passId    = issuedPass?.id ?? ''
    const qrToken   = issuedPass?.qrToken ?? ''
    const amount    = issuedPass?.amount ?? selectedPass?.price ?? 0
    const currency  = issuedPass?.currency ?? 'XAF'
    const now       = new Date()
    const dateStr   = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const timeStr   = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const midnight  = new Date(now); midnight.setHours(23, 59, 0, 0)
    const expiryStr = midnight.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    // Generate QR as data URL — no DOM ref needed
    let qrImg = ''
    try {
      qrImg = await QRCodeLib.toDataURL(qrToken || 'NO-TOKEN', {
        width: 220, margin: 1, errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' },
      })
    } catch { /* fallback: no QR */ }

    const staffLine = staffInfo ? `<div class="row"><span class="label">Staff</span><span class="val">${staffInfo.name}</span></div>` : ''
    const phoneLine = walkinPhone ? `<div class="row"><span class="label">Phone</span><span class="val">${walkinPhone}</span></div>` : ''
    const refLine   = passId ? `<div class="row"><span class="label">Ref</span><span class="val">DP-${passId.slice(0, 8).toUpperCase()}</span></div>` : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
@page { size: 80mm auto; margin: 3mm 4mm; }
* { box-sizing: border-box; }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 72mm; margin: 0 auto; color: #000; background: #fff; }
.center { text-align: center; }
.gym { font-size: 17px; font-weight: bold; letter-spacing: 0.5px; }
.title { font-size: 12px; font-weight: bold; letter-spacing: 2px; }
.amount-box { text-align: center; font-size: 22px; font-weight: bold; margin: 7px 0; padding: 5px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
.currency { font-size: 13px; font-weight: normal; }
hr { border: none; border-top: 1px dashed #555; margin: 5px 0; }
.row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10.5px; }
.label { color: #555; }
.val { font-weight: bold; text-align: right; max-width: 55mm; overflow: hidden; }
.qr-wrap { text-align: center; margin: 8px auto 4px; }
.qr-wrap img { width: 58mm; height: 58mm; image-rendering: pixelated; }
.scan-hint { font-size: 9px; color: #555; text-align: center; letter-spacing: 0.5px; margin-bottom: 2px; }
.footer { font-size: 8.5px; color: #666; text-align: center; margin-top: 6px; line-height: 1.5; }
.valid-badge { display: inline-block; border: 1px solid #000; border-radius: 3px; padding: 1px 6px; font-size: 9px; letter-spacing: 0.5px; margin: 4px 0; }
</style>
</head><body>
<div class="center gym">${gymConfig.name}</div>
<div class="center" style="font-size:8.5px;color:#777;margin-bottom:4px;">powered by myfiti.app</div>
<hr/>
<div class="center title">*** DAY PASS ***</div>
<hr/>
<div class="amount-box"><span class="currency">${currency} </span>${amount.toLocaleString('fr-CM')}</div>
<hr/>
<div class="row"><span class="label">Guest</span><span class="val">${walkinName}</span></div>
${phoneLine}
<div class="row"><span class="label">Pass</span><span class="val">${selectedPass?.label ?? 'Day Pass'}</span></div>
<div class="row"><span class="label">Date</span><span class="val">${dateStr} ${timeStr}</span></div>
<div class="row"><span class="label">Valid until</span><span class="val">${expiryStr} tonight</span></div>
<div class="row"><span class="label">Payment</span><span class="val">${(paymentMethod ?? 'cash').toUpperCase()}</span></div>
${staffLine}
${refLine}
<hr/>
<div class="qr-wrap">${qrImg ? `<img src="${qrImg}" alt="QR" />` : '<div style="width:58mm;height:58mm;border:1px dashed #999;display:flex;align-items:center;justify-content:center;font-size:9px;">QR unavailable</div>'}</div>
<div class="scan-hint">SCAN AT ENTRANCE GATE</div>
${passId ? `<div class="center" style="font-size:9px;color:#888;font-family:monospace;">DP-${passId.slice(0, 8).toUpperCase()}</div>` : ''}
<hr/>
<div class="footer">Thank you for visiting ${gymConfig.name}!<br/>Keep this receipt — it is your entry pass.<br/>Valid for today only.</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const w    = window.open(url, '_blank', 'width=420,height=780')
    if (w) {
      w.focus()
      setTimeout(() => {
        w.print()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }, 600)
    } else {
      URL.revokeObjectURL(url)
    }
  }

  async function handleSMSReceipt() {
    if (!issuedPass?.id || sendingSMS) return
    setSendingSMS(true)
    try {
      await kPost(`/api/day-passes/${issuedPass.id}/sms-receipt`, { phone: walkinPhone }, tenantSlugRef.current)
    } catch { /* ignore */ }
    finally { setSendingSMS(false) }
  }

  async function initiatePaymentLink() {
    setLinkPaymentData(null)
    setLinkPolling(false)
    try {
      const r = await kPost<{ ok: boolean; day_pass_id: string; payment_url: string; merchant_transaction_id: string; qr_token: string; amount: number; currency: string }>(
        '/api/day-passes/initiate-payment',
        { guest_name: walkinName, guest_phone: walkinPhone || null, pass_type: selectedPass?.id, currency: 'XAF' },
        tenantSlugRef.current,
      )
      if (r.ok) {
        setLinkPaymentData({ payment_url: r.payment_url, merchant_transaction_id: r.merchant_transaction_id, day_pass_id: r.day_pass_id, qr_token: r.qr_token, amount: r.amount, currency: r.currency })
        setLinkPolling(true)
      }
    } catch { /* show manual confirm button if initiate fails */ }
  }

  async function initiateS2SCharge(phone: string) {
    setMomoChargeData(null)
    setMomoPolling(false)
    try {
      const r = await kPost<{ ok: boolean; day_pass_id: string; request_id: string; qr_token: string; amount: number; currency: string }>(
        '/api/day-passes/charge',
        { guest_name: walkinName, guest_phone: phone, pass_type: selectedPass?.id, currency: 'XAF' },
        tenantSlugRef.current,
      )
      if (r.ok) {
        setMomoChargeData({ request_id: r.request_id, day_pass_id: r.day_pass_id, qr_token: r.qr_token, amount: r.amount, currency: r.currency })
        setMomoPolling(true)
      }
    } catch { /* momoChargeData stays null — show retry */ }
  }

  function handleLogoTap() {
    const next = logoTaps + 1
    setLogoTaps(next)
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current)
    if (next >= 5) { setLogoTaps(0); setStaffPin(''); setScreen('staffpin') }
    else logoTapTimer.current = setTimeout(() => setLogoTaps(0), 3000)
  }

  function handleMemberSelect(m: KioskMember) {
    setCheckedMember(m)
    if (m.status === 'active' || m.status === 'expiring_soon') {
      sounds.success()
      setScreen('confirmed')
      setShiftCount(c => c + 1)
      kPost('/api/checkin/manual', { member_id: m.id, staff_id: staffInfo?.id ?? null }, tenantSlugRef.current).catch(() => {})
    } else if (m.status === 'grace_period') {
      sounds.warning()
      setDenialReason('grace_period')
      setScreen('grace')
      setShiftCount(c => c + 1)
      kPost('/api/checkin/manual', { member_id: m.id, staff_id: staffInfo?.id ?? null }, tenantSlugRef.current).catch(() => {})
    } else {
      sounds.denied()
      setDenialReason(m.status)
      setScreen('denied')
    }
  }

  async function handleQrScan(rawValue: string) {
    if (checkinLoading) return
    sounds.scan()
    setCheckinLoading(true)
    try {
      const r = await kPost<{
        ok: boolean; reason?: string
        member?: { id: string; name: string; avatar_url?: string | null; status: string; expires_at?: string | null }
      }>('/api/checkin/verify-qr', { token: rawValue }, tenantSlugRef.current)
      const memberObj = r.member ? {
        id: r.member.id, name: r.member.name, plan: 'Member',
        expiry: r.member.expires_at ? new Date(r.member.expires_at).toLocaleDateString() : '—',
        checkins: 0, initials: r.member.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        status: r.member.status ?? 'unknown',
      } : null
      setCheckedMember(memberObj)
      if (r.ok) {
        sounds.success()
        setScreen('confirmed')
      } else if (r.reason === 'grace_period') {
        sounds.warning()
        setDenialReason('grace_period')
        setScreen('grace')
      } else {
        sounds.denied()
        setDenialReason(r.reason ?? 'unknown')
        setDenialMessage(r.reason === 'outside_hours' ? (r.message ?? null) : null)
        setScreen('denied')
      }
    } catch { sounds.denied(); setDenialReason('unknown'); setDenialMessage(null); setScreen('denied') }
    finally { setCheckinLoading(false) }
  }

  async function handlePinConfirm() {
    if (checkinLoading || pinValue.length !== 4) return
    if (pinLockedUntil && Date.now() < pinLockedUntil) return
    setCheckinLoading(true)
    try {
      const r = await kPost<{
        ok: boolean; reason?: string
        member?: { id: string; name: string; avatar_url?: string | null; status: string; expires_at?: string | null; total_checkins?: number }
      }>('/api/checkin/verify-pin', { pin: pinValue }, tenantSlugRef.current)
      const memberObj = r.member ? {
        id: r.member.id, name: r.member.name, plan: 'Member',
        expiry: r.member.expires_at ? new Date(r.member.expires_at).toLocaleDateString() : '—',
        checkins: r.member.total_checkins ?? 0,
        initials: r.member.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
        status: r.member.status ?? 'unknown',
      } : null
      setCheckedMember(memberObj)
      if (r.ok) {
        sounds.success()
        setPinAttempts(0); setPinLockedUntil(null)
        setScreen('confirmed')
      } else if (r.reason === 'grace_period') {
        sounds.warning()
        setDenialReason('grace_period')
        setScreen('grace')
      } else {
        sounds.denied()
        const next = pinAttempts + 1
        setPinAttempts(next)
        if (next >= 3) {
          setPinLockedUntil(Date.now() + 30_000)
          setPinLockCountdown(30)
          setPinAttempts(0)
        }
        // 'not_found' from PIN means wrong PIN, not a missing member record
        const pinReason = r.reason === 'not_found' ? 'invalid_pin' : (r.reason ?? 'unknown')
        setDenialReason(pinReason)
        setDenialMessage(pinReason === 'outside_hours' ? (r.message ?? null) : null)
        setScreen('denied')
      }
    } catch {
      sounds.denied()
      const next = pinAttempts + 1
      setPinAttempts(next)
      if (next >= 3) { setPinLockedUntil(Date.now() + 30_000); setPinLockCountdown(30); setPinAttempts(0) }
      setDenialReason('unknown'); setDenialMessage(null); setScreen('denied')
    }
    finally { setPinValue(''); setCheckinLoading(false) }
  }

  const showStatusBar = screen !== 'idle'
  const SBH = 70 // status bar height

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: S.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}
      onPointerMove={resetIdle} onPointerDown={resetIdle}
    >
      {showStatusBar && (
        <StatusBar isOnline={isOnline} capacity={liveStats.last_hour} maxCapacity={gymConfig.maxCapacity} offlineQueue={offlineQueue} lang={lang} setLang={setLang} t={t} gymName={gymConfig.name} logoInitials={gymConfig.logoInitials} onStaffAccess={() => { setStaffPin(''); setScreen('staffpin') }} muted={sounds.muted} onToggleMute={sounds.toggleMute} brand={brand} />
      )}

      {screen === 'idle' && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 50, width: 80, height: 80, cursor: 'default' }} onPointerUp={handleLogoTap} />
      )}

      {/* ─── Live check-in welcome overlay ─── */}
      <AnimatePresence>
        {liveCheckin && (
          <WelcomeOverlay
            checkin={liveCheckin}
            brand={brand}
            onDismiss={() => setLiveCheckin(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ═══════════ IDLE ═══════════ */}
        {screen === 'idle' && (
          <motion.div key="idle" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: S.gDark, cursor: 'pointer' }}
            onPointerUp={() => setScreen('home')}>

            {/* Ambient radial glow */}
            <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle,${brandAlpha(brand, 0.15)} 0%,transparent 68%)`, pointerEvents: 'none' }} />

            {/* Pulsing rings */}
            {[290, 400, 520].map((size, i) => (
              <motion.div key={size}
                animate={{ scale: [1, 1.06 + i * 0.01, 1], opacity: [0.07, 0.18, 0.07] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.9 }}
                style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', border: `1.5px solid ${brandAlpha(brand, 0.5)}` }}
              />
            ))}

            {/* Logo orb */}
            <motion.div
              animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              onPointerUp={handleLogoTap}
              style={{ width: 118, height: 118, borderRadius: 38, background: brandGrad(brand), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: `0 0 100px ${brandAlpha(brand, 0.4)},0 0 200px ${brandAlpha(brand, 0.15)},0 24px 48px rgba(0,0,0,0.5)` }}
            >
              <span style={{ fontSize: '2.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{gymConfig.logoInitials}</span>
            </motion.div>

            {/* Clock */}
            <div style={{ zIndex: 1, marginTop: 36 }}><Clock size="lg" dark /></div>

            {/* Gym name + tagline */}
            <div style={{ zIndex: 1, textAlign: 'center', marginTop: 24 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.02em' }}>{gymConfig.name}</div>
              <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.38)', marginTop: 6, fontWeight: 500 }}>{gymConfig.tagline}</div>
            </div>

            {/* Tap prompt */}
            <motion.div animate={{ opacity: [1, 0.32, 1] }} transition={{ duration: 2.6, repeat: Infinity }} style={{ zIndex: 1, marginTop: 44 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: brandAlpha(brand, 0.9), letterSpacing: '0.18em', textTransform: 'uppercase', padding: '11px 30px', background: brandAlpha(brand, 0.12), border: `1px solid ${brandAlpha(brand, 0.28)}`, borderRadius: 99 }}>
                {t.tapToBegin}
              </div>
            </motion.div>

            {/* Bottom: live stats + controls */}
            <div style={{ position: 'absolute', bottom: 30, left: 36, right: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'rgba(255,255,255,0.92)', fontVariantNumeric: 'tabular-nums' }}>{liveStats.today}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>check-ins today</div>
                </div>
                <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'rgba(255,255,255,0.92)', fontVariantNumeric: 'tabular-nums' }}>{liveStats.last_hour}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>in gym now</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#4ade80' : S.danger, boxShadow: `0 0 8px ${isOnline ? '#4ade80' : S.danger}` }} />
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>{isOnline ? t.online : t.offlineMode}</span>
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  {(['en', 'fr'] as Lang[]).map(l => (
                    <motion.div key={l} whileTap={{ scale: 0.9 }} onPointerUp={e => { e.stopPropagation(); setLang(l) }}
                      style={{ padding: '6px 13px', background: lang === l ? brandAlpha(brand, 0.8) : 'transparent', cursor: 'pointer', userSelect: 'none', transition: 'background 0.14s' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: lang === l ? 'white' : 'rgba(255,255,255,0.38)' }}>{l.toUpperCase()}</span>
                    </motion.div>
                  ))}
                </div>
                <motion.div whileTap={{ scale: 0.86 }}
                  onPointerUp={e => { e.stopPropagation(); setStaffPin(''); setScreen('staffpin') }}
                  title="Staff access"
                  style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                  <UserStar01Icon size={16} color="rgba(255,255,255,0.38)" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ HOME ═══════════ */}
        {screen === 'home' && (
          <motion.div key="home" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: `${SBH + 20}px 28px 28px`, gap: 18 }}>

            {/* ── Top banner — gym branding + model image ── */}
            <div style={{
              position: 'relative', flexShrink: 0, height: 400,
              background: brandGrad(brand), borderRadius: 28,
              overflow: 'hidden',
              boxShadow: `0 16px 48px ${brandAlpha(brand, 0.28)}`,
            }}>
              {/* Diagonal mesh texture */}
              <HeroPattern />
              {/* Decorative orb */}
              <div style={{ position: 'absolute', right: -40, top: -40, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

              {/* Right: captivating headline + message */}
              <div style={{ position: 'absolute', left: '46%', right: 36, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1 }}>
                <div style={{ fontSize: FS.xs, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>Welcome to {gymConfig.name}</div>
                <div style={{ fontSize: '5.8rem', fontWeight: 900, color: 'white', letterSpacing: '-0.055em', lineHeight: 0.95, textShadow: '0 4px 32px rgba(0,0,0,0.25)' }}>
                  Push your<br />limits today.
                </div>
                <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginTop: 16, fontWeight: 500, lineHeight: 1.6 }}>
                  {gymConfig.tagline || 'Every rep counts. Every session matters. Show up and make it happen.'}
                </div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 99 }}>
                    <span style={{ fontSize: FS.xs, fontWeight: 700, color: 'white' }}>{liveStats.last_hour} in gym now</span>
                  </div>
                  <div style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 99 }}>
                    <span style={{ fontSize: FS.xs, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{liveStats.today} check-ins today</span>
                  </div>
                </div>
                {/* CTA invitation */}
                <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.25)' }} />
                  <span style={{ fontSize: FS.xs, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>Select an option below to get started</span>
                  <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.25)' }} />
                </div>
              </div>

              {/* Left: model image — edge-to-edge, full banner height */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '34%', pointerEvents: 'none', zIndex: 2, overflow: 'hidden', borderRadius: '28px 0 0 28px' }}>
                <img
                  src="/pushup.png"
                  alt=""
                  style={{ width: '100%', height: 'calc(100% + 80px)', objectFit: 'cover', objectPosition: 'center top', display: 'block', marginTop: '-80px' }}
                />
              </div>
            </div>

            {/* ── Action cards — all equal, 3 across ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flex: 1 }}>

              {/* Check In */}
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onPointerUp={() => setScreen('checkin_method')}
                style={{ background: '#fff', border: `1.5px solid ${S.border}`, borderRadius: 20, padding: '28px 26px', cursor: 'pointer', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 120, height: 120, borderRadius: 28, background: brandAlpha(brand, 0.08), border: `1.5px solid ${brandAlpha(brand, 0.16)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckinScanIcon size={64} color={brand} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: brandAlpha(brand, 0.7), textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Member Check-In</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: S.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{t.checkIn}</div>
                  <div style={{ fontSize: FS.sm, color: S.textSub, marginTop: 8, fontWeight: 500, lineHeight: 1.5 }}>Scan your QR code, enter your PIN, or search by name</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: brand, flexShrink: 0 }} />
                  <span style={{ fontSize: FS.xs, fontWeight: 700, color: brand }}>Tap to check in</span>
                </div>
              </motion.div>

              {/* Walk-in / Day Pass */}
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onPointerUp={() => setScreen('walkin')}
                style={{ background: '#fff', border: `1.5px solid ${S.border}`, borderRadius: 20, padding: '28px 26px', cursor: 'pointer', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 120, height: 120, borderRadius: 28, background: brandAlpha(brand, 0.08), border: `1.5px solid ${brandAlpha(brand, 0.16)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <WalkinIcon size={64} color={brand} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: brandAlpha(brand, 0.7), textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Walk-in & Guests</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: S.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{t.walkInDay}</div>
                  <div style={{ fontSize: FS.sm, color: S.textSub, marginTop: 8, fontWeight: 500, lineHeight: 1.5 }}>Register as a guest or purchase a day pass at the front desk</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: brand, flexShrink: 0 }} />
                  <span style={{ fontSize: FS.xs, fontWeight: 700, color: brand }}>No membership needed</span>
                </div>
              </motion.div>

              {/* Today's Classes */}
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onPointerUp={() => setScreen('schedule')}
                style={{ background: '#fff', border: `1.5px solid ${S.border}`, borderRadius: 20, padding: '28px 26px', cursor: 'pointer', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 120, height: 120, borderRadius: 28, background: brandAlpha(brand, 0.08), border: `1.5px solid ${brandAlpha(brand, 0.16)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClassScheduleIcon size={64} color={brand} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: brandAlpha(brand, 0.7), textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Class Schedule</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: S.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{t.todaysClasses}</div>
                  <div style={{ fontSize: FS.sm, color: S.textSub, marginTop: 8, fontWeight: 500, lineHeight: 1.5 }}>{classes.length} class{classes.length !== 1 ? 'es' : ''} scheduled — see times &amp; instructors</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: brand, flexShrink: 0 }} />
                  <span style={{ fontSize: FS.xs, fontWeight: 700, color: brand }}>View full timetable</span>
                </div>
              </motion.div>

            </div>
          </motion.div>
        )}

        {/* ═══════════ CHECK-IN METHOD SELECTION ═══════════ */}
        {screen === 'checkin_method' && (
          <motion.div key="checkin_method" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 24}px 40px 32px`, gap: 28 }}>
            <BackBtn label={t.back} onClick={goHome} />

            {/* Heading */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
                Member check-in
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: S.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                How would you like to check in?
              </div>
            </div>

            {/* 2×2 method grid — unified brand system */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 860 }}>

              {/* 1 — Member QR (primary, brand gradient) */}
              <motion.div whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.01 }} onPointerUp={() => { sounds.tap(); setScreen('checkin_qr') }}
                style={{
                  background: brandGrad(brand), borderRadius: R.xl, padding: '32px 28px',
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', flexDirection: 'column', gap: 16,
                  boxShadow: `0 12px 40px ${brandAlpha(brand, 0.3)}`,
                  position: 'relative', overflow: 'hidden',
                }}>
                <HeroPattern color="rgba(255,255,255,0.05)" spacing={18} />
                <div style={{ width: 88, height: 88, borderRadius: R.xl, background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <CheckinScanIcon size={48} color="white" />
                </div>
                <div style={{ zIndex: 1 }}>
                  <div style={{ fontSize: FS.xl, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>Member QR</div>
                  <div style={{ fontSize: FS.sm, color: 'rgba(255,255,255,0.62)', marginTop: 5, fontWeight: 500, lineHeight: 1.45 }}>
                    Show your QR code to the camera
                  </div>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fastest · recommended</div>
                </div>
              </motion.div>

              {[
                {
                  key: 'pin', title: 'Enter PIN',
                  sub: 'Use your 4-digit PIN from the app',
                  tag: 'Works without phone',
                  action: () => { sounds.tap(); setScreen('checkin_pin') },
                },
                {
                  key: 'search', title: 'Search Name',
                  sub: 'Type your name to find your account',
                  tag: 'Ask a staff member for help',
                  action: () => { sounds.tap(); setScreen('search') },
                },
                {
                  key: 'app', title: 'Scan with App',
                  sub: 'Open myfiti and scan this kiosk',
                  tag: 'Fastest for app users',
                  action: () => { sounds.tap(); setScreen('checkin_app') },
                },
              ].map(m => (
                <motion.div key={m.key} whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.01 }} onPointerUp={m.action}
                  style={{
                    background: S.bg, border: `1.5px solid ${S.border}`, borderRadius: R.xl, padding: '32px 28px',
                    cursor: 'pointer', userSelect: 'none',
                    display: 'flex', flexDirection: 'column', gap: 16,
                  }}
                >
                  <div style={{ width: 88, height: 88, borderRadius: R.xl, background: brandAlpha(brand, 0.07), border: `2px solid ${brandAlpha(brand, 0.15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.key === 'pin'    && <PinEntryIcon    size={48} color={brand} />}
                    {m.key === 'search' && <SearchMemberIcon size={48} color={brand} />}
                    {m.key === 'app'    && <ScanWithAppIcon  size={48} color={brand} />}
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xl, fontWeight: 900, color: S.text, letterSpacing: '-0.02em' }}>{m.title}</div>
                    <div style={{ fontSize: FS.sm, color: S.textSub, marginTop: 5, fontWeight: 500, lineHeight: 1.45 }}>{m.sub}</div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: FS.xs, fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.tag}</div>
                  </div>
                </motion.div>
              ))}

            </div>
          </motion.div>
        )}

        {/* ═══════════ CHECK-IN — QR CAMERA ═══════════ */}
        {screen === 'checkin_qr' && (
          <motion.div key="checkin_qr" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 20}px 44px 32px`, gap: 24 }}>
            <BackBtn label={t.back} onClick={() => setScreen('checkin_method')} />
            <SectionTitle icon={QrCode01Icon} title={t.scanQR} brand={brand} />
            <QRScanner active={screen === 'checkin_qr'} onScan={handleQrScan} onActivity={resetIdle} brand={brand} />
            {checkinLoading
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 18, height: 18, border: `2.5px solid ${S.border}`, borderTopColor: brand, borderRadius: '50%' }} />
                  <span style={{ fontSize: '0.9rem', color: brand, fontWeight: 700 }}>Verifying…</span>
                </div>
              : <div style={{ textAlign: 'center', fontSize: '0.88rem', color: S.textSub, fontWeight: 500, maxWidth: 320 }}>
                  Hold your QR code up to the camera — from the app or a printed card
                </div>
            }
          </motion.div>
        )}

        {/* ═══════════ CHECK-IN — PIN ═══════════ */}
        {screen === 'checkin_pin' && (
          <motion.div key="checkin_pin" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', paddingTop: SBH }}>

            {/* LEFT: pin pad */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 44px 32px', gap: 24, borderRight: `1px solid ${S.border}` }}>
              <BackBtn label={t.back} onClick={() => { setPinValue(''); setScreen('checkin_method') }} />
              <SectionTitle icon={UserStar01Icon} title={t.enterPIN} brand={brand} />
              <PinPad
                value={pinValue} onChange={setPinValue} onConfirm={handlePinConfirm} onTap={sounds.tap} brand={brand}
                loading={checkinLoading}
                locked={!!(pinLockedUntil && Date.now() < pinLockedUntil)}
                lockSecondsLeft={pinLockCountdown}
              />
              {!checkinLoading && !(pinLockedUntil && Date.now() < pinLockedUntil) && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: S.textMuted, fontWeight: 500 }}>
                    Find your PIN in the myfiti app under <strong>Profile → PIN</strong>
                  </div>
                  {pinAttempts > 0 && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', fontWeight: 600, color: S.danger }}>
                      {3 - pinAttempts} attempt{3 - pinAttempts !== 1 ? 's' : ''} remaining before lockout
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: promotional panel */}
            <div style={{ width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', background: S.bgDark, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -120, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle,${brandAlpha(brand, 0.13)} 0%,transparent 68%)`, pointerEvents: 'none' }} />

              {/* Milestone banner — shows when member hits a milestone visit count */}
              {checkedMember && MILESTONE_VISITS.includes(checkedMember.checkins) && (
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                  style={{ margin: '16px 16px 0', background: brandAlpha(brand, 0.18), border: `1px solid ${brandAlpha(brand, 0.35)}`, borderRadius: 14, padding: '14px 18px', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.6rem' }}>🏆</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'white' }}>Visit #{checkedMember.checkins} milestone!</div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Congratulations {checkedMember.name.split(' ')[0]} — keep it up!</div>
                  </div>
                </motion.div>
              )}

              <div style={{ padding: '40px 32px 0', zIndex: 1 }}>
                {/* Live stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Live · Today</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.03em' }}>{liveStats.today}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Check-ins</div>
                  </div>
                  <div style={{ flex: 1, background: brandAlpha(brand, 0.1), border: `1px solid ${brandAlpha(brand, 0.2)}`, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: brand, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.03em' }}>{liveStats.last_hour}</div>
                    <div style={{ fontSize: '0.65rem', color: brandAlpha(brand, 0.55), fontWeight: 600, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>In gym now</div>
                  </div>
                </div>

                {/* Quote of the day */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Today's motivation</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, fontStyle: 'italic' }}>"{MOTIVATIONAL_QUOTES[new Date().getDate() % MOTIVATIONAL_QUOTES.length]}"</div>
                </div>

                {/* Rotating promo carousel */}
                <PromoCarousel brand={brand} />
              </div>

              {/* Bottom: today's classes + app QR */}
              <div style={{ marginTop: 'auto', padding: '16px 32px 28px', zIndex: 1 }}>
                {classes.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Today's classes</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {classes.slice(0, 3).map((cls, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px' }}>
                          <div style={{ width: 38, flexShrink: 0, fontSize: '0.68rem', fontWeight: 800, color: brand, fontVariantNumeric: 'tabular-nums' }}>{cls.time}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginTop: 1 }}>{cls.trainer}</div>
                          </div>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: cls.spots > 0 ? brand : S.danger, flexShrink: 0 }}>
                            {cls.spots > 0 ? `${cls.spots} left` : 'Full'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Download the app</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ background: 'white', borderRadius: 10, padding: 7, flexShrink: 0, lineHeight: 0 }}>
                    <QRCode value="https://myfiti.app/download" size={52} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', letterSpacing: '-0.015em' }}>myfiti app</div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginTop: 4, lineHeight: 1.6 }}>Check in faster<br />Book classes · Track progress</div>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ═══════════ CHECK-IN — SCAN WITH APP ═══════════ */}
        {screen === 'checkin_app' && (
          <motion.div key="checkin_app" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 20}px 44px 32px`, gap: 24 }}>
            <BackBtn label={t.back} onClick={() => setScreen('checkin_method')} />
            <SectionTitle icon={LinkSquare01Icon} title="Scan with your app" brand={brand} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {gymQrToken ? (
                <motion.div
                  animate={{ scale: [1, 1.015, 1] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  style={{ padding: 24, background: '#fff', borderRadius: 24, boxShadow: `0 0 0 4px ${brandAlpha(brand, 0.12)}, 0 16px 48px rgba(0,0,0,0.1)` }}
                >
                  <StyledQRCodeWeb value={gymQrToken} size={240} finderColor={brand} />
                </motion.div>
              ) : (
                <div style={{ width: 288, height: 288, borderRadius: 24, background: S.surface, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 28, height: 28, border: `3px solid ${S.border}`, borderTopColor: brand, borderRadius: '50%' }} />
                </div>
              )}
              <div style={{ textAlign: 'center', maxWidth: 340 }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: S.text, marginBottom: 8 }}>
                  Open the myfiti app on your phone
                </div>
                <div style={{ fontSize: '0.88rem', color: S.textSub, fontWeight: 500, lineHeight: 1.5 }}>
                  Tap <strong>Scan to Enter</strong> on the Check-in screen, then point your camera at this code to check in instantly.
                </div>
              </div>
              {/* Step indicators */}
              <div style={{ display: 'flex', gap: 28, marginTop: 4 }}>
                {[
                  { n: '1', label: 'Open app' },
                  { n: '2', label: 'Tap Scan' },
                  { n: '3', label: 'Point at QR' },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: brandAlpha(brand, 0.1), border: `2px solid ${brandAlpha(brand, 0.25)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: brand }}>{s.n}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textSub }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ SEARCH ═══════════ */}
        {screen === 'search' && (
          <motion.div key="search" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', paddingTop: SBH }}>
            <BackBtn label={t.back} onClick={() => setScreen('checkin_method')} />

            {/* ── LEFT: search panel ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '72px 40px 32px', gap: 18, borderRight: `1px solid ${S.border}` }}>
              <SectionTitle icon={Search01Icon} title="Find your name" brand={brand} />
              <TextInput size="xl" radius="lg" autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.typeYourName}
                styles={{ input: { fontSize: '1.2rem', fontWeight: 600, padding: '14px 20px', height: 'auto', border: `2px solid ${S.border}`, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }}
              />
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {searchQuery.length < 2 && (
                  <div style={{ textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <MembersGroupIcon color={brand} size={110} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: S.text, marginTop: 4 }}>Find a member</div>
                    <div style={{ fontSize: '0.85rem', color: S.textMuted, fontWeight: 500 }}>Type at least 2 characters to search</div>
                  </div>
                )}
                {searchQuery.length >= 2 && (
                  searchResults.length === 0
                    ? (
                      <div style={{ textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: S.surface, borderRadius: 18, border: `1px solid ${S.border}` }}>
                        <MembersGroupIcon color={S.textMuted} size={96} />
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: S.text, marginTop: 4 }}>{t.noMembersFound}</div>
                        <div style={{ fontSize: '0.85rem', color: S.textMuted, fontWeight: 500 }}>Try a different name or ask staff for help</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {searchResults.map(m => {
                          const isActive = m.status === 'active' || m.status === 'expiring_soon'
                          const isGrace = m.status === 'grace_period'
                          const dotColor = isActive ? S.success : isGrace ? S.amber : S.danger
                          const avatarBg = isActive ? brandAlpha(brand, 0.08) : isGrace ? 'rgba(217,119,6,0.08)' : S.surface
                          const avatarBorder = isActive ? brand : isGrace ? S.amber : S.border
                          const avatarText = isActive ? brand : isGrace ? S.amber : S.textMuted
                          return (
                            <motion.div key={m.id} whileTap={{ scale: 0.982 }} onPointerUp={() => handleMemberSelect(m)}
                              style={{ background: '#fff', border: `1.5px solid ${S.border}`, borderRadius: 18, padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, userSelect: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                              <div style={{ width: 54, height: 54, borderRadius: 16, background: avatarBg, border: `2px solid ${avatarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: avatarText }}>{m.initials}</span>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: S.text }}>{m.name}</div>
                                <div style={{ fontSize: '0.8rem', color: S.textSub, marginTop: 3 }}>{m.plan} · Expires {m.expiry}</div>
                              </div>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}60`, flexShrink: 0 }} />
                            </motion.div>
                          )
                        })}
                      </div>
                    )
                )}
              </div>
            </div>

            {/* ── RIGHT: promotional / brand panel ── */}
            <div style={{ width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', background: S.bgDark, overflow: 'hidden', position: 'relative' }}>
              {/* Brand radial glow */}
              <div style={{ position: 'absolute', top: -120, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle,${brandAlpha(brand, 0.13)} 0%,transparent 68%)`, pointerEvents: 'none' }} />

              {/* ─── Gym identity ─── */}
              <div style={{ padding: '40px 32px 0', zIndex: 1 }}>
                {/* Live stats — two cards */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Live · Today</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'white', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.03em' }}>{liveStats.today}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Check-ins</div>
                  </div>
                  <div style={{ flex: 1, background: brandAlpha(brand, 0.1), border: `1px solid ${brandAlpha(brand, 0.2)}`, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: brand, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.03em' }}>{liveStats.last_hour}</div>
                    <div style={{ fontSize: '0.65rem', color: brandAlpha(brand, 0.55), fontWeight: 600, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>In gym now</div>
                  </div>
                </div>

                {/* Rotating photo promo cards */}
                <PromoCarousel brand={brand} />
              </div>

              {/* ─── App download ─── */}
              <div style={{ marginTop: 'auto', padding: '20px 32px 36px', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Download the app</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: 'white', borderRadius: 10, padding: 7, flexShrink: 0, lineHeight: 0 }}>
                    <QRCode value="https://myfiti.app/download" size={56} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', letterSpacing: '-0.015em' }}>myfiti app</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginTop: 5, lineHeight: 1.6 }}>Check in faster<br />Book classes · Track progress</div>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ═══════════ CONFIRMED ═══════════ */}
        {screen === 'confirmed' && (
          <motion.div key="confirmed" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, overflow: 'hidden' }}>
            <AutoReturn onReturn={goHome} delay={5000} />

            {/* Soft brand radial backdrop */}
            <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle,${brandAlpha(brand, 0.07)} 0%,transparent 70%)`, pointerEvents: 'none' }} />

            {/* Member avatar or initials circle */}
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{ position: 'relative', marginBottom: 28, zIndex: 1 }}>
              {/* Animated SVG ring draws itself */}
              <CheckRing color={brand} size={160} />
              {/* Initials in centre */}
              {checkedMember && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                  style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color: brand, letterSpacing: '-0.02em' }}>{checkedMember.initials}</span>
                </motion.div>
              )}
            </motion.div>

            {/* Text */}
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div style={{ fontSize: FS['3xl'], fontWeight: 900, color: S.text, letterSpacing: '-0.04em', lineHeight: 1 }}>You&apos;re in!</div>
              </motion.div>
              {checkedMember && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                  <div style={{ fontSize: FS['2xl'], fontWeight: 700, color: brand, marginTop: 12 }}>{checkedMember.name}</div>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.58 }}>
                <div style={{ fontSize: FS.sm, color: S.textMuted, marginTop: 12, fontWeight: 500 }}>
                  {liveStats.last_hour} {liveStats.last_hour === 1 ? 'person' : 'people'} in gym · Have a great workout!
                </div>
              </motion.div>
            </div>

            {/* Return indicator */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 40, zIndex: 1 }}>
              <CountdownRing duration={5000} size={48} color={brandAlpha(brand, 0.45)} />
              <div style={{ fontSize: FS.xs, color: S.textMuted, fontWeight: 600 }}>Returning to home…</div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════ DENIED ═══════════ */}
        {screen === 'denied' && (
          <motion.div key="denied" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bgDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
            <AutoReturn onReturn={goHome} delay={7000} />

            {/* Subtle dot grid */}
            <AmbientGrid opacity={0.04} spacing={28} />

            {/* Animated X ring */}
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }} style={{ zIndex: 1, marginBottom: 8 }}>
              <CrossRing size={108} />
            </motion.div>

            {/* Text — discreet sizing */}
            <div style={{ textAlign: 'center', maxWidth: 440, zIndex: 1 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {denialReason === 'cancelled' ? t.membershipCancelled
                    : denialReason === 'suspended' ? t.membershipSuspended
                    : denialReason === 'frozen' ? t.membershipFrozen
                    : denialReason === 'not_found' ? t.memberNotFound
                    : denialReason === 'invalid_qr' || denialReason === 'wrong_type' ? t.invalidQR
                    : denialReason === 'invalid_pin' ? t.invalidPin
                    : denialReason === 'outside_hours' ? t.outsideHours
                    : t.membershipExpired}
                </div>
              </motion.div>
              {checkedMember && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
                  <div style={{ fontSize: FS.xl, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 10 }}>{checkedMember.name}</div>
                </motion.div>
              )}
              {denialMessage && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <div style={{ fontSize: FS.sm, color: 'rgba(255,255,255,0.5)', marginTop: 10, fontWeight: 500 }}>{denialMessage}</div>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.54 }}>
                <div style={{ fontSize: FS.base, color: 'rgba(255,255,255,0.35)', marginTop: 14, fontWeight: 500 }}>{t.seeReception}</div>
              </motion.div>
            </div>

            {/* Actions + countdown */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center', zIndex: 1 }}>
              <Button size="lg" radius="md" variant="outline" onPointerUp={goHome}
                styles={{ root: { color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 700 } }}>
                {t.back}
              </Button>
              {(denialReason === 'expired' || denialReason === null || denialReason === 'unknown') && (
                <Button size="lg" radius="md" color="red" variant="light" onPointerUp={() => setScreen('walkin')}
                  styles={{ root: { fontWeight: 800 } }}>
                  {t.renewNow}
                </Button>
              )}
              <CountdownRing duration={7000} size={44} />
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════ GRACE PERIOD ═══════════ */}
        {screen === 'grace' && (
          <motion.div key="grace" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bgDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
            <AutoReturn onReturn={goHome} delay={7000} />

            <AmbientGrid opacity={0.04} spacing={28} />
            {/* Warm amber radial glow */}
            <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle,rgba(217,119,6,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }} style={{ zIndex: 1, marginBottom: 8 }}>
              <AlertRing size={108} />
            </motion.div>

            <div style={{ textAlign: 'center', maxWidth: 440, zIndex: 1 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{t.graceHeadline}</div>
              </motion.div>
              {checkedMember && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}>
                  <div style={{ fontSize: FS.xl, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 10 }}>{checkedMember.name}</div>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.54 }}>
                <div style={{ fontSize: FS.base, color: 'rgba(217,119,6,0.75)', marginTop: 14, fontWeight: 500 }}>{t.graceSubtitle}</div>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center', zIndex: 1 }}>
              <Button size="lg" radius="md" color="yellow" variant="filled" onPointerUp={goHome}
                styles={{ root: { fontWeight: 800, color: '#78350f' } }}>
                {t.graceCTA}
              </Button>
              <CountdownRing duration={7000} size={44} color="rgba(217,119,6,0.55)" />
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════ ISSUE ERROR ═══════════ */}
        {screen === 'issue_error' && (
          <motion.div key="issue_error" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bgDark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
            <AutoReturn onReturn={goHome} delay={9000} />
            <AmbientGrid opacity={0.04} spacing={28} />
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }} style={{ zIndex: 1, marginBottom: 8 }}>
              <AlertRing size={108} />
            </motion.div>
            <div style={{ textAlign: 'center', maxWidth: 440, zIndex: 1 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
                <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.03em' }}>{t.issueErrorHeadline}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
                <div style={{ fontSize: FS.base, color: 'rgba(255,255,255,0.38)', marginTop: 12, fontWeight: 500 }}>{t.issueErrorMessage}</div>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              style={{ display: 'flex', gap: 12, alignItems: 'center', zIndex: 1 }}>
              <Button size="lg" radius="md" variant="outline" onPointerUp={goHome}
                styles={{ root: { color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 700 } }}>
                {t.back}
              </Button>
              <CountdownRing duration={9000} size={44} />
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════ SCHEDULE ═══════════ */}
        {screen === 'schedule' && (
          <motion.div key="schedule" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: `${SBH + 76}px 52px 40px`, gap: 14 }}>
            <BackBtn label={t.back} onClick={goHome} />
            <SectionTitle icon={Calendar01Icon} title={t.todaysClasses} brand={brand} />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 }}>
                  <Calendar01Icon size={48} color={S.textMuted} />
                  <span style={{ fontSize: '1rem', color: S.textMuted, fontWeight: 600 }}>No classes scheduled today</span>
                </div>
              ) : classes.map((c, idx) => {
                const full = c.spots === 0
                const accent = full ? S.danger : idx % 3 === 0 ? brand : idx % 3 === 1 ? S.success : '#0891b2'
                return (
                  <div key={c.name} style={{
                    background: '#fff', borderRadius: 18, padding: '20px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: `1px solid ${S.border}`, borderLeft: `5px solid ${accent}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: accent, minWidth: 62, fontVariantNumeric: 'tabular-nums' }}>{c.time}</div>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: S.text }}>{c.name}</div>
                        <div style={{ fontSize: '0.8rem', color: S.textSub, marginTop: 2 }}>with {c.trainer}</div>
                      </div>
                    </div>
                    {full
                      ? <span style={{ fontSize: '0.8rem', fontWeight: 800, color: S.danger, background: 'rgba(220,38,38,0.07)', padding: '7px 18px', borderRadius: 99, border: '1px solid rgba(220,38,38,0.18)' }}>{t.full}</span>
                      : <span style={{ fontSize: '0.8rem', fontWeight: 700, color: S.success, background: 'rgba(22,163,74,0.07)', padding: '7px 18px', borderRadius: 99, border: '1px solid rgba(22,163,74,0.18)' }}>{c.spots} {t.spotsLeft}</span>
                    }
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ═══════════ WALK-IN: NAME ═══════════ */}
        {screen === 'walkin' && (
          <motion.div key="walkin" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 76}px 60px 40px` }}>
            <BackBtn label={t.back} onClick={goHome} />
            <div style={{ width: '100%', maxWidth: 560 }}>
              <StepCircles step={1} brand={brand} />
              <SectionTitle icon={UserAdd01Icon} title={t.walkinTitle} brand={brand} />
              <p style={{ fontSize: '0.95rem', color: S.textSub, marginBottom: 24, fontWeight: 500 }}>
                Guest&apos;s full name — required for the day pass
              </p>
              <TextInput size="xl" radius="lg" autoFocus
                value={walkinName} onChange={e => setWalkinName(e.target.value)}
                placeholder="e.g. Jean Mbarga"
                styles={{ input: { fontSize: '1.5rem', fontWeight: 600, padding: '24px 24px', height: 'auto', border: `2px solid ${S.border}`, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }}
              />
              <Button size="xl" radius="lg" fullWidth mt="xl" color="indigo"
                disabled={walkinName.trim().length < 2}
                rightSection={<ArrowRight01Icon size={20} color="white" />}
                onPointerUp={() => { if (walkinName.trim().length >= 2) setScreen('walkin_phone') }}
                styles={{ root: { fontSize: '1.1rem', fontWeight: 800, height: 66 } }}>
                {t.next}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ WALK-IN: PHONE ═══════════ */}
        {screen === 'walkin_phone' && (
          <motion.div key="walkin_phone" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 76}px 60px 40px` }}>
            <BackBtn label={t.back} onClick={() => setScreen('walkin')} />
            <div style={{ width: '100%', maxWidth: 560 }}>
              <StepCircles step={2} brand={brand} />
              <SectionTitle icon={SmartPhone01Icon} title={t.walkinPhone} brand={brand} />
              <p style={{ fontSize: '0.95rem', color: S.textSub, marginBottom: 24, fontWeight: 500 }}>
                For <strong style={{ color: S.text }}>{walkinName}</strong> — used to send the day pass receipt
              </p>
              <TextInput size="xl" radius="lg" autoFocus type="tel"
                value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                styles={{ input: { fontSize: '1.5rem', fontWeight: 600, padding: '24px 24px', height: 'auto', border: `2px solid ${S.border}`, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }}
              />
              <Button size="xl" radius="lg" fullWidth mt="xl" color="indigo"
                disabled={walkinPhone.trim().length > 0 && walkinPhone.trim().length < 6}
                rightSection={<ArrowRight01Icon size={20} color="white" />}
                onPointerUp={() => { if (walkinPhone.trim().length === 0 || walkinPhone.trim().length >= 6) setScreen('passtype') }}
                styles={{ root: { fontSize: '1.1rem', fontWeight: 800, height: 66 } }}>
                {t.next}
              </Button>
              <Button size="lg" radius="lg" fullWidth mt="sm" variant="subtle" color="gray"
                onPointerUp={() => { setWalkinPhone(''); setScreen('passtype') }}
                styles={{ root: { fontSize: '0.95rem', fontWeight: 600, color: S.textMuted, height: 50 } }}>
                {t.walkinPhoneSkip}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ PASS TYPE ═══════════ */}
        {screen === 'passtype' && (
          <motion.div key="passtype" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 76}px 60px 40px` }}>
            <BackBtn label={t.back} onClick={() => setScreen('walkin_phone')} />
            <div style={{ width: '100%', maxWidth: 720 }}>
              <StepCircles step={3} brand={brand} />
              <SectionTitle icon={Wallet01Icon} title={t.selectPass} brand={brand} />
              <p style={{ fontSize: '0.95rem', color: S.textSub, marginBottom: 20, fontWeight: 500 }}>
                For <strong style={{ color: S.text }}>{walkinName}</strong> — choose a pass type
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {dayPasses.map(p => {
                  const badge = p.id === 'bundle_10' ? 'Best Value' : p.id === 'standard' ? 'Popular' : null
                  const sel = selectedPass?.id === p.id
                  return (
                    <Tile key={p.id} selected={sel} onClick={() => setSelectedPass(p)}>
                      {badge && (
                        <div style={{ display: 'inline-block', fontSize: '0.62rem', fontWeight: 800, color: sel ? brand : '#fff', background: sel ? brandAlpha(brand, 0.1) : brand, border: `1px solid ${sel ? brandAlpha(brand, 0.25) : 'transparent'}`, borderRadius: 99, padding: '3px 10px', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {badge}
                        </div>
                      )}
                      <div style={{ fontSize: '1.65rem', fontWeight: 900, color: sel ? brand : S.text, marginBottom: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                        ₣{p.price.toLocaleString('fr-CM')}
                      </div>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: S.text }}>{p.label}</div>
                      <div style={{ fontSize: '0.72rem', color: S.textSub, marginTop: 4, lineHeight: 1.4 }}>{p.sub}</div>
                      {sel && <div style={{ marginTop: 10 }}><CheckmarkCircle01Icon size={20} color={brand} /></div>}
                    </Tile>
                  )
                })}
              </div>
              <Button size="xl" radius="md" fullWidth color="indigo" disabled={!selectedPass}
                rightSection={<ArrowRight01Icon size={20} color="white" />}
                onPointerUp={() => { if (selectedPass) setScreen('payment') }}
                styles={{ root: { fontSize: '1.05rem', fontWeight: 800, height: 64 } }}>
                {t.next}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ PAYMENT METHOD ═══════════ */}
        {screen === 'payment' && (
          <motion.div key="payment" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 76}px 60px 40px` }}>
            <BackBtn label={t.back} onClick={() => setScreen('passtype')} />
            <div style={{ width: '100%', maxWidth: 640 }}>
              <StepCircles step={4} brand={brand} />
              <SectionTitle icon={Wallet01Icon} title={t.paymentMethod} brand={brand} />
              {selectedPass && (
                <div style={{ marginBottom: 22, padding: '16px 20px', background: brandAlpha(brand, 0.07), border: `1px solid ${brandAlpha(brand, 0.2)}`, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: S.textSub, fontWeight: 600 }}>{selectedPass.label} · {walkinName}</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: brand, fontVariantNumeric: 'tabular-nums' }}>₣{selectedPass.price.toLocaleString('fr-CM')}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {[
                  { id: 'cash'   as const, icon: Wallet01Icon,     label: t.cash,         sub: 'Physical cash',            accent: S.success },
                  { id: 'mtn'    as const, icon: SmartPhone01Icon, label: t.momoMTN,      sub: 'USSD push to phone',       accent: '#f59e0b' },
                  { id: 'orange' as const, icon: SmartPhone01Icon, label: t.momoOrange,   sub: 'USSD push to phone',       accent: '#f97316' },
                  { id: 'link'   as const, icon: LinkSquare01Icon, label: t.smsLink,      sub: 'Tranzak · auto-confirm',   accent: brand },
                  { id: 'wallet' as const, icon: Wallet01Icon,     label: t.memberWallet, sub: 'Deduct from member wallet', accent: '#7c3aed' },
                ].map(p => {
                  const Icon = p.icon
                  return (
                    <Tile key={p.id} selected={paymentMethod === p.id} accent={p.accent} onClick={() => {
                      setPaymentMethod(p.id)
                      if (p.id === 'cash') setScreen('payment_cash')
                      else if (p.id === 'link') { initiatePaymentLink(); setScreen('payment_link') }
                      else if (p.id === 'wallet') {
                        setWalletPhone(walkinPhone); setWalletMember(null); setWalletError('')
                        setScreen('payment_wallet')
                      } else {
                        // S2S — go to momo screen; phone entry happens there
                        setMomoChargeData(null)
                        setMomoPolling(false)
                        setMomoPhoneInput(walkinPhone)
                        setScreen('payment_momo')
                      }
                    }}>
                      <div style={{ width: 46, height: 46, borderRadius: 14, background: `${p.accent}14`, border: `1.5px solid ${p.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Icon size={22} color={p.accent} />
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: S.text }}>{p.label}</div>
                      <div style={{ fontSize: '0.74rem', color: S.textSub, marginTop: 5 }}>{p.sub}</div>
                    </Tile>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ PAYMENT: CASH ═══════════ */}
        {screen === 'payment_cash' && (
          <motion.div key="payment_cash" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 40}px 60px 40px`, gap: 0 }}>
            <BackBtn label={t.back} onClick={() => setScreen('payment')} />
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              {/* Amount card */}
              <div style={{ background: 'linear-gradient(135deg,#052e16 0%,#14532d 100%)', borderRadius: 28, padding: '40px 48px', marginBottom: 28, boxShadow: '0 20px 60px rgba(22,163,74,0.2)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
                  {t.cashAmount}
                </div>
                <div style={{ fontSize: '5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  ₣{selectedPass?.price.toLocaleString('fr-CM')}
                </div>
                <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', marginTop: 14 }}>{selectedPass?.label} · {walkinName}</div>
              </div>
              <div style={{ fontSize: '0.88rem', color: S.textMuted, marginBottom: 24, fontWeight: 500 }}>
                Collect cash from the guest, then confirm below.
              </div>
              <Button size="xl" radius="md" fullWidth color="green"
                leftSection={<CheckmarkCircle01Icon size={22} color="white" />}
                loading={checkinLoading}
                onPointerUp={() => issuePass('cash')}
                styles={{ root: { fontSize: '1.05rem', fontWeight: 800, height: 64 } }}>
                {t.cashConfirm}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ PAYMENT: MOMO (S2S USSD push) ═══════════ */}
        {screen === 'payment_momo' && (() => {
          const isMTN = paymentMethod === 'mtn'
          const momoAccent = isMTN ? '#f59e0b' : '#f97316'
          const momoLabel = isMTN ? 'MTN MoMo' : 'Orange Money'
          const charged = !!momoChargeData
          return (
            <motion.div key="payment_momo" {...slide}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 40}px 60px 40px`, gap: 20 }}>
              <BackBtn label={t.back} onClick={() => { setMomoPolling(false); setMomoChargeData(null); setScreen('payment') }} />
              <div style={{ textAlign: 'center', maxWidth: 480 }}>
                {/* Brand pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${momoAccent}14`, border: `1.5px solid ${momoAccent}30`, borderRadius: 99, padding: '8px 20px', marginBottom: 18 }}>
                  <SmartPhone01Icon size={16} color={momoAccent} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: momoAccent, letterSpacing: '0.04em' }}>{momoLabel} · USSD Push</span>
                </div>

                <div style={{ fontSize: '3.2rem', fontWeight: 900, color: S.text, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                  ₣{selectedPass?.price.toLocaleString('fr-CM')}
                </div>
                <div style={{ fontSize: '0.9rem', color: S.textSub, marginBottom: 28, fontWeight: 500 }}>
                  {walkinName} · {selectedPass?.label}
                </div>

                {!charged ? (
                  /* ── Phone entry (pre-filled from walkin step) ── */
                  <div style={{ maxWidth: 380, margin: '0 auto' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                      Guest Mobile Money number
                    </div>
                    <input
                      type="tel"
                      value={momoPhoneInput}
                      onChange={e => setMomoPhoneInput(e.target.value)}
                      placeholder="e.g. 237655123456"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
                        padding: '18px 20px', borderRadius: 14,
                        border: `2px solid ${momoAccent}60`, outline: 'none',
                        color: S.text, background: '#fff',
                        letterSpacing: '0.05em', marginBottom: 20,
                      }}
                    />
                    <Button size="xl" radius="md" fullWidth
                      disabled={momoPhoneInput.trim().length < 8}
                      style={{ background: momoAccent, height: 64, fontSize: '1.05rem', fontWeight: 800 }}
                      onPointerUp={() => { if (momoPhoneInput.trim().length >= 8) initiateS2SCharge(momoPhoneInput.trim()) }}>
                      Send USSD to phone
                    </Button>
                  </div>
                ) : (
                  /* ── Waiting for USSD approval ── */
                  <div style={{ maxWidth: 400, margin: '0 auto' }}>
                    {/* Pulsing orb */}
                    <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 28px' }}>
                      <motion.div
                        animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0, 0.25] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: momoAccent }}
                      />
                      <motion.div
                        animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0, 0.45] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                        style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: momoAccent }}
                      />
                      <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: momoAccent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SmartPhone01Icon size={32} color="white" />
                      </div>
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: S.text, marginBottom: 8 }}>
                      USSD sent to {momoChargeData?.currency === 'XAF' ? '' : ''}{momoPhoneInput}
                    </div>
                    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
                      <div style={{ fontSize: '0.88rem', color: momoAccent, fontWeight: 700, marginBottom: 24 }}>
                        Waiting for guest to approve…
                      </div>
                    </motion.div>

                    {/* Instructions */}
                    {[
                      'Guest receives a USSD prompt on their phone',
                      `They enter their ${momoLabel} PIN to approve`,
                      'This screen updates automatically',
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${momoAccent}18`, border: `1.5px solid ${momoAccent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900, color: momoAccent }}>{i + 1}</span>
                        </div>
                        <span style={{ fontSize: '0.84rem', fontWeight: 500, color: S.textSub }}>{step}</span>
                      </div>
                    ))}

                    {/* Manual override */}
                    <Button size="lg" radius="md" variant="default" fullWidth mt="xl"
                      loading={checkinLoading}
                      leftSection={<CheckmarkCircle01Icon size={18} color={S.textSub} />}
                      onPointerUp={() => { setMomoPolling(false); issuePass(paymentMethod ?? 'momo') }}
                      styles={{ root: { fontWeight: 700, marginTop: 20, color: S.textSub } }}>
                      {t.momoConfirm}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })()}

        {/* ═══════════ PAYMENT: SMS LINK (Tranzak) ═══════════ */}
        {screen === 'payment_link' && (
          <motion.div key="payment_link" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 40}px 60px 40px`, gap: 16 }}>
            <BackBtn label={t.back} onClick={() => { setLinkPolling(false); setScreen('payment') }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: brand, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Tranzak</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: S.text, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                ₣{selectedPass?.price.toLocaleString('fr-CM')}
              </div>
              {!linkPaymentData ? (
                <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 36, height: 36, border: `3px solid ${S.border}`, borderTopColor: brand, borderRadius: '50%' }} />
                  <div style={{ fontSize: '0.9rem', color: S.textSub }}>{t.linkInitiating}</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.82rem', color: S.textSub, marginBottom: 16 }}>{t.linkScanQR}</div>
                  <div style={{ margin: '0 auto', width: 'fit-content', padding: 16, background: S.bg, border: `2px solid ${S.border}`, borderRadius: 16 }}>
                    <StyledQRCodeWeb value={linkPaymentData.payment_url} size={200} finderColor={brand} bgColor={S.bg} />
                  </div>
                </>
              )}
              <motion.div animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 1.9, repeat: Infinity }}>
                <div style={{ fontSize: '0.82rem', color: brand, fontWeight: 700, margin: '14px 0' }}>{t.linkWaiting}</div>
              </motion.div>
              <Button
                size="xl" radius="md" color="indigo"
                leftSection={<CheckmarkCircle01Icon size={22} color="white" />}
                onPointerUp={() => { setLinkPolling(false); issuePass('link') }}
                styles={{ root: { fontSize: '1.05rem', fontWeight: 800, height: 62, minWidth: 340 } }}
              >
                {t.linkConfirmManual}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ PAYMENT: MEMBER WALLET ═══════════ */}
        {screen === 'payment_wallet' && (
          <motion.div key="payment_wallet" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 40}px 60px 40px`, gap: 20 }}>
            <BackBtn label={t.back} onClick={() => { setWalletMember(null); setWalletError(''); setScreen('payment') }} />
            <div style={{ width: '100%', maxWidth: 480 }}>
              <div style={{ marginBottom: 24, padding: '16px 20px', background: brandAlpha('#7c3aed', 0.07), border: `1px solid ${brandAlpha('#7c3aed', 0.2)}`, borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: S.textSub, fontWeight: 600 }}>{selectedPass?.label} · {walkinName}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>₣{selectedPass?.price.toLocaleString('fr-CM')}</span>
              </div>

              {/* Phone input + lookup */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <TextInput
                  size="lg" radius="md"
                  placeholder={t.walletPhone}
                  value={walletPhone}
                  onChange={e => { setWalletPhone(e.currentTarget.value); setWalletMember(null); setWalletError('') }}
                  style={{ flex: 1 }}
                />
                <Button
                  size="lg" radius="md"
                  style={{ background: '#7c3aed', color: '#fff', fontWeight: 700 }}
                  loading={walletLooking}
                  disabled={!walletPhone.trim()}
                  onPointerUp={async () => {
                    setWalletLooking(true); setWalletMember(null); setWalletError('')
                    try {
                      const r = await kGet<{ id: string; name: string; balance: number; currency: string }>(
                        `/api/day-passes/wallet-lookup?phone=${encodeURIComponent(walletPhone.trim())}`,
                        tenantSlugRef.current,
                      )
                      setWalletMember(r)
                    } catch {
                      setWalletError(t.walletNotFound)
                    } finally { setWalletLooking(false) }
                  }}
                >
                  {t.walletFind}
                </Button>
              </div>

              {walletError && (
                <p style={{ color: S.danger, fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>{walletError}</p>
              )}

              {walletMember && (
                <div style={{ marginBottom: 20, padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: S.text, marginBottom: 4 }}>{walletMember.name}</div>
                  <div style={{ fontSize: '0.85rem', color: S.textSub }}>
                    {t.walletBalance}:{' '}
                    <strong style={{ color: walletMember.balance >= (selectedPass?.price ?? 0) ? S.success : S.danger }}>
                      {walletMember.currency} {walletMember.balance.toLocaleString('fr-CM')}
                    </strong>
                    {walletMember.balance < (selectedPass?.price ?? 0) && (
                      <span style={{ color: S.danger, marginLeft: 8 }}>— {t.walletInsufficient}</span>
                    )}
                  </div>
                </div>
              )}

              <Button
                size="xl" radius="md" fullWidth
                style={{ background: '#7c3aed', color: '#fff', fontWeight: 800, height: 62, fontSize: '1.05rem' }}
                disabled={!walletMember || walletMember.balance < (selectedPass?.price ?? 0) || checkinLoading}
                loading={checkinLoading}
                leftSection={<CheckmarkCircle01Icon size={22} color="white" />}
                onPointerUp={async () => {
                  if (!walletMember || !selectedPass) return
                  setCheckinLoading(true)
                  try {
                    const r = await kPost<{ id: string; qr_token: string; amount: number; currency: string; new_balance: number; valid_until: string }>(
                      '/api/day-passes/wallet-issue',
                      { member_id: walletMember.id, pass_type: selectedPass.id, guest_name: walkinName, guest_phone: walkinPhone || null },
                      tenantSlugRef.current,
                    )
                    sounds.passIssued()
                    setIssuedPass({ id: r.id, qrToken: r.qr_token, amount: r.amount, currency: r.currency })
                    setShiftCount(c => c + 1)
                    setScreen('qr_issued')
                  } catch {
                    setScreen('issue_error')
                  } finally { setCheckinLoading(false) }
                }}
              >
                {t.walletConfirm}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════ QR ISSUED ═══════════ */}
        {screen === 'qr_issued' && (
          <motion.div key="qr_issued" {...slide}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${SBH + 20}px 52px 20px`, gap: 18 }}>
            <AutoReturn onReturn={goHome} delay={15000} />

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,163,74,0.09)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 99, padding: '8px 20px', marginBottom: 12 }}>
                  <CheckmarkCircle01Icon size={16} color={S.success} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: S.success, letterSpacing: '0.05em' }}>{t.passIssued.toUpperCase()}</span>
                </div>
              </motion.div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: S.text, letterSpacing: '-0.03em' }}>Welcome, {walkinName}!</div>
            </div>

            {/* Ticket card */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              style={{ background: 'linear-gradient(145deg,#0f172a 0%,#1e1b4b 100%)', borderRadius: 26, overflow: 'hidden', width: '100%', maxWidth: 430, boxShadow: '0 28px 70px rgba(0,0,0,0.22),0 10px 28px rgba(0,0,0,0.14)' }}>

              {/* Ticket header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Day Pass</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>{selectedPass?.label ?? 'Guest Pass'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Valid today until midnight · {gymConfig.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Amount</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'rgba(139,92,246,0.9)', fontVariantNumeric: 'tabular-nums' }}>₣{selectedPass?.price.toLocaleString('fr-CM')}</div>
                  {issuedPass?.id && <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 4 }}>DP-{issuedPass.id.slice(0, 8).toUpperCase()}</div>}
                </div>
              </div>

              {/* QR section */}
              <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 14, boxShadow: `0 0 0 1px ${brandAlpha(brand, 0.15)}` }}>
                  <StyledQRCodeWeb value={issuedPass?.qrToken ?? ''} size={210} finderColor={brand} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Scan at the entrance gate to enter</div>
              </div>
            </motion.div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button size="lg" radius="md" variant="default" leftSection={<PrinterIcon size={17} color={S.textSub} />} onPointerUp={handlePrint} styles={{ root: { fontWeight: 700 } }}>{t.print}</Button>
              <Button size="lg" radius="md" variant="default" leftSection={<Message01Icon size={17} color={S.textSub} />} loading={sendingSMS} disabled={!walkinPhone || sendingSMS} onPointerUp={handleSMSReceipt} styles={{ root: { fontWeight: 700 } }}>{t.sendSMS}</Button>
              <Button size="lg" radius="md" color="indigo" leftSection={<CheckmarkCircle01Icon size={17} color="white" />} onPointerUp={goHome} styles={{ root: { fontWeight: 800 } }}>{t.done}</Button>
            </div>

            {/* Upsell */}
            <div style={{ padding: '12px 24px', background: brandAlpha(brand, 0.07), border: `1px solid ${brandAlpha(brand, 0.2)}`, borderRadius: 14, maxWidth: 430, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: brand, marginBottom: 3 }}>{t.joinAsMember}</div>
              <div style={{ fontSize: '0.75rem', color: S.textSub }}>{t.joinMemberHint}</div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ STAFF PIN ═══════════ */}
        {screen === 'staffpin' && (
          <motion.div key="staffpin" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
            <BackBtn label={t.back} onClick={() => setScreen('idle')} />
            <SectionTitle icon={UserStar01Icon} title={t.enterStaffPIN} brand={brand} />
            <PinPad value={staffPin} onChange={setStaffPin} onTap={sounds.tap} brand={brand}
              onConfirm={async () => {
                if (staffPin.length !== 4) return
                try {
                  const r = await kPost<{ ok: boolean; staff?: { id: string; name: string; role: string } }>(
                    '/api/checkin/staff-verify-pin', { pin: staffPin }, tenantSlugRef.current,
                  )
                  if (r.ok && r.staff) { sounds.success(); setStaffInfo(r.staff); shiftStartRef.current = new Date(); setShiftCount(0); setScreen('staff') }
                  else { sounds.denied(); setStaffPin('') }
                } catch { sounds.denied(); setStaffPin('') }
              }}
            />
          </motion.div>
        )}

        {/* ═══════════ STAFF DASHBOARD ═══════════ */}
        {screen === 'staff' && (
          <motion.div key="staff" {...slide}
            style={{ position: 'absolute', inset: 0, background: S.bg, display: 'flex', flexDirection: 'column', padding: '88px 32px 0', gap: 14, overflow: 'hidden' }}>

            {/* Header — clear button hierarchy */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: S.text, letterSpacing: '-0.03em' }}>{t.staffMode}</div>
                <div style={{ fontSize: FS.sm, color: S.textSub, marginTop: 2 }}>
                  {staffInfo
                    ? <>Signed in as <strong style={{ color: S.text }}>{staffInfo.name}</strong> · <span style={{ textTransform: 'capitalize' }}>{staffInfo.role}</span></>
                    : `Operator view · ${gymConfig.name}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Primary action */}
                <Button size="sm" radius="md" variant="filled" color="dark" onPointerUp={() => setScreen('search')}
                  styles={{ root: { fontWeight: 700, paddingLeft: 18, paddingRight: 18 } }}>{t.manualCheckin}</Button>
                {/* Secondary action */}
                <Button size="sm" radius="md" variant="default" onPointerUp={() => { goHome(); setScreen('walkin') }}
                  styles={{ root: { fontWeight: 700 } }}>Issue day pass</Button>
                {/* Divider */}
                <div style={{ width: 1, height: 24, background: S.border, margin: '0 4px' }} />
                {/* Destructive — sign out */}
                <Button size="sm" radius="md" variant="subtle" color="red"
                  onPointerUp={() => { setStaffInfo(null); setStaffPin(''); setScreen('idle') }}
                  styles={{ root: { fontWeight: 700 } }}>{t.staffSignOut}</Button>
                {/* Ghost — return home */}
                <Button size="sm" radius="md" variant="subtle" color="gray" onPointerUp={() => setScreen('idle')}
                  styles={{ root: { fontWeight: 600, color: S.textMuted } }}>{t.returnHome}</Button>
              </div>
            </div>

            {/* Top row: stat cards + sparkline — left accent strips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.6fr', gap: 14, flexShrink: 0 }}>
              {/* Capacity card — with progress bar + accent strip */}
              {(() => {
                const capPct = Math.round((liveStats.last_hour / gymConfig.maxCapacity) * 100)
                const capWarn = capPct > 85
                const accentColor = capWarn ? S.danger : capPct > 65 ? S.amber : brand
                return (
                  <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: '16px 18px 16px 16px', display: 'flex', gap: 12, overflow: 'hidden' }}>
                    <div style={{ width: 4, borderRadius: 99, background: accentColor, flexShrink: 0, alignSelf: 'stretch', minHeight: 40 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: capWarn ? S.danger : S.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {liveStats.last_hour}<span style={{ fontSize: FS.sm, fontWeight: 600, color: S.textMuted }}>/{gymConfig.maxCapacity}</span>
                      </div>
                      <div style={{ fontSize: FS.xs, color: S.textSub, marginTop: 5, marginBottom: 8, fontWeight: 600 }}>{t.currentCapacity}</div>
                      <Progress value={capPct} size="xs" radius="xl" color={capWarn ? 'red' : capPct > 65 ? 'yellow' : 'indigo'} />
                      <div style={{ fontSize: FS['2xs'], color: capWarn ? S.danger : S.textMuted, fontWeight: 700, marginTop: 4, textAlign: 'right' }}>{capPct}%</div>
                    </div>
                  </div>
                )
              })()}
              {[
                { label: 'Check-ins today', value: String(liveStats.today),                          accent: brand },
                { label: 'Day passes sold', value: String(liveStats.day_passes_today),               accent: S.textMuted },
                { label: 'Revenue today',   value: `₣${liveStats.revenue_today.toLocaleString('fr-CM')}`, accent: S.success },
              ].map(s => (
                <div key={s.label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: '16px 18px 16px 16px', display: 'flex', gap: 12, overflow: 'hidden' }}>
                  <div style={{ width: 4, borderRadius: 99, background: s.accent, flexShrink: 0, alignSelf: 'stretch', minHeight: 40 }} />
                  <div>
                    <div style={{ fontSize: FS['2xl'], fontWeight: 900, color: S.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: FS.xs, color: S.textSub, marginTop: 6, fontWeight: 600 }}>{s.label}</div>
                  </div>
                </div>
              ))}
              {/* Sparkline */}
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: '14px 18px' }}>
                <div style={{ fontSize: FS['2xs'], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: S.textMuted, marginBottom: 6 }}>Hourly traffic</div>
                <HourlySparkline scans={recentScans} />
              </div>
            </div>

            {/* Method filter tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {([
                { key: 'all',      label: 'All' },
                { key: 'qr',       label: 'QR' },
                { key: 'pin',      label: 'PIN' },
                { key: 'manual',   label: 'Manual' },
                { key: 'day_pass', label: 'Day Pass' },
              ] as { key: string; label: string }[]).map(tab => (
                <motion.div key={tab.key} whileTap={{ scale: 0.93 }}
                  onPointerUp={() => setMethodFilter(tab.key)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, cursor: 'pointer', userSelect: 'none',
                    border: `1.5px solid ${methodFilter === tab.key ? S.brand : S.border}`,
                    background: methodFilter === tab.key ? S.brandLight : 'transparent',
                  }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: methodFilter === tab.key ? S.brand : S.textSub }}>
                    {tab.label}
                  </span>
                </motion.div>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: S.textMuted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {(methodFilter === 'all' ? recentScans : recentScans.filter(m => m.method === methodFilter)).length} entries
              </span>
            </div>

            {/* Recent check-ins list */}
            <div style={{ background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 16, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.textMuted }}>{t.recentScans}</div>
                {recentScans.length > 0 && (
                  <motion.div whileTap={{ scale: 0.9 }}
                    onPointerUp={undoLastCheckin}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 99, cursor: 'pointer', userSelect: 'none' }}>
                    <ArrowLeft01Icon size={11} color={S.danger} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: S.danger }}>Undo last</span>
                  </motion.div>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const visible = (methodFilter === 'all' ? recentScans : recentScans.filter(m => m.method === methodFilter)).slice(0, 20)
                  if (visible.length === 0) return (
                    <div style={{ fontSize: '0.85rem', color: S.textMuted, textAlign: 'center', padding: '32px 0' }}>No check-ins yet today</div>
                  )
                  return visible.map(m => {
                    const expiresAt = m.expires_at ? new Date(m.expires_at) : null
                    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null
                    const expiring = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderBottom: `1px solid ${S.border}`, background: 'transparent' }}>
                        {/* Avatar + first-visit dot */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: S.surfaceActive, border: `1.5px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: S.textSub }}>
                              {m.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          {m.is_first_today && (
                            <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: S.success, border: '2px solid white' }} title="First check-in today" />
                          )}
                        </div>
                        {/* Name + plan / expiry */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                          {m.plan_name && (
                            <div style={{ fontSize: '0.63rem', color: expiring ? S.amber : S.textMuted, fontWeight: 600, marginTop: 1 }}>
                              {m.plan_name}{expiring && daysLeft !== null ? ` · expires in ${daysLeft}d` : ''}
                            </div>
                          )}
                        </div>
                        {/* Method badge */}
                        <div style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 99, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.method}</span>
                        </div>
                        {/* Time */}
                        <span style={{ fontSize: '0.7rem', color: S.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 38, textAlign: 'right' }}>
                          {new Date(m.checked_in_at).toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Shift footer — brand-tinted active session indicator */}
            <div style={{ flexShrink: 0, background: brandAlpha(brand, 0.06), borderTop: `1px solid ${brandAlpha(brand, 0.14)}`, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: brand, boxShadow: `0 0 6px ${brandAlpha(brand, 0.6)}` }} />
                <span style={{ fontSize: FS.xs, color: S.textSub, fontWeight: 600 }}>
                  Shift started {shiftStartRef.current
                    ? shiftStartRef.current.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: FS.xs, fontWeight: 800, color: brand, fontVariantNumeric: 'tabular-nums' }}>{shiftCount}</span>
                <span style={{ fontSize: FS.xs, color: S.textSub, fontWeight: 600 }}>check-in{shiftCount !== 1 ? 's' : ''} this shift</span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
