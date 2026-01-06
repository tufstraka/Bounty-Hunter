import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText, Scale, AlertTriangle, Coins, Users,
  Ban, Mail, Calendar, ArrowLeft, Zap,
  CheckCircle2, XCircle
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Read the Terms of Service for FixFlow, the automated bug bounty platform. Understand your rights, responsibilities, and how our service works.',
  openGraph: {
    title: 'Terms of Service | FixFlow',
    description: 'Terms and conditions for using the FixFlow automated bounty platform.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | FixFlow',
    description: 'Terms and conditions for using the FixFlow automated bounty platform.',
  },
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const lastUpdated = 'January 6, 2026';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 
              flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Terms of Service</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Calendar className="w-4 h-4" />
                Last updated: {lastUpdated}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Key Points Summary */}
        <div className="card-glass p-6 mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-secondary-600" />
            Key Points
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">You keep 100% of bounty earnings (no platform fees)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Payments are instant and irreversible on blockchain</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">We verify PR merges and passing tests automatically</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">No gaming the system with fake bounties or PRs</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">No transferring to sanctioned addresses</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">No using the platform if under 16 years old</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="prose prose-gray max-w-none space-y-12">
          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">1</span>
              Acceptance of Terms
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 leading-relaxed">
                By accessing or using FixFlow (&quot;Service&quot;), including our website, GitHub App, and payment services, 
                you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to all the terms and 
                conditions of this agreement, you may not access or use the Service.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                These Terms constitute a legally binding agreement between you and FixFlow. We reserve the right 
                to modify these Terms at any time. Your continued use of the Service following any changes 
                constitutes acceptance of those changes.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">2</span>
              Description of Service
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                FixFlow is an automated bounty platform that connects software repositories with developers 
                through financial incentives.
              </p>
              <div className="space-y-4">
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Users className="w-5 h-5 text-secondary-600" />
                    For Repository Owners
                  </h4>
                  <p className="text-sm text-gray-600">
                    Automatic creation of bounties when CI/CD tests fail, configurable bounty amounts, 
                    escalation settings, and automated payment processing when fixes are merged.
                  </p>
                </div>
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-secondary-600" />
                    Payment Processing
                  </h4>
                  <p className="text-sm text-gray-600">
                    Payments are processed using MNEE stablecoin (BSV-based) or ERC-20 tokens on Ethereum. 
                    All payments are final and irreversible once confirmed on the blockchain.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">3</span>
              Eligibility
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">To use the Service, you must:</p>
              <ul className="space-y-2 text-gray-600 list-disc list-inside">
                <li>Be at least 16 years of age</li>
                <li>Have a valid GitHub account</li>
                <li>Have the legal capacity to enter into binding contracts in your jurisdiction</li>
                <li>Not be located in, or a resident of, any sanctioned country</li>
                <li>Not be on any U.S. or international sanctions list</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">4</span>
              Account Registration
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 leading-relaxed">
                You register for the Service by authenticating with your GitHub account via OAuth. You are 
                responsible for maintaining the security of your GitHub account credentials. You agree to 
                provide accurate and current information and notify us immediately of any unauthorized access.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">5</span>
              Claiming Bounties
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">To claim a bounty, you must:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-6">
                <li>Submit a pull request that fixes the issue referenced in the bounty</li>
                <li>Include your payment address in the PR description (MNEE or Ethereum format)</li>
                <li>Ensure all CI tests pass on your pull request</li>
                <li>Have your pull request merged by a repository maintainer</li>
              </ol>
              <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> Payments are processed automatically and cannot be reversed. 
                    Ensure your payment address is correct before submitting your PR.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">6</span>
              Payment Terms
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                Payments are made in MNEE stablecoin (pegged to USD at 1:1) or ERC-20 tokens on Ethereum. 
                FixFlow does not charge platform fees on bounty payments—you receive 100% of the bounty amount.
              </p>
              <p className="text-gray-600">
                <strong>Tax Responsibility:</strong> You are solely responsible for determining and remitting 
                any taxes applicable to your bounty earnings.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">7</span>
              Prohibited Conduct
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">You agree not to:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Create fake bounties or issues',
                  'Submit fraudulent PRs',
                  'Collude to manipulate payments',
                  'Use for money laundering',
                  'Transfer to sanctioned addresses',
                  'Exploit smart contract bugs',
                  'Interfere with the Service',
                  'Impersonate other users',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">8</span>
              Intellectual Property
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                The code you submit in pull requests remains subject to the license of the repository you 
                are contributing to. By submitting a PR, you represent that you have the right to submit the 
                code and agree to license your contribution under the repository&apos;s license.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">9</span>
              Disclaimers
            </h2>
            <div className="pl-11">
              <div className="p-5 rounded-xl bg-gray-100 border border-gray-200">
                <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-3">
                  THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We disclaim all warranties, express or implied, including merchantability, fitness for a 
                  particular purpose, and non-infringement. We do not warrant that the Service will be 
                  uninterrupted, secure, error-free, or that payments will always be processed successfully.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">10</span>
              Limitation of Liability
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, FIXFLOW SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, 
                OR GOODWILL. Our total liability shall not exceed the amount of bounties you have received 
                through the Service in the twelve (12) months preceding the claim.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">11</span>
              Termination
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                We may terminate or suspend your access to the Service immediately, without prior notice, 
                for any reason, including breach of these Terms. Upon termination, your right to use the 
                Service will immediately cease. Confirmed payments on the blockchain cannot be reversed.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">12</span>
              Governing Law & Disputes
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                These Terms shall be governed by the laws of the State of Delaware, United States. Any dispute 
                shall first be attempted to be resolved through good-faith negotiation. If unresolved within 
                30 days, disputes shall be resolved through binding arbitration. Class action lawsuits are waived.
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-600 font-bold text-sm">13</span>
              Contact Us
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                If you have questions about these Terms, please contact us:
              </p>
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-5 h-5 text-secondary-600" />
                  <span className="text-gray-900 font-medium">support@locsafe.org</span>
                </div>
                <p className="text-sm text-gray-500">
                  We aim to respond to all inquiries within 30 days.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="font-semibold text-gray-900">FixFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}