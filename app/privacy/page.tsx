export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-8 md:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 font-serif">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: December 28, 2024</p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Rightfit ("we," "our," or "us") respects your privacy. This Privacy Policy explains how we collect,
              use, store, and protect your personal information when you use our resume analysis service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">2.1 Information You Provide</h3>
            <p className="text-gray-700 mb-2">When you use our Service, you provide:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Resume Content:</strong> The full text of your resume/CV, including work history, education, skills, and other professional information</li>
              <li><strong>Job Description Content:</strong> Job postings or URLs you submit for analysis</li>
              <li><strong>Uploaded Files:</strong> PDF resume files (up to 1MB)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">2.2 Automatically Collected Information</h3>
            <p className="text-gray-700 mb-2">We automatically collect:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Usage Data:</strong> Pages visited, features used, analysis mode selected (Fast vs Deep)</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information, session duration</li>
              <li><strong>Performance Data:</strong> API response times, error logs (for debugging)</li>
              <li><strong>Analytics:</strong> Anonymized usage patterns via Vercel Analytics</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-2">We use your information to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Provide the Service:</strong> Process your resume and job description to generate optimized suggestions and insights</li>
              <li><strong>AI Processing:</strong> Send your content to Anthropic's Claude AI API for analysis</li>
              <li><strong>Improve Quality:</strong> Analyze usage patterns to improve our algorithms and user experience</li>
              <li><strong>Debug Issues:</strong> Investigate and resolve technical problems</li>
              <li><strong>Prevent Abuse:</strong> Detect and prevent fraudulent or abusive use of the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">4. Data Storage and Retention</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">4.1 Temporary Processing</h3>
            <p className="text-gray-700 mb-4">
              Your resume and job description are processed <strong>transiently</strong> for the duration of the analysis session.
              We currently store analysis results in memory with a 10-minute expiration for Deep Mode job queues.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">4.2 No Permanent Storage</h3>
            <p className="text-gray-700 mb-4">
              <strong>Important:</strong> We do not permanently store your resume content, job descriptions, or analysis results
              in any database. Once you close your browser session or the job expires, your data is deleted.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">4.3 Third-Party AI Processing</h3>
            <p className="text-gray-700 mb-4">
              Your content is sent to Anthropic's Claude API for processing. Anthropic's data retention and privacy
              practices are governed by their own privacy policy. As of our last update, Anthropic does not train
              models on customer data submitted via API.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">5. Data Sharing</h2>
            <p className="text-gray-700 mb-2">We share your data only as follows:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Anthropic (Claude AI):</strong> Your resume and job description are sent to Anthropic for AI analysis</li>
              <li><strong>Vercel (Hosting):</strong> Our Service is hosted on Vercel, which processes technical data</li>
              <li><strong>Analytics:</strong> Anonymized usage data via Vercel Analytics</li>
            </ul>
            <p className="text-gray-700 mb-4">
              We do <strong>not</strong> sell, rent, or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">6. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement reasonable security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>HTTPS Encryption:</strong> All data transmission uses TLS/SSL encryption</li>
              <li><strong>API Security:</strong> Secure authentication with Anthropic's API</li>
              <li><strong>Ephemeral Processing:</strong> Data is not stored permanently</li>
              <li><strong>No Authentication Required:</strong> We don't collect or store user accounts</li>
            </ul>
            <p className="text-gray-700 mb-4">
              However, no internet transmission is 100% secure. Use the Service at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">7. Your Privacy Rights</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">7.1 Data Minimization</h3>
            <p className="text-gray-700 mb-4">
              You can choose to redact sensitive information (salary, personal addresses, references) from your
              resume before submitting it. Our Service focuses on professional qualifications.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">7.2 Right to Object</h3>
            <p className="text-gray-700 mb-4">
              By using the Service, you consent to AI processing of your resume. If you do not consent,
              please do not use the Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">7.3 Data Deletion</h3>
            <p className="text-gray-700 mb-4">
              Since we don't permanently store your data, no deletion request is necessary.
              Simply close your browser to clear session data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">8. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">
              We use minimal cookies and local storage:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Session Storage:</strong> Temporary storage of your resume and analysis during your session</li>
              <li><strong>Analytics Cookies:</strong> Vercel Analytics uses first-party cookies for anonymized usage tracking</li>
            </ul>
            <p className="text-gray-700 mb-4">
              We do not use third-party advertising or tracking cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">9. International Users</h2>
            <p className="text-gray-700 mb-4">
              Our Service is hosted in the United States (via Vercel). If you use the Service from outside the U.S.,
              your data will be transferred to and processed in the U.S. By using the Service, you consent to this transfer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">10. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our Service is not intended for users under 16 years of age. We do not knowingly collect information
              from children. If you are a parent and believe your child has used our Service, please contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">11. Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy periodically. The "Last updated" date at the top will reflect changes.
              Continued use of the Service after updates constitutes acceptance of the modified policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy or how we handle your data, please contact us through
              our website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 font-serif">13. GDPR & CCPA Compliance</h2>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">EU Users (GDPR)</h3>
            <p className="text-gray-700 mb-2">If you are in the EU, you have additional rights:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Right to Access:</strong> Request a copy of your data (though we don't store it permanently)</li>
              <li><strong>Right to Erasure:</strong> Request deletion (automatic upon session end)</li>
              <li><strong>Right to Portability:</strong> Export your data (you can copy/download results during your session)</li>
              <li><strong>Right to Object:</strong> Object to processing (don't use the Service if you object)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">California Users (CCPA)</h3>
            <p className="text-gray-700 mb-4">
              We do not sell your personal information. You have the right to request disclosure of what information
              we collect and how we use it.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Rightfit
          </a>
        </div>
      </div>
    </div>
  )
}
