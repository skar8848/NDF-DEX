import { motion } from 'framer-motion'

const steps = [
  {
    number: '01',
    title: 'Choose Market',
    description:
      'Select a forward market for any supported asset pair. Each market has a fixed expiry date and settlement oracle.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Place Order',
    description:
      'Go long or short at your target forward price. Deposit USDC margin and your order enters the on-chain order book.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Settle at Expiry',
    description:
      'At expiry, the oracle reports the spot price. The smart contract automatically settles all positions and distributes profits.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
        />
      </svg>
    ),
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
}

const stepVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
}

export function HowItWorks() {
  return (
    <section className="py-24 px-6 relative">
      {/* Subtle background accent */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
            How It Works
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Three steps to start trading forward contracts on-chain.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
        >
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-primary/40 via-accent/40 to-success/40" />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              variants={stepVariants}
              className="relative flex flex-col items-center text-center"
            >
              {/* Step number circle */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-2xl bg-surface border border-border flex flex-col items-center justify-center transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                  <div className="text-primary mb-1">{step.icon}</div>
                  <span className="text-[11px] font-mono text-text-secondary tracking-wider">
                    STEP {step.number}
                  </span>
                </div>

                {/* Connector dot */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-2 h-2 rounded-full bg-primary/60 -translate-y-1/2" />
                )}
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-text mb-3">{step.title}</h3>
              <p className="text-text-secondary leading-relaxed text-[15px] max-w-xs">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
