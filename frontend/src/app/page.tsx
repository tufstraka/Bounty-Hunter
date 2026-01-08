'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowRight, Sparkles, Zap, Shield, Coins,
  TrendingUp, CheckCircle2, Target, Trophy, Clock,
  Users, Heart, Play, Terminal, GitPullRequest, Check
} from 'lucide-react';

// FAQ structured data for rich snippets
const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I earn money fixing bugs with FixFlow?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "When a test fails in a CI pipeline, FixFlow automatically creates a bounty. You fix the bug, submit a pull request with your wallet address, and once the PR is merged and tests pass, payment is sent instantly to your wallet."
      }
    },
    {
      "@type": "Question",
      "name": "What is MNEE and why do you use it?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "MNEE is a stablecoin pegged 1:1 to USD. We use it for instant, zero-fee payments with no volatility risk. 1 MNEE always equals $1."
      }
    },
    {
      "@type": "Question",
      "name": "Are there any fees for receiving bounty payments?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, there are zero transaction fees. You keep 100% of the bounty amount when a payment is made."
      }
    },
    {
      "@type": "Question",
      "name": "How fast are bounty payments?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Payments are instant - they settle in less than a second. The moment your pull request is merged, the bounty is transferred to your wallet."
      }
    },
    {
      "@type": "Question",
      "name": "What is bounty escalation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Bounty escalation automatically increases unclaimed bounties over time. Bounties grow at 24 hours, 72 hours, and 1 week marks, incentivizing fixes for older issues."
      }
    }
  ]
};

