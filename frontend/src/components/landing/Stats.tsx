import { motion } from 'framer-motion'

const stats = [
  {
    label: 'Blockchain',
    value: 'Avalanche',
    sub: 'Fuji C-Chain',
  },
  {
    label: 'Settlement',
    value: 'Chainlink',
    sub: 'Live price feeds',
  },
  {
    label: 'Order Book',
    value: 'On-Chain',
    sub: 'Price-time priority',
  },
  {
    label: 'Collateral',
    value: 'USDC',
    sub: 'Cash settled',
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

export function Stats() {
  return (
    <section className="py-16 px-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-6xl mx-auto"
      >
        <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-sm p-1">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className={`flex flex-col items-center justify-center py-8 px-4 ${
                  index < stats.length - 1 ? 'md:border-r md:border-border' : ''
                } ${index < 2 ? 'border-b md:border-b-0 border-border' : ''}`}
              >
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                  {stat.label}
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-text mb-1">
                  {stat.value}
                </span>
                <span className="text-xs font-medium text-primary">
                  {stat.sub}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
