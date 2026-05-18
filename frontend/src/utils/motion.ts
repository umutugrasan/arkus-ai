/**
 * Arkus AI — paylaşılan framer-motion variant'ları.
 * Salt sunum amaçlı; hiçbir fonksiyon/state/event bu dosyaya bağlı değildir.
 *
 * Kullanım:
 *   <motion.div variants={pageVariants} initial="hidden" animate="visible">
 *     <motion.div variants={staggerContainer}>
 *       <motion.div variants={staggerItem}>...</motion.div>
 *     </motion.div>
 *   </motion.div>
 */
import type { Variants } from 'framer-motion';

/** Sayfa kökü — içeriği yumuşakça sahneye alır ve çocuklarını stagger'lar. */
export const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut', staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/** Liste/grid sarmalayıcı — çocuklarını organik biçimde sırayla akıtır. */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

/** Tekil eleman — aşağıdan yukarı yumuşak giriş. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/** Tekil blok için sade fade + rise (stagger gerekmeyen yerlerde). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
