import { Navbar } from '@/app/components/landing/Navbar'
import { Hero } from '@/app/components/landing/Hero'
import { Features } from '@/app/components/landing/Features'
import { HowItWorks } from '@/app/components/landing/HowItWorks'
import { Pricing } from '@/app/components/landing/Pricing'
import { SignupSection } from '@/app/components/landing/SignupSection'
import { CTA } from '@/app/components/landing/CTA'
import { Footer } from '@/app/components/landing/Footer'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <SignupSection />
      <CTA />
      <Footer />
    </>
  )
}
