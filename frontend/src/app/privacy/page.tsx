import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Lock, Eye, Database, Globe, Mail, Calendar, ArrowLeft, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how FixFlow collects, uses, and protects your personal information. We are committed to transparency and data security.',
  openGraph: {
    title: 'Privacy Policy | FixFlow',
    description: 'Learn how FixFlow handles your data with transparency and security.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | FixFlow',
    description: 'Learn how FixFlow handles your data with transparency and security.',
  },
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 
              flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Privacy Policy</h1>
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
        {/* Quick Summary */}
        <div className="card-glass p-6 mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary-600" />
            Privacy at a Glance
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-gray-200">
              <div className="text-2xl font-bold text-primary-600 mb-1">Minimal</div>
              <div className="text-sm text-gray-600">We collect only what&apos;s necessary to operate FixFlow</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-gray-200">
              <div className="text-2xl font-bold text-secondary-600 mb-1">Transparent</div>
              <div className="text-sm text-gray-600">Clear explanations of how your data is used</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-gray-200">
              <div className="text-2xl font-bold text-accent-600 mb-1">Secure</div>
              <div className="text-sm text-gray-600">Industry-standard encryption and security practices</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="prose prose-gray max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">1</span>
              Introduction
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 leading-relaxed">
                FixFlow (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates a platform that connects software repositories with 
                automated bounty systems for bug fixes. This Privacy Policy explains how we collect, use, disclose, 
                and safeguard your information when you use our platform, including our website, GitHub App, 
                and associated services (collectively, the &quot;Service&quot;).
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                By using FixFlow, you consent to the data practices described in this policy. If you do not agree 
                with this policy, please do not use our Service.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">2</span>
              Information We Collect
            </h2>
            <div className="pl-11 space-y-6">
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-secondary-600" />
                  Information from GitHub OAuth
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  When you authenticate with GitHub, we receive and store:
                </p>
                <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
                  <li>GitHub username and user ID</li>
                  <li>Email address associated with your GitHub account</li>
                  <li>Profile picture URL</li>
                  <li>Public repository information (for repositories where our App is installed)</li>
                  <li>Pull request and issue metadata (numbers, titles, status)</li>
                </ul>
              </div>

              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-secondary-600" />
                  Blockchain and Payment Information
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  To facilitate bounty payments, we collect and process:
                </p>
                <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
                  <li>MNEE wallet addresses (Bitcoin-style addresses starting with &apos;1&apos; or &apos;3&apos;)</li>
                  <li>Ethereum wallet addresses (addresses starting with &apos;0x&apos;)</li>
                  <li>Transaction hashes for completed payments</li>
                  <li>Payment amounts and timestamps</li>
                </ul>
                <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> We never collect or store private keys. Wallet addresses are public 
                    blockchain information and do not enable access to your funds.
                  </p>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-secondary-600" />
                  Automatically Collected Information
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  Like most web services, we automatically collect:
                </p>
                <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
                  <li>IP addresses and approximate geolocation</li>
                  <li>Browser type and version</li>
                  <li>Operating system</li>
                  <li>Referring URLs and pages visited</li>
                  <li>Time spent on pages and click patterns</li>
                  <li>Error logs and diagnostic data</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">3</span>
              How We Use Your Information
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">We use the information we collect to:</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { title: 'Operate the Service', desc: 'Create and manage bounties, process payments, verify PR merges' },
                  { title: 'Authenticate Users', desc: 'Verify your identity through GitHub OAuth' },
                  { title: 'Process Payments', desc: 'Send MNEE or Ethereum tokens to your wallet address' },
                  { title: 'Improve the Service', desc: 'Analyze usage patterns to enhance features and fix bugs' },
                  { title: 'Communicate', desc: 'Send service-related notifications (e.g., payment confirmations)' },
                  { title: 'Prevent Fraud', desc: 'Detect and prevent fraudulent or abusive behavior' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">4</span>
              Data Sharing and Disclosure
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">We may share your information in the following circumstances:</p>
              <div className="space-y-4">
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">Public Blockchain Data</h4>
                  <p className="text-sm text-gray-600">
                    When we process payments, transaction data (wallet addresses, amounts, transaction hashes) 
                    becomes part of the public blockchain record. This is inherent to blockchain technology and 
                    cannot be altered or deleted.
                  </p>
                </div>
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">GitHub Integration</h4>
                  <p className="text-sm text-gray-600">
                    We post comments on GitHub issues and pull requests (e.g., bounty notifications, payment confirmations). 
                    Your GitHub username may be mentioned in these comments. This information is visible according to the 
                    repository&apos;s visibility settings (public or private).
                  </p>
                </div>
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">Service Providers</h4>
                  <p className="text-sm text-gray-600">
                    We may share data with trusted third-party service providers who assist in operating our Service 
                    (e.g., hosting providers, analytics services). These providers are contractually bound to protect 
                    your data and use it only for the purposes we specify.
                  </p>
                </div>
                <div className="card p-5">
                  <h4 className="font-semibold text-gray-900 mb-2">Legal Requirements</h4>
                  <p className="text-sm text-gray-600">
                    We may disclose your information if required by law, subpoena, or other legal process, or if 
                    we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">5</span>
              Data Security
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2" />
                  <span>TLS encryption for all data in transit</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2" />
                  <span>Encrypted database storage for sensitive information</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2" />
                  <span>Regular security audits and vulnerability assessments</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2" />
                  <span>Access controls limiting who can view personal data</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2" />
                  <span>Private keys for payment wallets stored in secure, isolated environments</span>
                </li>
              </ul>
              <div className="mt-6 p-4 rounded-xl bg-primary-50 border border-primary-100">
                <p className="text-sm text-primary-800">
                  While we take reasonable precautions, no method of transmission over the Internet or electronic 
                  storage is 100% secure. We cannot guarantee absolute security of your data.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">6</span>
              Data Retention
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                We retain your data for as long as necessary to provide the Service and fulfill the purposes 
                described in this policy:
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 mt-2" />
                  <span><strong>Account data:</strong> Retained while your account is active and for 90 days after deletion request</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 mt-2" />
                  <span><strong>Payment records:</strong> Retained for 7 years for legal and tax compliance</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 mt-2" />
                  <span><strong>Log data:</strong> Automatically deleted after 90 days</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 mt-2" />
                  <span><strong>Blockchain data:</strong> Permanent (immutable by nature of blockchain technology)</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">7</span>
              Your Rights and Choices
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">Depending on your location, you may have certain rights regarding your personal data:</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { right: 'Access', desc: 'Request a copy of your personal data' },
                  { right: 'Correction', desc: 'Request correction of inaccurate data' },
                  { right: 'Deletion', desc: 'Request deletion of your account and data' },
                  { right: 'Portability', desc: 'Request your data in a machine-readable format' },
                  { right: 'Objection', desc: 'Object to certain types of processing' },
                  { right: 'Withdraw Consent', desc: 'Withdraw consent where processing is based on consent' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-6 h-6 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-secondary-600">{i + 1}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{item.right}</div>
                      <div className="text-sm text-gray-600">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-gray-600 mt-4">
                To exercise these rights, please contact us at the email address below.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">8</span>
              International Transfers
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                Your information may be transferred to and processed in countries other than your country of residence. 
                These countries may have data protection laws different from your country. By using the Service, you 
                consent to the transfer of your information to these countries. We take appropriate safeguards to 
                ensure your data remains protected in accordance with this policy.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">9</span>
              Children&apos;s Privacy
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                FixFlow is not intended for children under 16 years of age. We do not knowingly collect personal 
                information from children. If you are a parent or guardian and believe your child has provided us 
                with personal information, please contact us immediately. If we discover that a child under 16 has 
                provided us with personal information, we will delete such information promptly.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">10</span>
              Changes to This Policy
            </h2>
            <div className="pl-11">
              <p className="text-gray-600">
                We may update this Privacy Policy from time to time. When we make changes, we will update the 
                &quot;Last updated&quot; date at the top of this page and, for significant changes, we may notify you via 
                email or through a notice on our Service. Your continued use of the Service after any changes 
                constitutes your acceptance of the new Privacy Policy.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">11</span>
              Contact Us
            </h2>
            <div className="pl-11">
              <p className="text-gray-600 mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-5 h-5 text-primary-600" />
                  <span className="text-gray-900 font-medium">support@locsafe.org</span>
                </div>
                <p className="text-sm text-gray-500">
                  We aim to respond to all privacy-related inquiries within 30 days.
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
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}