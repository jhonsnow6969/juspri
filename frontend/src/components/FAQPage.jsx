// frontend/src/components/FAQPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, Printer, FileText, CreditCard, 
  Shield, HelpCircle, ArrowLeft, Search, X,
  ThumbsUp, ThumbsDown, Mail, Send
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
        a: `JusPri supports the following file types:\n\n• PDF (.pdf) — Prints directly, no conversion needed\n• Microsoft Word (.doc, .docx) — Auto-converted to PDF\n• OpenDocument Text (.odt) — Auto-converted to PDF\n• Rich Text Format (.rtf) — Auto-converted to PDF\n• Plain Text (.txt, .md) — Auto-converted to PDF\n• Images (.png, .jpg, .jpeg) — Scaled to A4 and printed\n\nMaximum file size right now is 100 MB , but we are working on increasing it.`
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

// Analytics helper
const trackFAQView = (questionId) => {
  try {
    const views = JSON.parse(localStorage.getItem('faq_views') || '{}');
    views[questionId] = (views[questionId] || 0) + 1;
    localStorage.setItem('faq_views', JSON.stringify(views));
  } catch (e) {
    console.error('Analytics error:', e);
  }
};

const trackHelpful = (questionId, helpful) => {
  try {
    const feedback = JSON.parse(localStorage.getItem('faq_feedback') || '{}');
    if (!feedback[questionId]) {
      feedback[questionId] = { helpful: 0, unhelpful: 0 };
    }
    if (helpful) {
      feedback[questionId].helpful++;
    } else {
      feedback[questionId].unhelpful++;
    }
    localStorage.setItem('faq_feedback', JSON.stringify(feedback));
  } catch (e) {
    console.error('Feedback tracking error:', e);
  }
};

function AccordionItem({ questionId, question, answer, isOpen, onToggle }) {
  const [voted, setVoted] = useState(null);

  const handleVote = (helpful) => {
    if (voted !== null) return; // Already voted
    setVoted(helpful);
    trackHelpful(questionId, helpful);
  };

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full flex items-start justify-between gap-4 py-4 text-left group"
        aria-expanded={isOpen}
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

              {/* Was this helpful? */}
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Was this helpful?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(true)}
                    disabled={voted !== null}
                    className={`p-1.5 rounded-md transition-colors ${
                      voted === true
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : voted === false
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVote(false)}
                    disabled={voted !== null}
                    className={`p-1.5 rounded-md transition-colors ${
                      voted === false
                        ? 'bg-red-500/20 text-red-400'
                        : voted === true
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                {voted !== null && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-muted-foreground"
                  >
                    Thanks for your feedback!
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContactModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production, send to backend API
    console.log('Contact form:', formData);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
      setSubmitted(false);
      setFormData({ name: '', email: '', message: '' });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl p-6 max-w-md w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Contact Support</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ThumbsUp className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-foreground font-medium mb-2">Message sent!</p>
              <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/10 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/10 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/10 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function FAQPage() {
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // SEO Meta Tags
  useEffect(() => {
    document.title = 'FAQs & Support - JusPri';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Find answers about JusPri cloud printing: supported formats, refunds, privacy, and more. Get help instantly.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Find answers about JusPri cloud printing: supported formats, refunds, privacy, and more. Get help instantly.';
      document.head.appendChild(meta);
    }

    return () => {
      document.title = 'JusPri';
    };
  }, []);

  const toggle = (catIdx, qIdx) => {
    const key = `${catIdx}-${qIdx}`;
    const questionId = `${catIdx}-${qIdx}`;
    
    // Track view if opening
    if (!openItems[key]) {
      trackFAQView(questionId);
    }
    
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Search filtering
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;

    const query = searchQuery.toLowerCase();
    return faqs.map(section => ({
      ...section,
      questions: section.questions.filter(q =>
        q.q.toLowerCase().includes(query) ||
        q.a.toLowerCase().includes(query)
      )
    })).filter(section => section.questions.length > 0);
  }, [searchQuery]);

  const hasResults = filteredFaqs.length > 0;

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
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-3">FAQs & Support</h1>
          <p className="text-muted-foreground">
            Everything you need to know about printing with JusPri.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-card/60 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              {hasResults ? `Found ${filteredFaqs.reduce((acc, s) => acc + s.questions.length, 0)} result(s)` : 'No results found'}
            </p>
          )}
        </motion.div>

        {/* FAQ sections */}
        {hasResults ? (
          <div className="space-y-6">
            {filteredFaqs.map((section, catIdx) => {
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
                        questionId={`${catIdx}-${qIdx}`}
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
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">No results found</p>
            <p className="text-sm text-muted-foreground mb-6">
              Try different keywords or contact us directly
            </p>
            <button
              onClick={() => setContactModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </button>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 pt-8 border-t border-border text-center"
        >
          <p className="text-sm text-muted-foreground mb-3">Still have questions?</p>
          <button
            onClick={() => setContactModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium text-foreground transition-colors mb-4"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </button>
          <p className="text-xs text-muted-foreground/60">
            Or email{' '}
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

      {/* Contact Modal */}
      <ContactModal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </div>
  );
}