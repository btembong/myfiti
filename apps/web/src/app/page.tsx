import { Navbar } from './(marketing)/_components/Navbar'
import { Hero } from './(marketing)/_components/Hero'
import { Stats } from './(marketing)/_components/Stats'
import { Features } from './(marketing)/_components/Features'
import { HowItWorks } from './(marketing)/_components/HowItWorks'
import { Pricing } from './(marketing)/_components/Pricing'
import { Testimonials } from './(marketing)/_components/Testimonials'
import { FinalCTA } from './(marketing)/_components/FinalCTA'
import { Footer } from './(marketing)/_components/Footer'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
