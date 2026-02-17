// frontend/src/components/FAQPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, Printer, FileText, CreditCard, 
  Shield, HelpCircle, ArrowLeft 
} from 'lucide-react';

const faqs = [
  {
    category: 'Supported Formats',
    icon: FileText,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    questions: [
      {
        q: 'What file formats can I print?',
        a: `JusPri supports the following file types:\n\n• PDF (.pdf) — Prints directly, no conversion needed\n• Microsoft Word (.doc, .docx) — Auto-converted to PDF\n• OpenDocument Text (.odt) — Auto-converted to PDF\n• Rich Text Format (.rtf) — Auto-converted to PDF\n• Plain Text (.txt, .md) — Auto-converted to PDF\n• Images (.png, .jpg, .jpeg) — Scaled to A4 and printed\n\nMaximum file size is 50 MB.`
      },
      {
        q: 'Are non-PDF files converted automatically?',
        a: 'Yes. Word documents, text files, and images are automatically converted to PDF on the kiosk before printing. You\'ll see a "Converting to PDF..." status update in real time. The process usually takes 5–15 seconds.'
      },
      {
        q: 'What if my file has special fonts or formatting?',
        a: 'Files are converted using LibreOffice on the kiosk. Standard fonts render correctly. Uncommon or embedded fonts may substitute during conversion. For best results, export your document as a PDF before uploading — this guarantees it prints exactly as designed.'
      }
    ]
  },
  {
    category: 'Failed Prints & Refunds',
    icon: CreditCard,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    questions: [
      {
        q: 'What happens if the printer jams or runs out of paper?',
        a: 'If a hardware failure (paper jam, out-of-paper, offline printer) interrupts your job after payment, your job is marked as FAILED in the system. Contact the kiosk operator or support with your Job ID — visible in your print history — to request a reprint or refund.'
      },
      {
        q: 'What if my job fails after I pay?',
        a: 'Jobs can fail due to conversion errors, network issues, or printer faults. In all cases:\n\n• The failure is logged with a reason\n• Your Job ID is preserved in History\n• You can contact support with the Job ID for a resolution\n\nWe do not charge for jobs that fail before printing begins.'
      },
      {
        q: 'How do I request a refund?',
        a: 'Refunds are handled per kiosk operator policy. To request one:\n\n1. Go to History and copy your Job ID\n2. Note the failure reason shown\n3. Contact the kiosk location or email support\n\nFull Razorpay payment integration with automated refunds is coming soon.'
      }
    ]
  },
  {
    category: 'Privacy & Security',
    icon: Shield,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    questions: [
      {
        q: 'Are my documents stored on your servers?',
        a: 'Your uploaded file is stored on our server only long enough to be transferred to the kiosk printer (typically under 60 seconds). It is permanently deleted from the server immediately after the kiosk downloads it. Files are also deleted from the kiosk after printing. We do not retain any copy of your document.'
      },
      {
        q: 'Who can see my document?',
        a: 'Nobody. Your file is encrypted in transit (HTTPS), transferred directly to the kiosk, and deleted from our servers the moment the kiosk picks it up. Only the physical printer receives your document. No admin, no employee, and no other user can access your file.'
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. Payments are processed through Razorpay, a PCI DSS compliant payment gateway. JusPri never stores your card details. Only a payment confirmation ID is saved for refund and audit purposes.'
      },
      {
        q: 'What data does JusPri store about me?',
        a: 'We store only:\n\n• Your name and email from Google Sign-In\n• Print job metadata: file name, page count, cost, status, and timestamps\n\nWe never store the content of your documents. Your print history is private and only visible to you.'
      }
    ]
  },
  {
    category: 'General',
    icon: HelpCircle,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    questions: [
      {
        q: 'How does JusPri work?',
        a: 'JusPri is a cloud-based kiosk printing system:\n\n1. Scan the QR code at a kiosk with your phone\n2. Log in with Google\n3. Upload your document\n4. Pay per page (₹3/page)\n5. Collect your printout\n\nYour phone controls the kiosk — no USB, no email, no app install required.'
      },
      {
        q: 'Can I print without creating an account?',
        a: 'No — a Google account is required. This lets us securely link jobs to you, provide print history, and handle refunds if something goes wrong. Sign-in takes under 5 seconds with your existing Google account.'
      },
      {
        q: 'How much does printing cost?',
        a: 'The current rate is ₹3 per page for black & white printing. The exact page count and total cost are shown on screen before you pay — so there are never any surprises. Color printing and double-sided options are coming in a future update.'
      }
    ]
  }
];

function AccordionItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 py-4 text-left group"
      >
        <span className={`text-sm font-medium transition-colors ${isOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="mt-0.5 shrink-0"
        >
          <ChevronDown className={`w-4 h-4 transition-colors ${isOpen ? 'text-foreground' : 'text-muted-foreground'}`} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-4 pr-8">
              {answer.split('\n').map((line, i) => (
                <p key={i} className={`text-sm text-muted-foreground ${line === '' ? 'mt-2' : ''}`}>
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQPage() {
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState({});

  const toggle = (catIdx, qIdx) => {
    const key = `${catIdx}-${qIdx}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Minimal top nav */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-foreground" />
            <span className="text-sm font-semibold text-foreground">JusPri</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold text-foreground mb-3">FAQs & Support</h1>
          <p className="text-muted-foreground">
            Everything you need to know about printing with JusPri.
          </p>
        </motion.div>

        {/* FAQ sections */}
        <div className="space-y-6">
          {faqs.map((section, catIdx) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={catIdx}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: catIdx * 0.07 }}
                className="bg-card/60 border border-border rounded-2xl overflow-hidden"
              >
                {/* Section header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                  <div className={`w-8 h-8 rounded-lg ${section.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${section.color}`} />
                  </div>
                  <h2 className="font-semibold text-foreground text-sm">{section.category}</h2>
                </div>

                {/* Questions */}
                <div className="px-5">
                  {section.questions.map((item, qIdx) => (
                    <AccordionItem
                      key={qIdx}
                      question={item.q}
                      answer={item.a}
                      isOpen={!!openItems[`${catIdx}-${qIdx}`]}
                      onToggle={() => toggle(catIdx, qIdx)}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 pt-8 border-t border-border text-center"
        >
          <p className="text-sm text-muted-foreground mb-1">Still have questions?</p>
          <p className="text-xs text-muted-foreground/60">
            Contact your kiosk operator or email{' '}
            <span className="text-muted-foreground underline underline-offset-2 cursor-pointer">
              support@juspri.com
            </span>
          </p>
          <p className="text-xs text-muted-foreground/40 mt-6">
            © {new Date().getFullYear()} JusPri · 
            <button onClick={() => navigate('/faq')} className="ml-1 hover:text-muted-foreground transition-colors">FAQ</button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