export default function HomePage() {
  const { user, login, enterDemoMode } = useAuth();

  return (
    <div className="min-h-screen">
      {/* FAQ Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 lg:pt-28 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-100/60 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 bg-secondary-100/50 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 right-1/3 w-64 h-64 bg-accent-100/40 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">

          {/* Main Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 
              leading-[1.1] tracking-tight mb-6 animate-fade-in-up">
              Fix bugs.{' '}
              <span className="text-gradient-primary">Get paid.</span>
              <br />
              <span className="text-gray-400">Instantly.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-gray-500 max-w-2xl mx-auto mb-10
              leading-relaxed animate-fade-in-up delay-100">
              When tests fail, bounties appear. When you fix them, money lands in your wallet. 
              <span className="text-gray-400"> No forms. No invoices.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12
              animate-fade-in-up delay-200">
              {user ? (
                <Link href="/dashboard" className="btn-primary btn-lg group">
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <>
                  <button onClick={login} className="btn-primary btn-lg group">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>Start Earning</span>
                  </button>
                  <button onClick={() => enterDemoMode(false)} className="btn-secondary btn-lg group">
                    <Play className="w-5 h-5 text-gray-500" />
                    <span>Try Demo</span>
                  </button>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500
              animate-fade-in-up delay-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary-600" />
                <span>Zero fees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary-600" />
                <span>Instant payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary-600" />
                <span>USD-stable value</span>
              </div>
            </div>
          </div>

          {/* Hero Visual - Terminal Mock */}
          <div className="mt-20 max-w-4xl mx-auto animate-fade-in-up delay-300">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-200/40 via-secondary-200/40 to-accent-200/40 
                rounded-3xl blur-2xl opacity-60" />
              
              {/* Terminal window */}
              <div className="relative terminal rounded-2xl overflow-hidden">
                <div className="terminal-header">
                  <div className="terminal-dot bg-red-400" />
                  <div className="terminal-dot bg-yellow-400" />
                  <div className="terminal-dot bg-green-400" />
                  <span className="ml-auto text-gray-500 text-xs font-mono">fixflow.yml</span>
                </div>
                <div className="terminal-body space-y-4">
                  <div>
                    <span className="text-gray-500"># CI detected test failure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">✗</span>
                    <span className="text-red-400">test_payment_processing</span>
                    <span className="text-gray-500">FAILED</span>
                  </div>
                  <div className="pt-2 border-t border-gray-700/50">
                    <span className="text-secondary-400">→ Bounty created automatically</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
                    <Coins className="w-5 h-5 text-primary-400" />
                    <span className="text-primary-400 font-semibold">50 MNEE</span>
                    <span className="text-gray-500">≈ $50.00</span>
                    <span className="ml-auto badge-live text-xs">
                      Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -top-6 -right-6 card-elevated p-4 rounded-xl animate-float
                hidden lg:flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success-500 to-success-600 
                  flex items-center justify-center shadow-md">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Payment Sent!</div>
                  <div className="text-xs text-gray-500">+50 MNEE to @developer</div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-6 card-elevated px-4 py-3 rounded-xl 
                hidden lg:flex items-center gap-2 animate-float delay-300">
                <Trophy className="w-5 h-5 text-primary-500" />
                <span className="text-sm font-medium text-gray-700">Top earner this week</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Three steps to earning
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              No signup forms. No payment details upfront. Just connect GitHub and start fixing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: 1,
                icon: Terminal,
                title: 'Test fails, bounty appears',
                description: 'Your CI pipeline runs, a test breaks. FixFlow automatically creates an issue with a bounty attached.',
                color: 'primary',
                detail: 'Works with any CI/CD'
              },
              {
                step: 2,
                icon: GitPullRequest,
                title: 'You fix, PR passes',
                description: 'Submit your pull request fixing the issue. Our bot verifies tests are now passing.',
                color: 'secondary',
                detail: 'Automatic verification'
              },
              {
                step: 3,
                icon: Coins,
                title: 'Instant deposit',
                description: 'The moment the PR is merged, stablecoin is transferred to your wallet instantly.',
                color: 'accent',
                detail: 'Sub-second settlement'
              },
            ].map((item, i) => (
              <div key={i} className="group relative">
                <div className="card-hover p-8 h-full">
                  {/* Step number */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full 
                    bg-gray-900 text-white text-sm font-bold
                    flex items-center justify-center shadow-lg">
                    {item.step}
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl mb-6
                    bg-${item.color}-100 flex items-center justify-center
                    group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`w-7 h-7 text-${item.color}-600`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed mb-4">
                    {item.description}
                  </p>

                  {/* Detail tag */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                    bg-${item.color}-100 text-${item.color}-700 text-xs font-semibold`}>
                    <Check className="w-3 h-3" />
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="card-glass p-10 lg:p-14">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              {[
                { icon: Coins, value: '$0', label: 'Transaction Fees', sub: 'Keep 100% of bounties', color: 'primary' },
                { icon: Zap, value: '<1s', label: 'Payment Speed', sub: 'Instant settlement', color: 'secondary' },
                { icon: Shield, value: '1:1', label: 'USD Stable', sub: 'No volatility risk', color: 'accent' },
                { icon: TrendingUp, value: 'Auto', label: 'Escalation', sub: 'Bounties grow over time', color: 'primary' },
              ].map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 
                    flex items-center justify-center mx-auto mb-4
                    group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                  <div className={`text-4xl font-bold text-gradient-${stat.color} mb-2`}>
                    {stat.value}
                  </div>
                  <div className="text-gray-700 font-medium">{stat.label}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Escalation Feature */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <div className="badge-accent mb-6">
                <TrendingUp className="w-4 h-4" />
                Smart Escalation
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                The longer you wait,<br />the more it&apos;s worth
              </h2>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Unclaimed bounties don&apos;t just sit there. They grow. 
                Every 24 hours without a fix, the bounty increases automatically.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Clock, color: 'secondary', title: 'Time-based increases', desc: 'Bounties escalate at 24h, 72h, and 1 week marks.' },
                  { icon: Target, color: 'primary', title: 'Configurable limits', desc: 'Project owners set max bounties—no runaway costs.' },
                  { icon: Users, color: 'accent', title: 'Community alerts', desc: 'Escalated bounties get highlighted, drawing more attention.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-${item.color}-100 
                      flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual */}
            <div className="card p-8 rounded-2xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Bounty Escalation Timeline
              </h3>
              <div className="space-y-6">
                {[
                  { amount: 50, color: 'gray', width: '40%', label: 'Start' },
                  { amount: 60, color: 'secondary', width: '55%', label: '24 hours' },
                  { amount: 75, color: 'accent', width: '70%', label: '72 hours' },
                  { amount: 100, color: 'primary', width: '100%', label: '1 week' },
                ].map((tier, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-16 text-center">
                      <div className={`text-2xl font-bold ${
                        tier.color === 'gray' ? 'text-gray-700' : `text-${tier.color}-600`
                      }`}>
                        {tier.amount}
                      </div>
                      <div className="text-xs text-gray-400">MNEE</div>
                    </div>
                    <div className="flex-1">
                      <div className="progress">
                        <div 
                          className={`progress-fill-${tier.color === 'gray' ? 'primary' : tier.color}`}
                          style={{ width: tier.width }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-sm text-gray-500">{tier.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-primary-50 border border-primary-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-primary-800">Double the reward</div>
                    <div className="text-sm text-primary-600">Wait a week, earn twice as much</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why MNEE Section */}
      <section className="py-24 lg:py-32 bg-gray-900 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
              bg-primary-500/20 text-primary-300 text-sm font-medium mb-6">
              <Coins className="w-4 h-4" />
              Powered by MNEE
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why we use MNEE stablecoin
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Real payments need real money. MNEE gives you the stability of dollars with the speed of digital payments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, color: 'primary', title: 'Stable Value', desc: '1 MNEE = 1 USD, always. No waking up to find your bounty dropped 40%.' },
              { icon: Zap, color: 'secondary', title: 'Instant Transfers', desc: 'Payments settle in milliseconds, not days. Get paid the moment your PR merges.' },
              { icon: Heart, color: 'accent', title: 'Zero Fees', desc: 'No transaction fees eating into your bounty. 100% of your earnings are yours.' },
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10
                hover:bg-white/10 transition-colors duration-300">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${item.color}-400 to-${item.color}-600
                  flex items-center justify-center mb-6 shadow-lg`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-100/60 via-secondary-100/60 to-accent-100/60 
              rounded-3xl blur-2xl opacity-60" />
            
            <div className="relative card-glass p-12 lg:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Ready to start earning?
              </h2>
              <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
                Join developers who get paid instantly for their contributions. 
                No paperwork, no hassle.
              </p>
              
              {user ? (
                <Link href="/dashboard" className="btn-primary btn-lg inline-flex group">
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button onClick={login} className="btn-primary btn-lg group">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>Connect GitHub & Start</span>
                  </button>
                  <button onClick={() => enterDemoMode(false)} className="btn-secondary btn-lg group">
                    <Play className="w-5 h-5 text-gray-500" />
                    <span>Try Demo First</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-8">
            {/* Main Footer Content */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600
                  flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900">FixFlow</span>
              </div>

              {/* Primary Links */}
              <div className="flex items-center gap-8 text-sm text-gray-500">
                <Link href="/bounties" className="hover:text-gray-900 transition-colors">
                  Explore
                </Link>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors">
                  GitHub
                </a>
                <a href="https://mnee.io" target="_blank" rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors">
                  MNEE
                </a>
              </div>

              {/* Copyright */}
              <div className="text-sm text-gray-400">
                Powered by MNEE Stablecoin
              </div>
            </div>

            {/* Legal Links Divider */}
            <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="/privacy" className="hover:text-gray-600 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-gray-600 transition-colors">
                  Terms of Service
                </Link>
              </div>
              <div className="text-sm text-gray-400">
                © {new Date().getFullYear()} FixFlow. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}