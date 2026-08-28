import { StarIcon } from 'hugeicons-react'

const REVIEWS = [
  {
    name: 'Jean Mbarga',
    role: 'Owner, PowerFit Douala',
    flag: '🇨🇲',
    avatar: 'JM',
    stars: 5,
    quote: "Before myfiti I tracked everything in WhatsApp messages and a paper ledger. Now I can see at a glance which members are expiring, who checked in today, and exactly how much revenue came in this month. The QR kiosk alone saved me two staff salaries.",
  },
  {
    name: 'Wanjiru Kamau',
    role: 'Owner, PeakPulse Nairobi',
    flag: '🇰🇪',
    avatar: 'WK',
    stars: 5,
    quote: "The Growth+ plan has everything — class scheduling, trainer management, and the kiosk at our entrance. My members love scanning in. The SuperAdmin dashboard I gave my business partner is incredible — he monitors platform health from Nairobi while I'm at the gym floor.",
  },
  {
    name: 'Chidi Okonkwo',
    role: 'Owner, FitLife Lagos',
    flag: '🇳🇬',
    avatar: 'CO',
    stars: 5,
    quote: "I was skeptical about another 'African SaaS' but myfiti actually understands our market. Mobile money payments work out of the box, the UI is fast even on 3G, and the onboarding took me literally 8 minutes. I wish I had found this two years ago.",
  },
]

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <StarIcon key={i} size={13} color="#555" />
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section className="py-24 px-6" style={{ background: '#000' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#333' }}>Customer stories</p>
          <h2 className="text-4xl font-black" style={{ color: '#f0f0f0' }}>Gym owners across Africa trust myfiti</h2>
          <p className="mt-4 font-medium" style={{ color: '#555' }}>
            Real results from real gyms in Cameroon, Nigeria, Kenya, Ghana, Senegal, and Côte d&apos;Ivoire.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {REVIEWS.map(r => (
            <div key={r.name} className="rounded-2xl p-7 flex flex-col" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <Stars count={r.stars} />

              <p className="text-sm leading-relaxed mt-5 flex-1" style={{ color: '#888' }}>
                &ldquo;{r.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: '1px solid #1a1a1a' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: '#1a1a1a', color: '#555' }}>
                  {r.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#f0f0f0' }}>{r.name}</p>
                  <p className="text-xs" style={{ color: '#555' }}>{r.flag} {r.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <p className="w-full text-center text-xs mb-2" style={{ color: '#333' }}>Available across</p>
          {[
            { flag: '🇨🇲', name: 'Cameroon' },
            { flag: '🇳🇬', name: 'Nigeria' },
            { flag: '🇬🇭', name: 'Ghana' },
            { flag: '🇨🇮', name: "Côte d'Ivoire" },
            { flag: '🇰🇪', name: 'Kenya' },
            { flag: '🇸🇳', name: 'Senegal' },
          ].map(c => (
            <div key={c.name} className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <span className="text-lg">{c.flag}</span>
              <span className="text-xs font-medium" style={{ color: '#555' }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
